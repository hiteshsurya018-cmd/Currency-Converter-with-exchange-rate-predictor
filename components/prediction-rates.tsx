"use client"

import { useEffect, useMemo, useState } from "react"
import { fetchCurrencies, fetchHistoricalRates } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { addDays, format, subDays } from "date-fns"

type ModelType = "arima" | "lstm"
type Horizon = 7 | 14 | 30

type SeriesPoint = { date: string; rate: number }
type ChartPoint = { date: string; actual?: number | null; predicted?: number | null }

const HISTORY_DAYS = 365
const LSTM_WINDOW = 20

function difference(series: number[], d: number): number[] {
  let current = series.slice()
  for (let i = 0; i < d; i += 1) {
    const next: number[] = []
    for (let j = 1; j < current.length; j += 1) {
      next.push(current[j] - current[j - 1])
    }
    current = next
  }
  return current
}

function transpose(matrix: number[][]): number[][] {
  return matrix[0].map((_, col) => matrix.map((row) => row[col]))
}

function multiply(a: number[][], b: number[][]): number[][] {
  const result: number[][] = Array.from({ length: a.length }, () => Array(b[0].length).fill(0))
  for (let i = 0; i < a.length; i += 1) {
    for (let k = 0; k < b.length; k += 1) {
      for (let j = 0; j < b[0].length; j += 1) {
        result[i][j] += a[i][k] * b[k][j]
      }
    }
  }
  return result
}

function solveLinearSystem(a: number[][], b: number[]): number[] {
  const n = a.length
  const matrix = a.map((row, i) => [...row, b[i]])

  for (let i = 0; i < n; i += 1) {
    let maxRow = i
    for (let k = i + 1; k < n; k += 1) {
      if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) {
        maxRow = k
      }
    }
    ;[matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]]

    const pivot = matrix[i][i]
    if (Math.abs(pivot) < 1e-8) {
      return Array(n).fill(0)
    }
    for (let j = i; j <= n; j += 1) {
      matrix[i][j] /= pivot
    }
    for (let k = 0; k < n; k += 1) {
      if (k === i) continue
      const factor = matrix[k][i]
      for (let j = i; j <= n; j += 1) {
        matrix[k][j] -= factor * matrix[i][j]
      }
    }
  }

  return matrix.map((row) => row[n])
}

function fitAr(series: number[], p: number): { intercept: number; coeffs: number[] } | null {
  if (series.length <= p) return null

  const rows = series.length - p
  const x: number[][] = []
  const y: number[] = []

  for (let i = p; i < series.length; i += 1) {
    const row = [1]
    for (let lag = 1; lag <= p; lag += 1) {
      row.push(series[i - lag])
    }
    x.push(row)
    y.push(series[i])
  }

  const xT = transpose(x)
  const xTx = multiply(xT, x)
  const xTy = multiply(xT, y.map((v) => [v])).map((row) => row[0])
  const beta = solveLinearSystem(xTx, xTy)

  return {
    intercept: beta[0] ?? 0,
    coeffs: beta.slice(1),
  }
}

async function runArima(series: number[], horizon: number): Promise<number[]> {
  const p = 2
  const d = 1

  if (series.length < p + d + 5) return []

  const differenced = difference(series, d)
  const model = fitAr(differenced, p)
  if (!model) return []

  const history = differenced.slice()
  const forecasts: number[] = []

  for (let i = 0; i < horizon; i += 1) {
    const recent = history.slice(-p)
    let next = model.intercept
    for (let j = 0; j < p; j += 1) {
      next += model.coeffs[j] * (recent[p - 1 - j] ?? 0)
    }
    history.push(next)
    forecasts.push(next)
  }

  // Invert differencing for d=1
  const result: number[] = []
  let last = series[series.length - 1]
  for (const delta of forecasts) {
    last += delta
    result.push(last)
  }

  return result
}

async function runLstm(series: number[], horizon: number): Promise<number[]> {
  const tf = await import("@tensorflow/tfjs")

  if (series.length < LSTM_WINDOW + 1) {
    return []
  }

  const min = Math.min(...series)
  const max = Math.max(...series)
  const scale = max - min || 1
  const normalized = series.map((v) => (v - min) / scale)

  const xs: number[][] = []
  const ys: number[] = []
  for (let i = 0; i <= normalized.length - LSTM_WINDOW - 1; i += 1) {
    xs.push(normalized.slice(i, i + LSTM_WINDOW))
    ys.push(normalized[i + LSTM_WINDOW])
  }

  const xsTensor = tf.tensor3d(xs.map((row) => row.map((v) => [v])), [xs.length, LSTM_WINDOW, 1])
  const ysTensor = tf.tensor2d(ys, [ys.length, 1])

  const model = tf.sequential()
  model.add(tf.layers.lstm({ units: 16, inputShape: [LSTM_WINDOW, 1] }))
  model.add(tf.layers.dense({ units: 1 }))
  model.compile({ optimizer: tf.train.adam(0.01), loss: "meanSquaredError" })

  await model.fit(xsTensor, ysTensor, {
    epochs: 20,
    batchSize: 8,
    verbose: 0,
  })

  xsTensor.dispose()
  ysTensor.dispose()

  const predictions: number[] = []
  let window = normalized.slice(normalized.length - LSTM_WINDOW)

  for (let i = 0; i < horizon; i += 1) {
    const inputTensor = tf.tensor3d([window.map((v) => [v])], [1, LSTM_WINDOW, 1])
    const outputTensor = model.predict(inputTensor) as typeof tf.Tensor
    const output = (await outputTensor.data())[0]
    predictions.push(output * scale + min)

    window = window.slice(1)
    window.push(output)

    inputTensor.dispose()
    outputTensor.dispose()
  }

  model.dispose()
  return predictions
}

export function PredictionRates() {
  const [currencies, setCurrencies] = useState<Record<string, string>>({})
  const [fromCurrency, setFromCurrency] = useState("USD")
  const [toCurrency, setToCurrency] = useState("EUR")
  const [model, setModel] = useState<ModelType>("arima")
  const [horizon, setHorizon] = useState<Horizon>(7)
  const [series, setSeries] = useState<SeriesPoint[]>([])
  const [predicted, setPredicted] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    const getCurrencies = async () => {
      try {
        const data = await fetchCurrencies()
        setCurrencies(data)
      } catch {
        setError("Failed to load currencies.")
      }
    }

    getCurrencies()
  }, [])

  useEffect(() => {
    const loadHistory = async () => {
      setError(null)
      setSeries([])
      setPredicted([])
      const endDate = new Date()
      const startDate = subDays(endDate, HISTORY_DAYS)
      const formattedStart = format(startDate, "yyyy-MM-dd")
      const formattedEnd = format(endDate, "yyyy-MM-dd")

      try {
        const data = await fetchHistoricalRates(fromCurrency, toCurrency, formattedStart, formattedEnd)
        const points = Object.entries(data.rates)
          .map(([date, rates]) => ({
            date,
            rate: (rates as Record<string, number>)[toCurrency],
          }))
          .filter((point) => Number.isFinite(point.rate))
          .sort((a, b) => a.date.localeCompare(b.date))

        setSeries(points)
        if (points.length > 0) {
          setLastUpdated(points[points.length - 1].date)
        }
      } catch {
        setError("Failed to fetch historical rates.")
      }
    }

    loadHistory()
  }, [fromCurrency, toCurrency])

  const handlePredict = async () => {
    if (series.length === 0) {
      setError("Not enough historical data to run predictions.")
      return
    }

    setIsLoading(true)
    setError(null)
    setPredicted([])

    try {
      const values = series.map((point) => point.rate)
      const horizonValue = Number(horizon)

      const results =
        model === "arima" ? await runArima(values, horizonValue) : await runLstm(values, horizonValue)

      if (!results.length) {
        setError("Prediction failed. Try a different model or longer history.")
      } else {
        setPredicted(results)
      }
    } catch (err) {
      setError("Prediction failed. Try a different model or horizon.")
    } finally {
      setIsLoading(false)
    }
  }

  const chartData = useMemo(() => {
    if (series.length === 0) return []

    const recentHistory = series.slice(-90)
    const points: ChartPoint[] = recentHistory.map((point) => ({
      date: point.date,
      actual: point.rate,
      predicted: null,
    }))

    if (predicted.length > 0) {
      const lastDate = new Date(recentHistory[recentHistory.length - 1].date)
      predicted.forEach((value, index) => {
        const futureDate = addDays(lastDate, index + 1)
        points.push({
          date: format(futureDate, "yyyy-MM-dd"),
          actual: null,
          predicted: value,
        })
      })
    }

    return points
  }, [series, predicted])

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Prediction Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <Select value={fromCurrency} onValueChange={setFromCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(currencies).map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                      {code} - {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <Select value={toCurrency} onValueChange={setToCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(currencies).map(([code, name]) => (
                    <SelectItem key={code} value={code}>
                      {code} - {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Model</label>
              <Select value={model} onValueChange={(value) => setModel(value as ModelType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="arima">ARIMA</SelectItem>
                  <SelectItem value="lstm">LSTM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Horizon</label>
              <Select value={String(horizon)} onValueChange={(value) => setHorizon(Number(value) as Horizon)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select horizon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Days</SelectItem>
                  <SelectItem value="14">14 Days</SelectItem>
                  <SelectItem value="30">30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              {lastUpdated ? `Last historical date: ${lastUpdated}` : "Loading historical data..."}
            </div>
            <Button onClick={handlePredict} disabled={isLoading}>
              {isLoading ? "Predicting..." : "Run Prediction"}
            </Button>
          </div>

          {error && <div className="bg-destructive/10 text-destructive p-3 rounded-md">{error}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prediction Chart</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="text-muted-foreground">No data available. Select currencies and run prediction.</div>
          ) : (
            <ChartContainer
              config={{
                actual: { label: "Historical Rate", color: "hsl(var(--chart-1))" },
                predicted: { label: "Predicted Rate", color: "hsl(var(--chart-4))" },
              }}
              className="h-[320px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), "MMM d")} />
                  <YAxis domain={["auto", "auto"]} tickFormatter={(value) => value.toFixed(4)} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="actual" stroke="var(--color-actual)" dot={false} />
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    stroke="var(--color-predicted)"
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Predicted Values</CardTitle>
        </CardHeader>
        <CardContent>
          {predicted.length === 0 ? (
            <div className="text-muted-foreground">Run a prediction to see the forecasted values.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              {predicted.map((value, index) => {
                const lastDate = series.length > 0 ? new Date(series[series.length - 1].date) : new Date()
                const date = format(addDays(lastDate, index + 1), "yyyy-MM-dd")
                return (
                  <div key={date} className="flex justify-between border rounded-md px-3 py-2">
                    <span className="text-muted-foreground">{date}</span>
                    <span className="font-medium">{value.toFixed(6)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

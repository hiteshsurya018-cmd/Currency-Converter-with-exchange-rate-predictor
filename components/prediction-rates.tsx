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
const LSTM_SEED = 42
const LSTM_WINDOW = 14
const LSTM_TRAINING_POINTS = 180
const LSTM_EPOCHS = 8
const LSTM_BATCH_SIZE = 16
const LSTM_UNITS = 10
const LSTM_LEARNING_RATE = 0.002
const MIN_LOG_RETURN_SCALE = 0.0005
const MIN_DAILY_LOG_RETURN_LIMIT = Math.log(1.001)
const MAX_DAILY_LOG_RETURN = Math.log(1.035)
const LSTM_CONSTRAINT_WINDOW = 90
const LSTM_MODEL_WEIGHT = 0.65

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: number[], average = mean(values)): number {
  if (values.length < 2) return 0
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = values.slice().sort((a, b) => a - b)
  const index = clamp(Math.ceil((p / 100) * sorted.length) - 1, 0, sorted.length - 1)
  return sorted[index]
}

function toLogReturns(series: number[]): number[] {
  const returns: number[] = []

  for (let i = 1; i < series.length; i += 1) {
    const previous = series[i - 1]
    const current = series[i]

    if (previous > 0 && current > 0) {
      const value = Math.log(current / previous)
      if (Number.isFinite(value)) {
        returns.push(value)
      }
    }
  }

  return returns
}

function getDailyReturnLimit(logReturns: number[], returnScale: number): number {
  const absoluteReturns = logReturns.map(Math.abs)
  return clamp(
    Math.max(percentile(absoluteReturns, 90) * 1.25, returnScale * 2.25, MIN_DAILY_LOG_RETURN_LIMIT),
    MIN_DAILY_LOG_RETURN_LIMIT,
    MAX_DAILY_LOG_RETURN,
  )
}

function clampForecastRate(
  rate: number,
  previousRate: number,
  lastObservedRate: number,
  recentRates: number[],
  dailyReturnLimit: number,
  stepIndex: number,
): number {
  if (!Number.isFinite(rate) || rate <= 0) return previousRate

  const stepReturn = clamp(Math.log(rate / previousRate), -dailyReturnLimit, dailyReturnLimit)
  const stepLimitedRate = previousRate * Math.exp(stepReturn)
  const recentMin = Math.min(...recentRates)
  const recentMax = Math.max(...recentRates)
  const recentRange = Math.max(recentMax - recentMin, lastObservedRate * dailyReturnLimit)
  const horizonScale = Math.sqrt(stepIndex + 1)
  const volatilityRange = dailyReturnLimit * horizonScale * 2.25
  const volatilityLower = lastObservedRate * Math.exp(-volatilityRange)
  const volatilityUpper = lastObservedRate * Math.exp(volatilityRange)
  const rangePadding = Math.max(recentRange * 0.2, lastObservedRate * dailyReturnLimit * horizonScale)
  const rangeLower = Math.max(Number.EPSILON, Math.min(recentMin, lastObservedRate) - rangePadding)
  const rangeUpper = Math.max(recentMax, lastObservedRate) + rangePadding
  const lowerBound = Math.max(Number.EPSILON, volatilityLower, rangeLower)
  const upperBound = Math.min(volatilityUpper, rangeUpper)

  if (lowerBound >= upperBound) {
    return clamp(stepLimitedRate, Math.max(Number.EPSILON, volatilityLower), volatilityUpper)
  }

  return clamp(stepLimitedRate, lowerBound, upperBound)
}

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

async function runLstm(
  series: number[],
  horizon: number,
  onStatus?: (status: string) => void,
): Promise<number[]> {
  onStatus?.("Loading TensorFlow...")
  const tf = await import("@tensorflow/tfjs")

  const runTraining = async () => {
    onStatus?.("Preparing recent exchange-rate data...")
    await tf.ready()

    if (series.length < LSTM_WINDOW + 1) {
      return []
    }

    const cleanedSeries = series.filter((value) => Number.isFinite(value) && value > 0)
    const trimmedSeries =
      cleanedSeries.length > LSTM_TRAINING_POINTS
        ? cleanedSeries.slice(-LSTM_TRAINING_POINTS)
        : cleanedSeries
    const logReturns = toLogReturns(trimmedSeries)

    if (logReturns.length < LSTM_WINDOW + 1) {
      return []
    }

    const averageReturn = mean(logReturns)
    const returnScale = Math.max(standardDeviation(logReturns, averageReturn), MIN_LOG_RETURN_SCALE)
    const dailyReturnLimit = getDailyReturnLimit(logReturns, returnScale)
    const normalizeReturn = (value: number) => clamp((value - averageReturn) / returnScale, -3, 3)
    const denormalizeReturn = (value: number) =>
      clamp(averageReturn + clamp(value, -3, 3) * returnScale, -dailyReturnLimit, dailyReturnLimit)
    const normalized = logReturns.map(normalizeReturn)

    const xs: number[][] = []
    const ys: number[] = []
    for (let i = 0; i <= normalized.length - LSTM_WINDOW - 1; i += 1) {
      xs.push(normalized.slice(i, i + LSTM_WINDOW))
      ys.push(normalized[i + LSTM_WINDOW])
    }

    if (xs.length === 0 || ys.length === 0) {
      return []
    }

    const xsTensor = tf.tensor3d(xs.map((row) => row.map((v) => [v])), [xs.length, LSTM_WINDOW, 1])
    const ysTensor = tf.tensor2d(ys, [ys.length, 1])

    const model = tf.sequential()
    model.add(
      tf.layers.lstm({
        units: LSTM_UNITS,
        inputShape: [LSTM_WINDOW, 1],
        kernelInitializer: tf.initializers.glorotUniform({ seed: LSTM_SEED }),
        recurrentInitializer: tf.initializers.orthogonal({ seed: LSTM_SEED + 1 }),
        biasInitializer: tf.initializers.zeros(),
      }),
    )
    model.add(
      tf.layers.dense({
        units: 1,
        kernelInitializer: tf.initializers.glorotUniform({ seed: LSTM_SEED + 2 }),
        biasInitializer: tf.initializers.zeros(),
      }),
    )
    model.compile({ optimizer: tf.train.adam(LSTM_LEARNING_RATE), loss: "meanSquaredError" })

    try {
      onStatus?.("Training LSTM model...")
      await model.fit(xsTensor, ysTensor, {
        epochs: LSTM_EPOCHS,
        batchSize: LSTM_BATCH_SIZE,
        shuffle: false,
        verbose: 0,
        callbacks: {
          onEpochEnd: async (epoch) => {
            onStatus?.(`Training LSTM model (${epoch + 1}/${LSTM_EPOCHS})...`)
            await tf.nextFrame()
          },
        },
      })

      onStatus?.("Generating forecast...")
      const predictions: number[] = []
      let window = normalized.slice(normalized.length - LSTM_WINDOW)
      const lastObservedRate = trimmedSeries[trimmedSeries.length - 1]
      const recentRates = trimmedSeries.slice(-LSTM_CONSTRAINT_WINDOW)
      let lastRate = lastObservedRate
      const recentDrift = clamp(mean(logReturns.slice(-LSTM_WINDOW)), -dailyReturnLimit, dailyReturnLimit)

      for (let i = 0; i < horizon; i += 1) {
        const output = tf.tidy(() => {
          const inputTensor = tf.tensor3d([window.map((v) => [v])], [1, LSTM_WINDOW, 1])
          const prediction = model.predict(inputTensor)
          const outputTensor = Array.isArray(prediction) ? prediction[0] : prediction
          return outputTensor.dataSync()[0]
        })
        const modelReturn = denormalizeReturn(Number.isFinite(output) ? output : normalizeReturn(recentDrift))
        const modelWeight = LSTM_MODEL_WEIGHT * (1 - (i / Math.max(horizon - 1, 1)) * 0.4)
        const nextReturn = clamp(
          modelReturn * modelWeight + recentDrift * (1 - modelWeight),
          -dailyReturnLimit,
          dailyReturnLimit,
        )
        const nextRate = clampForecastRate(
          lastRate * Math.exp(nextReturn),
          lastRate,
          lastObservedRate,
          recentRates,
          dailyReturnLimit,
          i,
        )

        if (!Number.isFinite(nextRate) || nextRate <= 0) {
          return predictions
        }

        predictions.push(nextRate)

        window = window.slice(1)
        window.push(normalizeReturn(Math.log(nextRate / lastRate)))
        lastRate = nextRate
      }

      return predictions
    } finally {
      xsTensor.dispose()
      ysTensor.dispose()
      model.dispose()
    }
  }

  try {
    if (tf.getBackend() !== "cpu") {
      await tf.setBackend("cpu")
    }
    return await runTraining()
  } catch (error) {
    console.error("LSTM prediction failed.", error)
    return []
  }
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
  const [predictionStatus, setPredictionStatus] = useState<string | null>(null)
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
    setPredictionStatus(model === "lstm" ? "Starting LSTM..." : "Running ARIMA...")
    setError(null)
    setPredicted([])

    try {
      const values = series.map((point) => point.rate)
      const horizonValue = Number(horizon)

      const results =
        model === "arima"
          ? await runArima(values, horizonValue)
          : await runLstm(values, horizonValue, setPredictionStatus)

      if (!results.length) {
        setError("Prediction failed. Try a different model or longer history.")
      } else {
        setPredicted(results)
      }
    } catch (err) {
      setError("Prediction failed. Try a different model or horizon.")
    } finally {
      setIsLoading(false)
      setPredictionStatus(null)
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

          {predictionStatus && <div className="text-sm text-muted-foreground">{predictionStatus}</div>}
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

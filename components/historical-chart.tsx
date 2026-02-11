"use client"

import { useState, useEffect } from "react"
import { useAppContext } from "@/context/app-context"
import { fetchHistoricalRates } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { format, subDays, subMonths, subYears } from "date-fns"

type DateRange = "7d" | "1m" | "6m" | "1y"

interface ChartData {
  date: string
  rate: number
}

export function HistoricalChart() {
  const { fromCurrency, toCurrency } = useAppContext()
  const [dateRange, setDateRange] = useState<DateRange>("1m")
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      if (!fromCurrency || !toCurrency) return

      setIsLoading(true)
      setError(null)

      try {
        const endDate = new Date()
        let startDate: Date

        switch (dateRange) {
          case "7d":
            startDate = subDays(endDate, 7)
            break
          case "1m":
            startDate = subMonths(endDate, 1)
            break
          case "6m":
            startDate = subMonths(endDate, 6)
            break
          case "1y":
            startDate = subYears(endDate, 1)
            break
          default:
            startDate = subMonths(endDate, 1)
        }

        const formattedStartDate = format(startDate, "yyyy-MM-dd")
        const formattedEndDate = format(endDate, "yyyy-MM-dd")

        const data = await fetchHistoricalRates(fromCurrency, toCurrency, formattedStartDate, formattedEndDate)

        const formattedData: ChartData[] = Object.entries(data.rates).map(([date, rates]) => ({
          date,
          rate: (rates as Record<string, number>)[toCurrency],
        }))

        setChartData(formattedData)
      } catch (error) {
        setError("Failed to fetch historical data. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [fromCurrency, toCurrency, dateRange])

  return (
    <Card id="chart" className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Exchange Rate History</CardTitle>
        <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 Days</SelectItem>
            <SelectItem value="1m">1 Month</SelectItem>
            <SelectItem value="6m">6 Months</SelectItem>
            <SelectItem value="1y">1 Year</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md">{error}</div>
        ) : chartData.length > 0 ? (
          <ChartContainer
            config={{
              rate: {
                label: `${fromCurrency} to ${toCurrency} Rate`,
                color: "hsl(var(--chart-1))",
              },
            }}
            className="h-[300px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => {
                    const formattedDate = new Date(date)
                    return format(formattedDate, "MMM d")
                  }}
                />
                <YAxis domain={["auto", "auto"]} tickFormatter={(value) => value.toFixed(4)} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex min-w-[100px] items-center text-xs text-muted-foreground">
                          {name}
                          <div className="ml-auto font-medium tabular-nums text-foreground">
                            {Number(value).toFixed(6)}
                          </div>
                        </div>
                      )}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="var(--color-rate)"
                  name={`${fromCurrency} to ${toCurrency}`}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        ) : (
          <div className="flex justify-center items-center py-16 text-muted-foreground">
            No historical data available
          </div>
        )}
      </CardContent>
    </Card>
  )
}

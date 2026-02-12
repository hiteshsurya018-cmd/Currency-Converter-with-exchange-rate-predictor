"use client"

import { useMemo, useState } from "react"
import { useAppContext } from "@/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { Pie, PieChart, Cell, ResponsiveContainer, Legend } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Define chart colors
const COLORS = [
  "#2563EB", // blue
  "#16A34A", // green
  "#F97316", // orange
  "#DC2626", // red
  "#8B5CF6", // purple
  "#0EA5E9", // sky
  "#EAB308", // yellow
  "#EC4899", // pink
  "#14B8A6", // teal
  "#4B5563", // slate
]

const toColorKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")

export function ExpenseChart() {
  const { expenses, userCurrency } = useAppContext()
  const [range, setRange] = useState("30")

  const rangeLabelMap: Record<string, string> = {
    "7": "Last 7 days",
    "30": "Last 30 days",
    "90": "Last 90 days",
    all: "All time",
  }

  const filteredExpenses = useMemo(() => {
    if (range === "all") return expenses
    const days = Number(range)
    if (!Number.isFinite(days)) return expenses
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    return expenses.filter((expense) => expense.timestamp >= cutoff)
  }, [expenses, range])

  // Group expenses by category and calculate totals
  const categoryData = useMemo(() => {
    const categoryMap = new Map<string, number>()

    filteredExpenses.forEach((expense) => {
      const currentTotal = categoryMap.get(expense.category) || 0
      categoryMap.set(expense.category, currentTotal + expense.localAmount)
    })

    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [expenses])

  // Calculate total expenses
  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((total, expense) => total + expense.localAmount, 0)
  }, [filteredExpenses])

  if (filteredExpenses.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle>Expense Breakdown</CardTitle>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-[300px]">
          <p className="text-muted-foreground">
            No expense data available for {rangeLabelMap[range] || "this range"}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <CardTitle>Expense Breakdown</CardTitle>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row items-center justify-between mb-4">
          <div className="text-center md:text-left mb-4 md:mb-0">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-3xl font-bold">{formatCurrency(totalExpenses, userCurrency || "INR")}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {categoryData.slice(0, 6).map((entry, index) => (
              <div key={entry.name} className="flex items-center">
                <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="truncate">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        <ChartContainer
          config={Object.fromEntries(
            categoryData.map((entry, index) => [
              toColorKey(entry.name),
              {
                label: entry.name,
                color: COLORS[index % COLORS.length],
              },
            ]),
          )}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex min-w-[100px] items-center text-xs text-muted-foreground">
                        {name}
                        <div className="ml-auto font-medium tabular-nums text-foreground">
                          {formatCurrency(Number(value), userCurrency || "INR")}
                        </div>
                      </div>
                    )}
                  />
                }
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

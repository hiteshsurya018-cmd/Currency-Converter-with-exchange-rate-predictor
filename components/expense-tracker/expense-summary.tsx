"use client"

import { useMemo } from "react"
import { useAppContext } from "@/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

const getStartOfDay = (date: Date) => {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result.getTime()
}

const getStartOfWeek = (date: Date) => {
  const result = new Date(date)
  const day = result.getDay()
  result.setDate(result.getDate() - day)
  result.setHours(0, 0, 0, 0)
  return result.getTime()
}

const getStartOfMonth = (date: Date) => {
  const result = new Date(date.getFullYear(), date.getMonth(), 1)
  result.setHours(0, 0, 0, 0)
  return result.getTime()
}

export function ExpenseSummary() {
  const { expenses, userCurrency } = useAppContext()

  const totals = useMemo(() => {
    const now = new Date()
    const dayStart = getStartOfDay(now)
    const weekStart = getStartOfWeek(now)
    const monthStart = getStartOfMonth(now)

    let today = 0
    let week = 0
    let month = 0

    for (const expense of expenses) {
      if (expense.timestamp >= dayStart) today += expense.localAmount
      if (expense.timestamp >= weekStart) week += expense.localAmount
      if (expense.timestamp >= monthStart) month += expense.localAmount
    }

    return { today, week, month }
  }, [expenses])

  const currency = userCurrency || "INR"

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Today</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{formatCurrency(totals.today, currency)}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>This Week</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{formatCurrency(totals.week, currency)}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>This Month</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{formatCurrency(totals.month, currency)}</CardContent>
      </Card>
    </div>
  )
}

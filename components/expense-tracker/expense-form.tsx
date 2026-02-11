"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useAppContext } from "@/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { fetchCurrencies, fetchExchangeRate } from "@/lib/api"
import { EXPENSE_CATEGORIES, suggestExpenseCategory } from "@/lib/expense-categories"
import { useToast } from "@/hooks/use-toast"

export function ExpenseForm() {
  const { addExpense, userCurrency } = useAppContext()
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState(userCurrency || "INR")
  const [currencyTouched, setCurrencyTouched] = useState(false)
  const [currencies, setCurrencies] = useState<Record<string, string>>({})
  const [category, setCategory] = useState("Food & Dining")
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [description, setDescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const getCurrencies = async () => {
      try {
        const data = await fetchCurrencies()
        setCurrencies(data)
      } catch {
        toast({
          title: "Error",
          description: "Failed to load currencies. Please try again later.",
          variant: "destructive",
        })
      }
    }

    getCurrencies()
  }, [toast])

  useEffect(() => {
    if (userCurrency && !currencyTouched) {
      setCurrency(userCurrency)
    }
  }, [userCurrency, currencyTouched])

  useEffect(() => {
    if (categoryTouched) return
    const suggestion = suggestExpenseCategory(description)
    if (suggestion) {
      setCategory(suggestion)
    }
  }, [description, categoryTouched])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Convert to local currency if different
      const localCurrency = userCurrency || "INR"
      let localAmount = Number(amount)
      let exchangeRate = 1

      if (currency !== localCurrency) {
        const data = await fetchExchangeRate(currency, localCurrency, Number(amount))
        localAmount = data.rates[localCurrency]
        exchangeRate = localAmount / Number(amount)
      }

      addExpense({
        amount: Number(amount),
        currency,
        localAmount,
        localCurrency,
        category,
        description,
        timestamp: Date.now(),
      })

      // Reset form
      setAmount("")
      setDescription("")

      toast({
        title: "Expense added",
        description: "Your expense has been successfully logged",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add expense. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log Expense</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={currency}
                onValueChange={(value) => {
                  setCurrency(value)
                  setCurrencyTouched(true)
                }}
              >
                <SelectTrigger id="currency">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
              <Select
                value={category}
                onValueChange={(value) => {
                  setCategory(value)
                  setCategoryTouched(true)
                }}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="E.g., Lunch at restaurant"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Adding..." : "Add Expense"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

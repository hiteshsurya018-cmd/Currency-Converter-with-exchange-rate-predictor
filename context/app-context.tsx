"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect } from "react"
import type { Transaction } from "@/types/transaction"

// Add these types
export interface Expense {
  id: string
  amount: number
  currency: string
  localAmount: number
  localCurrency: string
  category: string
  description: string
  timestamp: number
}

// Update the AppContextType to include authentication and expenses
interface AppContextType {
  fromCurrency: string
  setFromCurrency: (currency: string) => void
  toCurrency: string
  setToCurrency: (currency: string) => void
  amount: string
  setAmount: (amount: string) => void
  transactions: Transaction[]
  addTransaction: (transaction: Transaction) => void
  clearTransactions: () => void
  // Expenses
  expenses: Expense[]
  addExpense: (expense: Omit<Expense, "id">) => void
  deleteExpense: (id: string) => void
  clearExpenses: () => void
  updateExpense: (id: string, patch: Partial<Omit<Expense, "id">>) => void
  replaceExpenses: (expenses: Expense[]) => void
  mergeExpenses: (expenses: Expense[]) => void
  // Geolocation
  userCountry: string | null
  userCurrency: string | null
}

const AppContext = createContext<AppContextType | undefined>(undefined)

// Update the AppProvider component
export function AppProvider({ children }: { children: React.ReactNode }) {
  const TRANSACTIONS_VERSION = 1
  const EXPENSES_VERSION = 1
  const [fromCurrency, setFromCurrency] = useState("INR")
  const [toCurrency, setToCurrency] = useState("EUR")
  const [amount, setAmount] = useState("1")
  const [transactions, setTransactions] = useState<Transaction[]>([])
  // Expenses
  const [expenses, setExpenses] = useState<Expense[]>([])
  // Geolocation
  const [userCountry, setUserCountry] = useState<string | null>(null)
  const [userCurrency, setUserCurrency] = useState<string | null>("INR")

  const safeParse = (value: string | null) => {
    if (!value) return null
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }

  // Load transactions from localStorage on initial render
  useEffect(() => {
    const savedTransactions = safeParse(localStorage.getItem("transactions"))
    if (Array.isArray(savedTransactions)) {
      setTransactions(savedTransactions)
    } else if (savedTransactions?.version === TRANSACTIONS_VERSION && Array.isArray(savedTransactions?.data)) {
      setTransactions(savedTransactions.data)
    }

    const savedExpenses = safeParse(localStorage.getItem("expenses"))
    if (Array.isArray(savedExpenses)) {
      setExpenses(savedExpenses)
    } else if (savedExpenses?.version === EXPENSES_VERSION && Array.isArray(savedExpenses?.data)) {
      setExpenses(savedExpenses.data)
    }
  }, [])

  // Save transactions to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(
      "transactions",
      JSON.stringify({
        version: TRANSACTIONS_VERSION,
        data: transactions,
      }),
    )
  }, [transactions])

  // Save expenses to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(
      "expenses",
      JSON.stringify({
        version: EXPENSES_VERSION,
        data: expenses,
      }),
    )
  }, [expenses])

  // Detect user's location and set default currency
  useEffect(() => {
    const detectLocation = async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)

      try {
        // Use IP geolocation as a best-effort fallback
        const response = await fetch("https://ipapi.co/json/", {
          signal: controller.signal,
          cache: "no-store",
        })
        if (!response.ok) return

        const data = await response.json()
        if (!data?.country_name) return

        setUserCountry(data.country_name)

        // Map country to currency code (simplified version)
        const countryCurrencyMap: Record<string, string> = {
          "United States": "USD",
          "United Kingdom": "GBP",
          "European Union": "EUR",
          Japan: "JPY",
          India: "INR",
          Canada: "CAD",
          Australia: "AUD",
          // Add more mappings as needed
        }

        const currency = countryCurrencyMap[data.country_name] || "USD"
        setUserCurrency(currency)

        // Set as default "from" currency if not already set by user
        if (fromCurrency === "USD") {
          setFromCurrency(currency)
        }
      } catch {
        // Silent fallback: keep defaults if geolocation fails
      } finally {
        clearTimeout(timeoutId)
      }
    }

    detectLocation()
  }, [])

  const addTransaction = (transaction: Transaction) => {
    setTransactions((prev) => [transaction, ...prev])
  }

  const clearTransactions = () => {
    setTransactions([])
  }

  // Expense functions
  const addExpense = (expense: Omit<Expense, "id">) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const newExpense = {
      ...expense,
      id,
    }
    setExpenses((prev) => [newExpense, ...prev])
  }

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((expense) => expense.id !== id))
  }

  const clearExpenses = () => {
    setExpenses([])
  }

  const updateExpense = (id: string, patch: Partial<Omit<Expense, "id">>) => {
    setExpenses((prev) =>
      prev.map((expense) => (expense.id === id ? { ...expense, ...patch } : expense)),
    )
  }

  const replaceExpenses = (nextExpenses: Expense[]) => {
    setExpenses(nextExpenses)
  }

  const mergeExpenses = (nextExpenses: Expense[]) => {
    setExpenses((prev) => [...nextExpenses, ...prev])
  }

  return (
    <AppContext.Provider
      value={{
        fromCurrency,
        setFromCurrency,
        toCurrency,
        setToCurrency,
        amount,
        setAmount,
      transactions,
      addTransaction,
      clearTransactions,
      // Expenses
      expenses,
      addExpense,
      deleteExpense,
      clearExpenses,
      updateExpense,
      replaceExpenses,
      mergeExpenses,
        // Geolocation
        userCountry,
        userCurrency,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}

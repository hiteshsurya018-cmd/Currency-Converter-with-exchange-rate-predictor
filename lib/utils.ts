import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Transaction } from "@/types/transaction"

type CsvValue = string | number | boolean | null | undefined

const escapeCsvValue = (value: CsvValue) => {
  const stringValue = String(value ?? "")
  const escaped = stringValue.replace(/"/g, '""')
  return `"${escaped}"`
}

export function exportRowsToCSV(headers: string[], rows: CsvValue[][], filename: string) {
  const csvContent = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.display = "none"

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string, locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(timestamp: number, locale = "en-US"): string {
  return new Date(timestamp).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function exportToCSV(transactions: Transaction[]) {
  // Define CSV headers
  const headers = ["From Currency", "To Currency", "Amount", "Converted Amount", "Exchange Rate", "Timestamp"]

  // Format transaction data for CSV
  const data: CsvValue[][] = transactions.map((transaction) => [
    transaction.fromCurrency,
    transaction.toCurrency,
    transaction.amount,
    transaction.convertedAmount,
    transaction.exchangeRate,
    formatDate(transaction.timestamp),
  ])

  exportRowsToCSV(headers, data, `currency-transactions-${new Date().toISOString().split("T")[0]}.csv`)
}

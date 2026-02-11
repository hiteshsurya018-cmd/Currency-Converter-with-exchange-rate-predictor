"use client"

import { useState } from "react"
import { useAppContext } from "@/context/app-context"
import { formatCurrency, formatDate, exportToCSV } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Trash2, Search } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function TransactionHistory() {
  const { transactions, clearTransactions } = useAppContext()
  const [searchTerm, setSearchTerm] = useState("")

  const filteredTransactions = transactions.filter((transaction) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      transaction.fromCurrency.toLowerCase().includes(searchLower) ||
      transaction.toCurrency.toLowerCase().includes(searchLower) ||
      transaction.amount.toString().includes(searchTerm) ||
      transaction.convertedAmount.toString().includes(searchTerm) ||
      formatDate(transaction.timestamp).toLowerCase().includes(searchLower)
    )
  })

  const handleExportCSV = () => {
    exportToCSV(filteredTransactions)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleExportCSV}
          disabled={filteredTransactions.length === 0}
          title="Export to CSV"
        >
          <Download className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="text-destructive"
              disabled={transactions.length === 0}
              title="Clear History"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Transaction History</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete all your transaction history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={clearTransactions}>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Converted</TableHead>
              <TableHead>Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((transaction, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{formatDate(transaction.timestamp)}</TableCell>
                  <TableCell>{transaction.fromCurrency}</TableCell>
                  <TableCell>{transaction.toCurrency}</TableCell>
                  <TableCell>{formatCurrency(transaction.amount, transaction.fromCurrency)}</TableCell>
                  <TableCell>{formatCurrency(transaction.convertedAmount, transaction.toCurrency)}</TableCell>
                  <TableCell>{transaction.exchangeRate.toFixed(6)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  {transactions.length === 0 ? "No transaction history" : "No matching transactions found"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

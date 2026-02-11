"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAppContext } from "@/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { exportRowsToCSV, formatCurrency, formatDate } from "@/lib/utils"
import { Download, Trash2, Search, Upload, Pencil, Save, X, ChevronLeft, ChevronRight } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fetchCurrencies, fetchExchangeRate } from "@/lib/api"
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories"
import { useToast } from "@/hooks/use-toast"

export function ExpenseList() {
  const { expenses, deleteExpense, clearExpenses, userCurrency, updateExpense, mergeExpenses, replaceExpenses } =
    useAppContext()
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortKey, setSortKey] = useState<"date" | "category" | "description" | "amount" | "localAmount">("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [pageSize, setPageSize] = useState(25)
  const [currentPage, setCurrentPage] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [draft, setDraft] = useState({
    amount: "",
    currency: "",
    category: "",
    description: "",
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge")
  const [currencies, setCurrencies] = useState<Record<string, string>>({})

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

  const filteredExpenses = useMemo(() => {
    const searchLower = searchTerm.toLowerCase()
    return expenses.filter((expense) => {
      const matchesSearch =
        expense.description.toLowerCase().includes(searchLower) ||
        expense.category.toLowerCase().includes(searchLower) ||
        expense.amount.toString().includes(searchTerm) ||
        expense.currency.toLowerCase().includes(searchLower)

      const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter

      return matchesSearch && matchesCategory
    })
  }, [expenses, searchTerm, categoryFilter])

  const sortedExpenses = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1
      const getValue = (expense: typeof a) => {
        switch (sortKey) {
          case "category":
            return expense.category.toLowerCase()
          case "description":
            return expense.description.toLowerCase()
          case "amount":
            return expense.amount
          case "localAmount":
            return expense.localAmount
          case "date":
          default:
            return expense.timestamp
        }
      }

      const aValue = getValue(a)
      const bValue = getValue(b)
      if (aValue < bValue) return -1 * direction
      if (aValue > bValue) return 1 * direction
      return 0
    })
  }, [filteredExpenses, sortDir, sortKey])

  const totalPages = Math.max(1, Math.ceil(sortedExpenses.length / pageSize))
  const currentPageSafe = Math.min(currentPage, totalPages)

  const visibleExpenses = useMemo(() => {
    const start = (currentPageSafe - 1) * pageSize
    return sortedExpenses.slice(start, start + pageSize)
  }, [sortedExpenses, pageSize, currentPageSafe])

  // Get unique categories from expenses
  const categories = ["all", ...new Set(expenses.map((expense) => expense.category))]

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, categoryFilter])

  const exportToCSV = () => {
    // Define CSV headers
    const headers = ["Date", "Category", "Description", "Amount", "Currency", "Local Amount", "Local Currency"]

    // Format expense data for CSV
    const data = filteredExpenses.map((expense) => [
      formatDate(expense.timestamp),
      expense.category,
      expense.description,
      expense.amount,
      expense.currency,
      expense.localAmount,
      expense.localCurrency,
    ])

    exportRowsToCSV(headers, data, `expenses-${new Date().toISOString().split("T")[0]}.csv`)
  }

  const exportToJSON = () => {
    const payload = JSON.stringify(filteredExpenses, null, 2)
    const blob = new Blob([payload], { type: "application/json;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `expenses-${new Date().toISOString().split("T")[0]}.json`)
    link.style.display = "none"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) {
        throw new Error("Invalid file format")
      }

      const cleaned = parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: String(
            item.id ||
              (typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
          ),
          amount: Number(item.amount) || 0,
          currency: String(item.currency || "USD"),
          localAmount: Number(item.localAmount) || 0,
          localCurrency: String(item.localCurrency || userCurrency || "INR"),
          category: String(item.category || "Other"),
          description: String(item.description || ""),
          timestamp: Number(item.timestamp) || Date.now(),
        }))

      if (importMode === "replace") {
        replaceExpenses(cleaned)
      } else {
        mergeExpenses(cleaned)
      }
      toast({
        title: "Import complete",
        description: `Imported ${cleaned.length} expenses.`,
      })
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Invalid JSON file.",
        variant: "destructive",
      })
    } finally {
      if (event.target) {
        event.target.value = ""
      }
    }
  }

  const startEditing = (expense: (typeof expenses)[number]) => {
    setEditingId(expense.id)
    setDraft({
      amount: String(expense.amount),
      currency: expense.currency,
      category: expense.category,
      description: expense.description,
    })
  }

  const cancelEditing = () => {
    setEditingId(null)
    setDraft({
      amount: "",
      currency: "",
      category: "",
      description: "",
    })
  }

  const saveEditing = async (expense: (typeof expenses)[number]) => {
    const nextAmount = Number(draft.amount)
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Enter a valid amount before saving.",
        variant: "destructive",
      })
      return
    }

    setSavingId(expense.id)
    try {
      const localCurrency = expense.localCurrency || userCurrency || "INR"
      let localAmount = nextAmount

      if (draft.currency && draft.currency !== localCurrency) {
        const data = await fetchExchangeRate(draft.currency, localCurrency, nextAmount)
        localAmount = data.rates[localCurrency]
      }

      updateExpense(expense.id, {
        amount: nextAmount,
        currency: draft.currency,
        category: draft.category,
        description: draft.description,
        localAmount,
        localCurrency,
      })

      setEditingId(null)
      toast({
        title: "Expense updated",
        description: "Your changes have been saved.",
      })
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Could not update this expense.",
        variant: "destructive",
      })
    } finally {
      setSavingId(null)
    }
  }

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
    setCurrentPage(1)
  }

  const sortLabel = (label: string, key: typeof sortKey) => {
    const indicator = sortKey === key ? (sortDir === "asc" ? "ASC" : "DESC") : ""
    return `${label} ${indicator}`.trim()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Expense History</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={exportToCSV}
            disabled={filteredExpenses.length === 0}
            title="Export to CSV"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={exportToJSON}
            disabled={filteredExpenses.length === 0}
            title="Export to JSON"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Select value={importMode} onValueChange={(value) => setImportMode(value as "merge" | "replace")}>
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue placeholder="Import mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="merge">Merge</SelectItem>
              <SelectItem value="replace">Replace</SelectItem>
            </SelectContent>
          </Select>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImport} hidden />
          <Button variant="outline" size="icon" onClick={handleImportClick} title="Import JSON">
            <Upload className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="text-destructive"
                disabled={expenses.length === 0}
                title="Clear History"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Expense History</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all your expense history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={clearExpenses}>Continue</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category === "all" ? "All Categories" : category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-full md:w-[140px]">
                <SelectValue placeholder="Rows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 rows</SelectItem>
                <SelectItem value="25">25 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="px-2" onClick={() => toggleSort("date")}>
                      {sortLabel("Date", "date")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="px-2" onClick={() => toggleSort("category")}>
                      {sortLabel("Category", "category")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="px-2" onClick={() => toggleSort("description")}>
                      {sortLabel("Description", "description")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="px-2" onClick={() => toggleSort("amount")}>
                      {sortLabel("Amount", "amount")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="px-2" onClick={() => toggleSort("localAmount")}>
                      {sortLabel(`${userCurrency || "Local"} Equivalent`, "localAmount")}
                    </Button>
                  </TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleExpenses.length > 0 ? (
                  visibleExpenses.map((expense) => {
                    const isEditing = editingId === expense.id
                    const isSaving = savingId === expense.id

                    return (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">{formatDate(expense.timestamp)}</TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Select
                              value={draft.category}
                              onValueChange={(value) => setDraft({ ...draft, category: value })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                              <SelectContent>
                                {EXPENSE_CATEGORIES.map((category) => (
                                  <SelectItem key={category} value={category}>
                                    {category}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            expense.category
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <Input
                              value={draft.description}
                              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                              className="h-8"
                            />
                          ) : (
                            expense.description
                          )}
                        </TableCell>
                        <TableCell>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={draft.amount}
                                onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                                className="h-8 w-24"
                              />
                              <Select
                                value={draft.currency}
                                onValueChange={(value) => setDraft({ ...draft, currency: value })}
                              >
                                <SelectTrigger className="h-8 w-[110px]">
                                  <SelectValue placeholder="Currency" />
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
                          ) : (
                            formatCurrency(expense.amount, expense.currency)
                          )}
                        </TableCell>
                        <TableCell>{formatCurrency(expense.localAmount, expense.localCurrency)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isEditing ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => saveEditing(expense)}
                                  className="h-8 w-8"
                                  disabled={isSaving}
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={cancelEditing} className="h-8 w-8">
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEditing(expense)}
                                  className="h-8 w-8"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteExpense(expense.id)}
                                  className="h-8 w-8"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">
                      {expenses.length === 0 ? "No expense history" : "No matching expenses found"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
      {sortedExpenses.length > 0 && (
        <div className="flex flex-col items-center gap-2 md:flex-row md:justify-between">
          <div className="text-sm text-muted-foreground">
            Page {currentPageSafe} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPageSafe === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPageSafe === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  </CardContent>
</Card>
  )
}

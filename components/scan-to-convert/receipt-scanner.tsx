"use client"

import type React from "react"

import { useEffect, useState, useRef } from "react"
import { useAppContext } from "@/context/app-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Camera, RefreshCw } from "lucide-react"
import { createWorker } from "tesseract.js"
import { fetchCurrencies, fetchExchangeRate } from "@/lib/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EXPENSE_CATEGORIES, suggestExpenseCategory } from "@/lib/expense-categories"

export function ReceiptScanner() {
  const { addExpense, userCurrency } = useAppContext()
  const [isLoading, setIsLoading] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("")
  const [category, setCategory] = useState("Other")
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [description, setDescription] = useState("")
  const [detectedTotalLine, setDetectedTotalLine] = useState<string | null>(null)
  const [currencies, setCurrencies] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleScan = async () => {
    if (!image) return

    setIsLoading(true)
    setExtractedText("")
    setAmount("")
    setCurrency("")
    setCategory("Other")
    setCategoryTouched(false)
    setDetectedTotalLine(null)

    try {
      const worker = await createWorker("eng")
      const { data } = await worker.recognize(image)
      setExtractedText(data.text)

      const rawText = data.text || ""

      const parseAmount = (value: string): number | null => {
        let cleaned = value.replace(/[^\d.,]/g, "")
        if (!cleaned) return null

        if (cleaned.includes(".") && cleaned.includes(",")) {
          if (cleaned.lastIndexOf(".") > cleaned.lastIndexOf(",")) {
            cleaned = cleaned.replace(/,/g, "")
          } else {
            cleaned = cleaned.replace(/\./g, "").replace(",", ".")
          }
        } else if (cleaned.includes(",")) {
          if (/,\d{1,2}$/.test(cleaned)) {
            cleaned = cleaned.replace(",", ".")
          } else {
            cleaned = cleaned.replace(/,/g, "")
          }
        }

        const parsed = Number(cleaned)
        return Number.isFinite(parsed) ? parsed : null
      }

      const amountPattern = /(?:[$€£¥₹]\s*)?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d{2})?/g
      const totalKeywords = ["total", "amount due", "grand total", "balance due", "amount", "payable"]

      const lines = rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

      const totalLineMatches: { value: number; line: string }[] = []
      for (const line of lines) {
        const lower = line.toLowerCase()
        if (!totalKeywords.some((keyword) => lower.includes(keyword))) continue

        const matches = line.match(amountPattern)
        if (!matches) continue

        for (const match of matches) {
          const parsed = parseAmount(match)
          if (parsed !== null) totalLineMatches.push({ value: parsed, line })
        }
      }

      if (totalLineMatches.length > 0) {
        const bestMatch = totalLineMatches.reduce((best, current) =>
          current.value > best.value ? current : best,
        )
        setAmount(bestMatch.value.toString())
        setDetectedTotalLine(bestMatch.line)
      } else {
        // Fallback: pick the largest number from the entire receipt
        const amountMatches = rawText.match(amountPattern)
        if (amountMatches && amountMatches.length > 0) {
          const parsedValues = amountMatches
            .map((value) => parseAmount(value))
            .filter((value): value is number => value !== null)
          if (parsedValues.length > 0) {
            const maxValue = Math.max(...parsedValues)
            setAmount(maxValue.toString())
            setDetectedTotalLine(null)
          }
        }
      }

      // Try to detect currency codes or symbols
      const codeMatch = rawText.match(/\b(USD|EUR|GBP|JPY|INR|CAD|AUD)\b/i)
      if (codeMatch) {
        setCurrency(codeMatch[1].toUpperCase())
      } else {
        const symbolMatch = rawText.match(/[$€£¥₹]/)
        if (symbolMatch) {
          const symbolMap: Record<string, string> = {
            "$": "USD",
            "€": "EUR",
            "£": "GBP",
            "¥": "JPY",
            "₹": "INR",
          }
          setCurrency(symbolMap[symbolMatch[0]] || "")
        }
      }

      if (!categoryTouched) {
        const suggestion = suggestExpenseCategory(rawText)
        if (suggestion) {
          setCategory(suggestion)
        }
      }

      await worker.terminate()

      toast({
        title: "Scan complete",
        description: "Text extracted from image",
      })
    } catch (error) {
      console.error("Receipt scan failed.", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to scan image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddExpense = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      })
      return
    }

    if (!currency) {
      toast({
        title: "Missing currency",
        description: "Please select a currency",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Convert to local currency if different
      const localCurrency = userCurrency || "INR"
      let localAmount = Number(amount)

      if (currency !== localCurrency) {
        const data = await fetchExchangeRate(currency, localCurrency, Number(amount))
        localAmount = data.rates[localCurrency]
      }

      addExpense({
        amount: Number(amount),
        currency,
        localAmount,
        localCurrency,
        category,
        description: description || "Scanned receipt",
        timestamp: Date.now(),
      })

      // Reset form
      setImage(null)
      setExtractedText("")
      setAmount("")
      setCurrency("")
      setCategory("Other")
      setCategoryTouched(false)
      setDescription("")
      setDetectedTotalLine(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

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

  const handleReset = () => {
    setImage(null)
    setExtractedText("")
    setAmount("")
    setCurrency("")
    setCategory("Other")
    setCategoryTouched(false)
    setDescription("")
    setDetectedTotalLine(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scan Receipt</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receipt-image">Upload Receipt Image</Label>
                <Input id="receipt-image" type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} />
              </div>

              {image && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="border rounded-md overflow-hidden">
                    <img src={image || "/placeholder.svg"} alt="Receipt preview" className="max-h-[200px] mx-auto" />
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={handleScan} disabled={isLoading} className="flex-1">
                      {isLoading ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Camera className="mr-2 h-4 w-4" />
                          Scan Receipt
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                      Reset
                    </Button>
                  </div>
                </div>
              )}

              {detectedTotalLine && (
                <div className="text-xs text-muted-foreground">
                  Detected total line: <span className="font-medium">{detectedTotalLine}</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
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

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    if (!categoryTouched) {
                      const suggestion = suggestExpenseCategory(e.target.value)
                      if (suggestion) setCategory(suggestion)
                    }
                  }}
                  placeholder="E.g., Lunch receipt"
                />
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
                    {EXPENSE_CATEGORIES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleAddExpense} disabled={isLoading || !amount || !currency} className="w-full mt-4">
                {isLoading ? "Processing..." : "Add as Expense"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useAppContext } from "@/context/app-context"
import { fetchMultiCurrencyRates, fetchCurrencies } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, Plus, X } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"

export function MultiCurrencyConverter() {
  const { fromCurrency, amount } = useAppContext()
  const [baseCurrency, setBaseCurrency] = useState(fromCurrency)
  const [baseAmount, setBaseAmount] = useState(amount)
  const [targetCurrencies, setTargetCurrencies] = useState<string[]>(["USD", "EUR", "GBP", "JPY", "CAD"])
  const [rates, setRates] = useState<Record<string, number>>({})
  const [currencies, setCurrencies] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")

  // Fetch available currencies on component mount
  useEffect(() => {
    const getCurrencies = async () => {
      try {
        const data = await fetchCurrencies()
        setCurrencies(data)
      } catch (error) {
        setError("Failed to load currencies")
      }
    }

    getCurrencies()
  }, [])

  // Update baseCurrency when fromCurrency changes
  useEffect(() => {
    setBaseCurrency(fromCurrency)
  }, [fromCurrency])

  // Update baseAmount when amount changes
  useEffect(() => {
    setBaseAmount(amount)
  }, [amount])

  // Fetch multi-currency rates
  useEffect(() => {
    const fetchRates = async () => {
      if (!baseCurrency || !baseAmount || targetCurrencies.length === 0) return

      setIsLoading(true)
      setError(null)

      try {
        const data = await fetchMultiCurrencyRates(baseCurrency, targetCurrencies)
        setRates(data.rates)
      } catch (error) {
        setError("Failed to fetch exchange rates")
      } finally {
        setIsLoading(false)
      }
    }

    fetchRates()
  }, [baseCurrency, baseAmount, targetCurrencies])

  const handleAddCurrency = (currency: string) => {
    if (!targetCurrencies.includes(currency) && currency !== baseCurrency) {
      setTargetCurrencies([...targetCurrencies, currency])
    }
    setValue("")
    setOpen(false)
  }

  const handleRemoveCurrency = (currency: string) => {
    setTargetCurrencies(targetCurrencies.filter((c) => c !== currency))
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Multi-Currency Converter</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="base-currency" className="text-sm font-medium">
                Base Currency
              </label>
              <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                <SelectTrigger id="base-currency">
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
              <label htmlFor="base-amount" className="text-sm font-medium">
                Amount
              </label>
              <Input
                id="base-amount"
                type="number"
                min="0"
                step="0.01"
                value={baseAmount}
                onChange={(e) => setBaseAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {targetCurrencies.map((currency) => (
              <div key={currency} className="flex items-center bg-muted rounded-md px-3 py-1">
                <span className="mr-1">{currency}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveCurrency(currency)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Currency
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search currency..." />
                  <CommandList>
                    <CommandEmpty>No currency found.</CommandEmpty>
                    <CommandGroup>
                      {Object.entries(currencies)
                        .filter(([code]) => !targetCurrencies.includes(code) && code !== baseCurrency)
                        .map(([code, name]) => (
                          <CommandItem key={code} value={code} onSelect={() => handleAddCurrency(code)}>
                            <Check className={cn("mr-2 h-4 w-4", value === code ? "opacity-100" : "opacity-0")} />
                            {code} - {name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="bg-destructive/10 text-destructive p-4 rounded-md">{error}</div>
          ) : Object.keys(rates).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(rates).map(([currency, rate]) => (
                <Card key={currency} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div className="font-medium">{currency}</div>
                      <div className="text-sm text-muted-foreground">{currencies[currency]}</div>
                    </div>
                    <div className="mt-2 text-2xl font-bold">{formatCurrency(rate * Number(baseAmount), currency)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      1 {baseCurrency} = {rate.toFixed(6)} {currency}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Currency</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Converted Amount</TableHead>
                  <TableHead className="text-right">Exchange Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    Select currencies and enter an amount to see conversions
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

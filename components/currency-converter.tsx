"use client"

import { useState, useEffect, useRef } from "react"
import { useAppContext } from "@/context/app-context"
import { fetchExchangeRate, fetchCurrencies } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Mic, ArrowRight, RotateCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { VoiceInput } from "@/components/voice-input"

export function CurrencyConverter() {
  const {
    fromCurrency,
    setFromCurrency,
    toCurrency,
    setToCurrency,
    amount,
    setAmount,
    addTransaction,
  } = useAppContext()

  const [currencies, setCurrencies] = useState<Record<string, string>>({})
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null)
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isVoiceInputActive, setIsVoiceInputActive] = useState(false)

  const lastConversionRef = useRef<string>("")
  const { toast } = useToast()

  // Fetch available currencies
  useEffect(() => {
    const getCurrencies = async () => {
      try {
        const data = await fetchCurrencies()
        setCurrencies(data)
      } catch {
        setError("Failed to load currencies. Please try again later.")
        toast({
          title: "Error",
          description: "Failed to load currencies. Please try again later.",
          variant: "destructive",
        })
      }
    }

    getCurrencies()
  }, [toast])

  // Convert currency on change
  useEffect(() => {
    const convertCurrency = async () => {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        setConvertedAmount(null)
        setExchangeRate(null)
        return
      }

      const conversionKey = `${fromCurrency}-${toCurrency}-${amount}`
      if (conversionKey === lastConversionRef.current) return
      lastConversionRef.current = conversionKey

      setIsLoading(true)
      setError(null)

      try {
        const data = await fetchExchangeRate(fromCurrency, toCurrency, Number(amount))
        const convertedValue = data.rates[toCurrency]
        const rate = convertedValue / Number(amount)

        setConvertedAmount(convertedValue)
        setExchangeRate(rate)

        addTransaction({
          fromCurrency,
          toCurrency,
          amount: Number(amount),
          convertedAmount: convertedValue,
          exchangeRate: rate,
          timestamp: Date.now(),
        })
      } catch {
        setError("Failed to convert currency. Please try again later.")
        toast({
          title: "Error",
          description: "Failed to convert currency. Please try again later.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    const timeoutId = setTimeout(() => {
      if (fromCurrency && toCurrency && amount) {
        convertCurrency()
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [amount, fromCurrency, toCurrency, addTransaction, toast])

  const handleSwapCurrencies = () => {
    setFromCurrency(toCurrency)
    setToCurrency(fromCurrency)
  }

  const handleVoiceInput = (transcript: string) => {
    const numberMatch = transcript.match(/\d+(\.\d+)?/)
    if (numberMatch) {
      setAmount(numberMatch[0])
    }

    const currencyNames = Object.entries(currencies)

    for (const [code, name] of currencyNames) {
      const lowerName = name.toLowerCase()
      const lowerTranscript = transcript.toLowerCase()

      if (lowerTranscript.includes(lowerName)) {
        if (lowerTranscript.includes(`from ${lowerName}`)) {
          setFromCurrency(code)
        } else if (lowerTranscript.includes(`to ${lowerName}`)) {
          setToCurrency(code)
        } else {
          setToCurrency(code)
        }
      }
    }
  }

  return (
    <Card id="converter" className="w-full">
      <CardHeader>
        <CardTitle>Currency Converter</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <label htmlFor="amount" className="text-sm font-medium">
              Amount
            </label>
            <div className="flex space-x-2">
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsVoiceInputActive(true)}
                title="Voice Input"
              >
                <Mic className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
            <div className="space-y-2">
              <label htmlFor="from-currency" className="text-sm font-medium">
                From
              </label>
              <Select value={fromCurrency} onValueChange={setFromCurrency}>
                <SelectTrigger id="from-currency">
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

            <Button variant="ghost" size="icon" onClick={handleSwapCurrencies} className="mt-6">
              <RotateCw className="h-4 w-4" />
              <span className="sr-only">Swap currencies</span>
            </Button>

            <div className="space-y-2">
              <label htmlFor="to-currency" className="text-sm font-medium">
                To
              </label>
              <Select value={toCurrency} onValueChange={setToCurrency}>
                <SelectTrigger id="to-currency">
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

          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="bg-destructive/10 text-destructive p-4 rounded-md">{error}</div>
          ) : convertedAmount !== null ? (
            <div className="bg-muted p-4 rounded-md space-y-2">
              <div className="flex justify-between items-center">
                <span>{formatCurrency(Number(amount), fromCurrency)}</span>
                <ArrowRight className="h-4 w-4 mx-2" />
                <span className="font-bold">{formatCurrency(convertedAmount, toCurrency)}</span>
              </div>
              {exchangeRate && (
                <div className="text-sm text-muted-foreground">
                  1 {fromCurrency} = {exchangeRate.toFixed(6)} {toCurrency}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </CardContent>

      {isVoiceInputActive && (
        <VoiceInput onResult={handleVoiceInput} onClose={() => setIsVoiceInputActive(false)} />
      )}
    </Card>
  )
}

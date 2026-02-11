export interface Transaction {
  fromCurrency: string
  toCurrency: string
  amount: number
  convertedAmount: number
  exchangeRate: number
  timestamp: number
}

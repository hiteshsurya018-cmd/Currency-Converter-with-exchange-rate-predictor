const API_BASE_URL = "https://api.frankfurter.app"

export async function fetchExchangeRate(from: string, to: string, amount: number) {
  try {
    const response = await fetch(`${API_BASE_URL}/latest?from=${from}&to=${to}&amount=${amount}`)

    if (!response.ok) {
      throw new Error("Failed to fetch exchange rate")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching exchange rate:", error)
    throw error
  }
}

export async function fetchHistoricalRates(from: string, to: string, startDate: string, endDate: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/${startDate}..${endDate}?from=${from}&to=${to}`)

    if (!response.ok) {
      throw new Error("Failed to fetch historical rates")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching historical rates:", error)
    throw error
  }
}

export async function fetchCurrencies() {
  try {
    const response = await fetch(`${API_BASE_URL}/currencies`)

    if (!response.ok) {
      throw new Error("Failed to fetch currencies")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching currencies:", error)
    throw error
  }
}

export async function fetchMultiCurrencyRates(from: string, to: string[]) {
  try {
    const response = await fetch(`${API_BASE_URL}/latest?from=${from}&to=${to.join(",")}`)

    if (!response.ok) {
      throw new Error("Failed to fetch multi-currency rates")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching multi-currency rates:", error)
    throw error
  }
}

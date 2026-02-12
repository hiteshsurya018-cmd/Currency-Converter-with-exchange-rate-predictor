import { MainLayout } from "@/components/layouts/main-layout"
import { CurrencyConverter } from "@/components/currency-converter"
import { HistoricalChart } from "@/components/historical-chart"
import { MultiCurrencyConverter } from "@/components/multi-currency-converter"

export default function Home() {
  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Exchange Rate Predictor</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <CurrencyConverter />
          <HistoricalChart />
        </div>
        <div className="mt-8">
          <MultiCurrencyConverter />
        </div>
      </div>
    </MainLayout>
  )
}

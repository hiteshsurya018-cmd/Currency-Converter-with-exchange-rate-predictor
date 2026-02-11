import { MainLayout } from "@/components/layouts/main-layout"
import { PredictionRates } from "@/components/prediction-rates"

export default function PredictionPage() {
  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Prediction Rates</h1>
        <PredictionRates />
      </div>
    </MainLayout>
  )
}

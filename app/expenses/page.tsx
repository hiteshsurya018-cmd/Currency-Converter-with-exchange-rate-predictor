"use client"

import { useAppContext } from "@/context/app-context"
import { ExpenseForm } from "@/components/expense-tracker/expense-form"
import { ExpenseList } from "@/components/expense-tracker/expense-list"
import { ExpenseChart } from "@/components/expense-tracker/expense-chart"
import { MainLayout } from "@/components/layouts/main-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ReceiptScanner } from "@/components/scan-to-convert/receipt-scanner"
import { ExpenseSummary } from "@/components/expense-tracker/expense-summary"

export default function ExpensesPage() {
  const { userCountry, userCurrency } = useAppContext()

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <h1 className="text-3xl font-bold">Expense Tracker</h1>
          {userCountry && userCurrency && (
            <div className="text-sm text-muted-foreground mt-2 md:mt-0">
              Detected location: {userCountry} ({userCurrency})
            </div>
          )}
        </div>

        <Tabs defaultValue="log" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="log">Log Expense</TabsTrigger>
            <TabsTrigger value="scan">Scan Receipt</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="log" className="space-y-8">
            <ExpenseSummary />
            <ExpenseForm />
            <ExpenseList />
          </TabsContent>
          <TabsContent value="scan">
            <ReceiptScanner />
          </TabsContent>
          <TabsContent value="analytics">
            <ExpenseChart />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}

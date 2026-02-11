"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TransactionHistory } from "@/components/transaction-history"
import { Home, History, CreditCard } from "lucide-react"

interface SidebarProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const [activeTab, setActiveTab] = useState("home")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden border-r bg-card md:block md:w-64">
        <div className="flex h-16 items-center border-b px-4">
          <h2 className="text-lg font-semibold">Currency Converter</h2>
        </div>
        <div className="py-4">
          <Tabs defaultValue="home" className="w-full" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="home">Home</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="home" className="p-4">
              <nav className="flex flex-col gap-2">
                <Button variant="ghost" className="justify-start" asChild>
                  <a href="/">
                    <Home className="mr-2 h-4 w-4" />
                    Converter
                  </a>
                </Button>
                <Button variant="ghost" className="justify-start" asChild>
                  <a href="#chart">
                    <History className="mr-2 h-4 w-4" />
                    Historical Chart
                  </a>
                </Button>
                <Button variant="ghost" className="justify-start" asChild>
                  <a href="/expenses">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Expense Tracker
                  </a>
                </Button>
                <Button variant="ghost" className="justify-start" asChild>
                  <a href="/prediction">
                    <History className="mr-2 h-4 w-4" />
                    Prediction Rates
                  </a>
                </Button>
              </nav>
            </TabsContent>
            <TabsContent value="history" className="p-0">
              <TransactionHistory />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Mobile sidebar */}
      {mounted && (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex h-16 items-center border-b px-4">
              <h2 className="text-lg font-semibold">Currency Converter</h2>
            </div>
            <div className="py-4">
              <Tabs defaultValue="home" className="w-full" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="home">Home</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                <TabsContent value="home" className="p-4">
                  <nav className="flex flex-col gap-2">
                    <Button variant="ghost" className="justify-start" asChild>
                      <a href="/">
                        <Home className="mr-2 h-4 w-4" />
                        Converter
                      </a>
                    </Button>
                    <Button variant="ghost" className="justify-start" asChild>
                      <a href="#chart">
                        <History className="mr-2 h-4 w-4" />
                        Historical Chart
                      </a>
                    </Button>
                    <Button variant="ghost" className="justify-start" asChild>
                      <a href="/expenses">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Expense Tracker
                      </a>
                    </Button>
                    <Button variant="ghost" className="justify-start" asChild>
                      <a href="/prediction">
                        <History className="mr-2 h-4 w-4" />
                        Prediction Rates
                      </a>
                    </Button>
                  </nav>
                </TabsContent>
                <TabsContent value="history" className="p-0">
                  <TransactionHistory />
                </TabsContent>
              </Tabs>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}

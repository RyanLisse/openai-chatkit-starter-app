'use client'

import { BotDashboard } from '@/components/bot-dashboard'
import { TradingHistory } from '@/components/trading-history'

export default function DashboardPage() {
  // In production, get this from authentication
  const botConfigId = 'demo-bot-id'
  const userId = 'demo-user-id'

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Sniping Bot Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor and control your automated trading bot
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <BotDashboard botConfigId={botConfigId} />
        <TradingHistory userId={userId} botConfigId={botConfigId} />
      </div>
    </div>
  )
}

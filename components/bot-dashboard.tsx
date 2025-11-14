'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PlayIcon, PauseIcon, StopIcon } from 'lucide-react'
import { useState } from 'react'

interface BotStatus {
  botConfigId: string
  status: 'idle' | 'running' | 'paused' | 'error'
  name: string
  useAI: boolean
  maxTradeAmount: string
  minTradeAmount: string
  stopLossPercentage?: string
  takeProfitPercentage?: string
  maxDailyTrades?: number
  maxConcurrentTrades: number
  updatedAt: string
}

interface BotDashboardProps {
  botConfigId: string
}

export function BotDashboard({ botConfigId }: BotDashboardProps) {
  const queryClient = useQueryClient()

  // Fetch bot status
  const { data: botStatus, isLoading } = useQuery<BotStatus>({
    queryKey: ['bot-status', botConfigId],
    queryFn: async () => {
      const res = await fetch(`/api/bot/status?botConfigId=${botConfigId}`)
      if (!res.ok) throw new Error('Failed to fetch bot status')
      return res.json()
    },
    refetchInterval: 5000, // Refetch every 5 seconds
  })

  // Start bot mutation
  const startBot = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botConfigId }),
      })
      if (!res.ok) throw new Error('Failed to start bot')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-status', botConfigId] })
    },
  })

  // Stop bot mutation
  const stopBot = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/bot/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botConfigId }),
      })
      if (!res.ok) throw new Error('Failed to stop bot')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-status', botConfigId] })
    },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-500">Running</Badge>
      case 'paused':
        return <Badge className="bg-yellow-500">Paused</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="secondary">Idle</Badge>
    }
  }

  if (isLoading) {
    return <div>Loading bot status...</div>
  }

  if (!botStatus) {
    return <div>Bot not found</div>
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{botStatus.name}</CardTitle>
              <CardDescription>AI Sniping Bot Configuration</CardDescription>
            </div>
            {getStatusBadge(botStatus.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Bot Controls */}
            <div className="flex gap-2">
              <Button
                onClick={() => startBot.mutate()}
                disabled={botStatus.status === 'running' || startBot.isPending}
                size="sm"
              >
                <PlayIcon className="mr-2 h-4 w-4" />
                Start
              </Button>
              <Button
                onClick={() => stopBot.mutate()}
                disabled={botStatus.status === 'idle' || stopBot.isPending}
                variant="destructive"
                size="sm"
              >
                <StopIcon className="mr-2 h-4 w-4" />
                Stop
              </Button>
            </div>

            {/* Bot Configuration */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">AI Enabled</p>
                <p className="text-lg font-semibold">
                  {botStatus.useAI ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Max Trade Amount</p>
                <p className="text-lg font-semibold">${botStatus.maxTradeAmount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Min Trade Amount</p>
                <p className="text-lg font-semibold">${botStatus.minTradeAmount}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Max Concurrent Trades</p>
                <p className="text-lg font-semibold">{botStatus.maxConcurrentTrades}</p>
              </div>
              {botStatus.stopLossPercentage && (
                <div>
                  <p className="text-sm text-muted-foreground">Stop Loss</p>
                  <p className="text-lg font-semibold">{botStatus.stopLossPercentage}%</p>
                </div>
              )}
              {botStatus.takeProfitPercentage && (
                <div>
                  <p className="text-sm text-muted-foreground">Take Profit</p>
                  <p className="text-lg font-semibold">{botStatus.takeProfitPercentage}%</p>
                </div>
              )}
              {botStatus.maxDailyTrades && (
                <div>
                  <p className="text-sm text-muted-foreground">Max Daily Trades</p>
                  <p className="text-lg font-semibold">{botStatus.maxDailyTrades}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

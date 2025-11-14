'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

interface Trade {
  id: string
  symbol: string
  type: 'buy' | 'sell'
  status: string
  price: string
  amount: string
  filled: string
  profitLoss?: string
  profitLossPercentage?: string
  executedAt?: string
  createdAt: string
}

interface TradingHistoryProps {
  userId?: string
  botConfigId?: string
  limit?: number
}

export function TradingHistory({ userId, botConfigId, limit = 50 }: TradingHistoryProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['trades', userId, botConfigId, limit],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (userId) params.append('userId', userId)
      if (botConfigId) params.append('botConfigId', botConfigId)
      params.append('limit', limit.toString())

      const res = await fetch(`/api/trades?${params}`)
      if (!res.ok) throw new Error('Failed to fetch trades')
      return res.json()
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'executed':
        return <Badge className="bg-green-500">Executed</Badge>
      case 'pending':
        return <Badge className="bg-yellow-500">Pending</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    return type === 'buy' ? (
      <Badge className="bg-blue-500">Buy</Badge>
    ) : (
      <Badge className="bg-orange-500">Sell</Badge>
    )
  }

  if (isLoading) {
    return <div>Loading trading history...</div>
  }

  const trades: Trade[] = data?.trades || []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trading History</CardTitle>
        <CardDescription>Recent trades executed by the bot</CardDescription>
      </CardHeader>
      <CardContent>
        {trades.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trades yet</p>
        ) : (
          <div className="space-y-4">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{trade.symbol}</span>
                    {getTypeBadge(trade.type)}
                    {getStatusBadge(trade.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {trade.executedAt
                      ? formatDistanceToNow(new Date(trade.executedAt), {
                          addSuffix: true,
                        })
                      : formatDistanceToNow(new Date(trade.createdAt), {
                          addSuffix: true,
                        })}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div>
                    <span className="text-sm text-muted-foreground">Price: </span>
                    <span className="font-semibold">${parseFloat(trade.price).toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Amount: </span>
                    <span className="font-semibold">{parseFloat(trade.amount).toFixed(4)}</span>
                  </div>
                  {trade.profitLoss && (
                    <div>
                      <span
                        className={`font-semibold ${
                          parseFloat(trade.profitLoss) >= 0
                            ? 'text-green-500'
                            : 'text-red-500'
                        }`}
                      >
                        {parseFloat(trade.profitLoss) >= 0 ? '+' : ''}
                        ${parseFloat(trade.profitLoss).toFixed(2)} (
                        {parseFloat(trade.profitLossPercentage || '0').toFixed(2)}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

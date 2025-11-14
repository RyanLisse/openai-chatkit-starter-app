import { z } from 'zod';

// Order types
export const OrderSideSchema = z.enum(['buy', 'sell']);
export const OrderTypeSchema = z.enum(['market', 'limit', 'stop_market', 'stop_limit']);
export const OrderStatusSchema = z.enum(['open', 'closed', 'canceled', 'expired', 'rejected']);

export type OrderSide = z.infer<typeof OrderSideSchema>;
export type OrderType = z.infer<typeof OrderTypeSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

// Market data types
export interface Ticker {
  symbol: string;
  timestamp: number;
  datetime: string;
  high: number;
  low: number;
  bid: number;
  ask: number;
  last: number;
  close: number;
  baseVolume: number;
  quoteVolume: number;
  change: number;
  percentage: number;
  average: number;
}

export interface OrderBook {
  symbol: string;
  timestamp: number;
  datetime: string;
  bids: [number, number][]; // [price, amount]
  asks: [number, number][]; // [price, amount]
}

export interface Trade {
  id: string;
  timestamp: number;
  datetime: string;
  symbol: string;
  order: string;
  type: OrderType;
  side: OrderSide;
  price: number;
  amount: number;
  cost: number;
  fee?: {
    cost: number;
    currency: string;
  };
}

export interface Order {
  id: string;
  clientOrderId?: string;
  timestamp: number;
  datetime: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  price: number;
  amount: number;
  cost: number;
  average?: number;
  filled: number;
  remaining: number;
  status: OrderStatus;
  fee?: {
    cost: number;
    currency: string;
  };
  trades?: Trade[];
}

export interface Balance {
  free: number;
  used: number;
  total: number;
}

export interface Balances {
  [currency: string]: Balance;
}

// WebSocket message types
export interface TickerUpdate {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
}

export interface OrderBookUpdate {
  symbol: string;
  bids: [number, number][];
  asks: [number, number][];
  timestamp: number;
}

export interface TradeUpdate {
  symbol: string;
  price: number;
  amount: number;
  side: OrderSide;
  timestamp: number;
}

// Sniping bot types
export interface SnipeTarget {
  symbol: string;
  listingTime: number;
  initialPrice?: number;
  liquidity?: number;
  confidence: number;
  aiReasoning?: string;
}

export interface BotConfig {
  id: string;
  maxTradeAmount: number;
  minTradeAmount: number;
  stopLossPercentage?: number;
  takeProfitPercentage?: number;
  maxDailyTrades?: number;
  maxConcurrentTrades: number;
  useAI: boolean;
  aiModel?: string;
  confidenceThreshold: number;
}

export interface TradingStrategy {
  id: string;
  name: string;
  type: 'snipe_new_listings' | 'pump_detector' | 'arbitrage' | 'custom';
  parameters: Record<string, any>;
}

// AI analysis types
export interface AIAnalysis {
  confidence: number;
  recommendation: 'buy' | 'sell' | 'hold' | 'skip';
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
  metadata?: Record<string, any>;
}

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { TickerUpdate, OrderBookUpdate, TradeUpdate } from '@/lib/types/trading';

export interface WebSocketConfig {
  url?: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export class MEXCWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private subscribedSymbols = new Set<string>();
  private pingInterval: NodeJS.Timeout | null = null;

  private readonly url: string;
  private readonly reconnectDelay: number;
  private readonly maxReconnectAttempts: number;

  constructor(config: WebSocketConfig = {}) {
    super();
    this.url = config.url || 'wss://wbs.mexc.com/ws';
    this.reconnectDelay = config.reconnectDelay || 5000;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
  }

  /**
   * Connect to MEXC WebSocket
   */
  connect(): void {
    if (this.ws && this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log('MEXC WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');

        // Setup ping/pong to keep connection alive
        this.setupPingPong();

        // Resubscribe to symbols if reconnecting
        if (this.subscribedSymbols.size > 0) {
          this.subscribedSymbols.forEach((symbol) => {
            this.subscribeToTicker(symbol);
          });
        }
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      });

      this.ws.on('close', () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.emit('disconnected');
        this.cleanup();
        this.attemptReconnect();
      });

      this.ws.on('pong', () => {
        // Connection is alive
      });
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.attemptReconnect();
    }
  }

  /**
   * Setup ping/pong to keep connection alive
   */
  private setupPingPong(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        this.ws.ping();
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: any): void {
    if (!message) return;

    // Handle different message types from MEXC
    if (message.c) {
      // Channel message
      const channel = message.c;

      if (channel.includes('spot@public.deals.v3.api')) {
        // Trade update
        this.handleTradeUpdate(message);
      } else if (channel.includes('spot@public.increase.depth.v3.api')) {
        // Order book update
        this.handleOrderBookUpdate(message);
      } else if (channel.includes('spot@public.miniTickers.v3.api')) {
        // Ticker update
        this.handleTickerUpdate(message);
      }
    }
  }

  /**
   * Handle ticker updates
   */
  private handleTickerUpdate(message: any): void {
    if (!message.d) return;

    const data = message.d;
    const update: TickerUpdate = {
      symbol: data.s,
      price: parseFloat(data.c),
      volume: parseFloat(data.v),
      timestamp: data.t,
    };

    this.emit('ticker', update);
    this.emit(`ticker:${update.symbol}`, update);
  }

  /**
   * Handle order book updates
   */
  private handleOrderBookUpdate(message: any): void {
    if (!message.d) return;

    const data = message.d;
    const update: OrderBookUpdate = {
      symbol: data.s,
      bids: data.bids?.map((b: any) => [parseFloat(b.p), parseFloat(b.v)]) || [],
      asks: data.asks?.map((a: any) => [parseFloat(a.p), parseFloat(a.v)]) || [],
      timestamp: data.t,
    };

    this.emit('orderbook', update);
    this.emit(`orderbook:${update.symbol}`, update);
  }

  /**
   * Handle trade updates
   */
  private handleTradeUpdate(message: any): void {
    if (!message.d || !message.d.deals) return;

    const data = message.d;
    data.deals.forEach((trade: any) => {
      const update: TradeUpdate = {
        symbol: data.s,
        price: parseFloat(trade.p),
        amount: parseFloat(trade.v),
        side: trade.S === 1 ? 'buy' : 'sell',
        timestamp: trade.t,
      };

      this.emit('trade', update);
      this.emit(`trade:${update.symbol}`, update);
    });
  }

  /**
   * Subscribe to ticker updates for a symbol
   */
  subscribeToTicker(symbol: string): void {
    if (!this.ws || !this.isConnected) {
      console.error('WebSocket not connected');
      return;
    }

    const formattedSymbol = symbol.replace('/', '').toUpperCase();
    this.subscribedSymbols.add(symbol);

    const subscribeMessage = {
      method: 'SUBSCRIPTION',
      params: [`spot@public.miniTickers.v3.api@${formattedSymbol}`],
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log(`Subscribed to ticker: ${symbol}`);
  }

  /**
   * Subscribe to order book updates for a symbol
   */
  subscribeToOrderBook(symbol: string): void {
    if (!this.ws || !this.isConnected) {
      console.error('WebSocket not connected');
      return;
    }

    const formattedSymbol = symbol.replace('/', '').toUpperCase();
    this.subscribedSymbols.add(symbol);

    const subscribeMessage = {
      method: 'SUBSCRIPTION',
      params: [`spot@public.increase.depth.v3.api@${formattedSymbol}`],
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log(`Subscribed to order book: ${symbol}`);
  }

  /**
   * Subscribe to trade updates for a symbol
   */
  subscribeToTrades(symbol: string): void {
    if (!this.ws || !this.isConnected) {
      console.error('WebSocket not connected');
      return;
    }

    const formattedSymbol = symbol.replace('/', '').toUpperCase();
    this.subscribedSymbols.add(symbol);

    const subscribeMessage = {
      method: 'SUBSCRIPTION',
      params: [`spot@public.deals.v3.api@${formattedSymbol}`],
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log(`Subscribed to trades: ${symbol}`);
  }

  /**
   * Unsubscribe from a symbol
   */
  unsubscribe(symbol: string): void {
    if (!this.ws || !this.isConnected) {
      console.error('WebSocket not connected');
      return;
    }

    const formattedSymbol = symbol.replace('/', '').toUpperCase();
    this.subscribedSymbols.delete(symbol);

    const unsubscribeMessage = {
      method: 'UNSUBSCRIPTION',
      params: [
        `spot@public.miniTickers.v3.api@${formattedSymbol}`,
        `spot@public.increase.depth.v3.api@${formattedSymbol}`,
        `spot@public.deals.v3.api@${formattedSymbol}`,
      ],
    };

    this.ws.send(JSON.stringify(unsubscribeMessage));
    console.log(`Unsubscribed from: ${symbol}`);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.cleanup();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.subscribedSymbols.clear();
    this.reconnectAttempts = 0;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get subscribed symbols
   */
  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }
}

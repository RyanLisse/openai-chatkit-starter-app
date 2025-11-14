import ccxt from 'ccxt';
import type { Order, Ticker, OrderBook, Balance, Balances, OrderSide, OrderType } from '@/lib/types/trading';
import { Effect, Console } from 'effect';

export interface MEXCCredentials {
  apiKey: string;
  secret: string;
  testnet?: boolean;
}

export class MEXCService {
  private exchange: ccxt.mexc;

  constructor(credentials: MEXCCredentials) {
    this.exchange = new ccxt.mexc({
      apiKey: credentials.apiKey,
      secret: credentials.secret,
      enableRateLimit: true,
      options: {
        defaultType: 'spot',
      },
    });

    if (credentials.testnet) {
      this.exchange.setSandboxMode(true);
    }
  }

  /**
   * Fetch all available markets on MEXC
   */
  async loadMarkets() {
    return await this.exchange.loadMarkets();
  }

  /**
   * Get ticker data for a symbol
   */
  async getTicker(symbol: string): Promise<Ticker> {
    const ticker = await this.exchange.fetchTicker(symbol);
    return ticker as Ticker;
  }

  /**
   * Get tickers for multiple symbols
   */
  async getTickers(symbols?: string[]): Promise<Record<string, Ticker>> {
    const tickers = await this.exchange.fetchTickers(symbols);
    return tickers as Record<string, Ticker>;
  }

  /**
   * Get order book for a symbol
   */
  async getOrderBook(symbol: string, limit: number = 20): Promise<OrderBook> {
    const orderBook = await this.exchange.fetchOrderBook(symbol, limit);
    return orderBook as OrderBook;
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<Balances> {
    const balance = await this.exchange.fetchBalance();
    return balance as Balances;
  }

  /**
   * Create a market buy order
   */
  async createMarketBuyOrder(symbol: string, amount: number): Promise<Order> {
    const order = await this.exchange.createMarketBuyOrder(symbol, amount);
    return order as Order;
  }

  /**
   * Create a market sell order
   */
  async createMarketSellOrder(symbol: string, amount: number): Promise<Order> {
    const order = await this.exchange.createMarketSellOrder(symbol, amount);
    return order as Order;
  }

  /**
   * Create a limit order
   */
  async createLimitOrder(
    symbol: string,
    side: OrderSide,
    amount: number,
    price: number
  ): Promise<Order> {
    const order = await this.exchange.createOrder(symbol, 'limit', side, amount, price);
    return order as Order;
  }

  /**
   * Create a market order
   */
  async createMarketOrder(
    symbol: string,
    side: OrderSide,
    amount: number
  ): Promise<Order> {
    const order = await this.exchange.createOrder(symbol, 'market', side, amount);
    return order as Order;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, symbol: string): Promise<Order> {
    const order = await this.exchange.cancelOrder(orderId, symbol);
    return order as Order;
  }

  /**
   * Get order status
   */
  async getOrder(orderId: string, symbol: string): Promise<Order> {
    const order = await this.exchange.fetchOrder(orderId, symbol);
    return order as Order;
  }

  /**
   * Get open orders
   */
  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const orders = await this.exchange.fetchOpenOrders(symbol);
    return orders as Order[];
  }

  /**
   * Get closed orders
   */
  async getClosedOrders(symbol?: string, since?: number, limit?: number): Promise<Order[]> {
    const orders = await this.exchange.fetchClosedOrders(symbol, since, limit);
    return orders as Order[];
  }

  /**
   * Get recent trades
   */
  async getTrades(symbol: string, since?: number, limit?: number) {
    return await this.exchange.fetchTrades(symbol, since, limit);
  }

  /**
   * Get my trades
   */
  async getMyTrades(symbol?: string, since?: number, limit?: number) {
    return await this.exchange.fetchMyTrades(symbol, since, limit);
  }

  /**
   * Get OHLCV data
   */
  async getOHLCV(
    symbol: string,
    timeframe: string = '1m',
    since?: number,
    limit?: number
  ) {
    return await this.exchange.fetchOHLCV(symbol, timeframe, since, limit);
  }

  /**
   * Detect new listings on MEXC
   * This checks for recently added trading pairs
   */
  async detectNewListings(): Promise<string[]> {
    try {
      const markets = await this.exchange.loadMarkets(true); // Force reload
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      const newListings: string[] = [];

      for (const [symbol, market] of Object.entries(markets)) {
        // CCXT doesn't always provide listing date, so we'll check trading activity
        // In production, you'd want to use MEXC's API endpoint for new listings
        if (market.active) {
          const ticker = await this.getTicker(symbol);
          // If volume is very recent and high, it might be a new listing
          if (ticker.timestamp > oneDayAgo && ticker.quoteVolume > 0) {
            newListings.push(symbol);
          }
        }
      }

      return newListings;
    } catch (error) {
      console.error('Error detecting new listings:', error);
      return [];
    }
  }

  /**
   * Calculate optimal buy amount based on liquidity
   */
  async calculateOptimalBuyAmount(
    symbol: string,
    maxAmount: number,
    slippageTolerance: number = 0.01
  ): Promise<number> {
    try {
      const orderBook = await this.getOrderBook(symbol, 50);
      let totalCost = 0;
      let totalAmount = 0;
      const initialPrice = orderBook.asks[0][0];

      for (const [price, amount] of orderBook.asks) {
        const slippage = (price - initialPrice) / initialPrice;
        if (slippage > slippageTolerance) break;

        const cost = price * amount;
        if (totalCost + cost > maxAmount) {
          // Calculate partial fill
          const remainingAmount = (maxAmount - totalCost) / price;
          totalAmount += remainingAmount;
          break;
        }

        totalCost += cost;
        totalAmount += amount;
      }

      return totalAmount;
    } catch (error) {
      console.error('Error calculating optimal buy amount:', error);
      throw error;
    }
  }

  /**
   * Get liquidity score for a symbol (0-100)
   */
  async getLiquidityScore(symbol: string): Promise<number> {
    try {
      const [orderBook, ticker] = await Promise.all([
        this.getOrderBook(symbol, 100),
        this.getTicker(symbol),
      ]);

      // Calculate liquidity based on order book depth and volume
      const bidLiquidity = orderBook.bids.reduce((sum, [price, amount]) => sum + price * amount, 0);
      const askLiquidity = orderBook.asks.reduce((sum, [price, amount]) => sum + price * amount, 0);
      const avgLiquidity = (bidLiquidity + askLiquidity) / 2;

      // Normalize to 0-100 scale (this is a simplified approach)
      const volumeScore = Math.min(ticker.quoteVolume / 1000000, 1) * 50; // Up to 50 points for volume
      const depthScore = Math.min(avgLiquidity / 100000, 1) * 50; // Up to 50 points for depth

      return Math.round(volumeScore + depthScore);
    } catch (error) {
      console.error('Error calculating liquidity score:', error);
      return 0;
    }
  }

  /**
   * Close the exchange connection
   */
  async close() {
    if (this.exchange) {
      await this.exchange.close();
    }
  }
}

/**
 * Effect-based MEXC service for functional error handling
 */
export const createMEXCService = (credentials: MEXCCredentials) =>
  Effect.try({
    try: () => new MEXCService(credentials),
    catch: (error) => new Error(`Failed to create MEXC service: ${error}`),
  });

/**
 * Fetch ticker with Effect
 */
export const fetchTicker = (service: MEXCService, symbol: string) =>
  Effect.tryPromise({
    try: () => service.getTicker(symbol),
    catch: (error) => new Error(`Failed to fetch ticker for ${symbol}: ${error}`),
  });

/**
 * Create order with Effect
 */
export const createOrder = (
  service: MEXCService,
  symbol: string,
  side: OrderSide,
  amount: number,
  price?: number
) =>
  Effect.tryPromise({
    try: () =>
      price
        ? service.createLimitOrder(symbol, side, amount, price)
        : service.createMarketOrder(symbol, side, amount),
    catch: (error) => new Error(`Failed to create order: ${error}`),
  });

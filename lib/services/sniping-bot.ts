import { EventEmitter } from 'events';
import { MEXCService } from './mexc-service';
import { MEXCWebSocketService } from './websocket-service';
import { AITradingService, type TradingContext } from './ai-trading-service';
import { db } from '@/lib/db';
import { trades, botLogs, botConfigs, marketSnapshots } from '@/lib/db/schema';
import { eq, and, gte, lt, count } from 'drizzle-orm';
import type { BotConfig, SnipeTarget } from '@/lib/types/trading';

export interface SnipingBotConfig {
  botConfigId: string;
  userId: string;
  mexcService: MEXCService;
  aiService: AITradingService;
  config: BotConfig;
}

export type BotStatus = 'idle' | 'running' | 'paused' | 'error';
export type BotEvent =
  | 'started'
  | 'stopped'
  | 'paused'
  | 'resumed'
  | 'newListingDetected'
  | 'tradeExecuted'
  | 'tradeAnalyzed'
  | 'error'
  | 'statusChanged';

export class SnipingBot extends EventEmitter {
  private botConfigId: string;
  private userId: string;
  private mexcService: MEXCService;
  private wsService: MEXCWebSocketService;
  private aiService: AITradingService;
  private config: BotConfig;
  private status: BotStatus = 'idle';
  private isRunning = false;
  private detectionInterval: NodeJS.Timeout | null = null;
  private monitoredSymbols = new Set<string>();
  private activeTrades = new Map<string, any>();
  private dailyTradeCount = 0;
  private lastTradeReset = Date.now();

  constructor(botConfig: SnipingBotConfig) {
    super();
    this.botConfigId = botConfig.botConfigId;
    this.userId = botConfig.userId;
    this.mexcService = botConfig.mexcService;
    this.aiService = botConfig.aiService;
    this.config = botConfig.config;
    this.wsService = new MEXCWebSocketService();
  }

  /**
   * Start the sniping bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Bot is already running');
      return;
    }

    try {
      await this.log('info', 'Starting sniping bot');

      this.isRunning = true;
      this.status = 'running';
      this.emit('started');
      this.emit('statusChanged', this.status);

      // Connect to WebSocket for real-time updates
      this.wsService.connect();
      this.setupWebSocketListeners();

      // Start detecting new listings
      this.startListingDetection();

      // Update bot status in database
      await db
        .update(botConfigs)
        .set({ status: 'running', updatedAt: new Date() })
        .where(eq(botConfigs.id, this.botConfigId));

      await this.log('info', 'Sniping bot started successfully');
    } catch (error) {
      await this.log('error', `Failed to start bot: ${error}`);
      this.handleError(error);
    }
  }

  /**
   * Stop the sniping bot
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Bot is not running');
      return;
    }

    try {
      await this.log('info', 'Stopping sniping bot');

      this.isRunning = false;
      this.status = 'idle';
      this.emit('stopped');
      this.emit('statusChanged', this.status);

      // Stop detection
      if (this.detectionInterval) {
        clearInterval(this.detectionInterval);
        this.detectionInterval = null;
      }

      // Disconnect WebSocket
      this.wsService.disconnect();

      // Update bot status in database
      await db
        .update(botConfigs)
        .set({ status: 'idle', updatedAt: new Date() })
        .where(eq(botConfigs.id, this.botConfigId));

      await this.log('info', 'Sniping bot stopped successfully');
    } catch (error) {
      await this.log('error', `Failed to stop bot: ${error}`);
      this.handleError(error);
    }
  }

  /**
   * Pause the sniping bot
   */
  async pause(): Promise<void> {
    if (!this.isRunning) {
      console.log('Bot is not running');
      return;
    }

    this.status = 'paused';
    this.emit('paused');
    this.emit('statusChanged', this.status);

    await db
      .update(botConfigs)
      .set({ status: 'paused', updatedAt: new Date() })
      .where(eq(botConfigs.id, this.botConfigId));

    await this.log('info', 'Sniping bot paused');
  }

  /**
   * Resume the sniping bot
   */
  async resume(): Promise<void> {
    if (this.status !== 'paused') {
      console.log('Bot is not paused');
      return;
    }

    this.status = 'running';
    this.emit('resumed');
    this.emit('statusChanged', this.status);

    await db
      .update(botConfigs)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(botConfigs.id, this.botConfigId));

    await this.log('info', 'Sniping bot resumed');
  }

  /**
   * Start detecting new listings
   */
  private startListingDetection(): void {
    // Check for new listings every 30 seconds
    this.detectionInterval = setInterval(async () => {
      if (this.status !== 'running') return;

      try {
        await this.detectAndAnalyzeNewListings();
      } catch (error) {
        await this.log('error', `Error in listing detection: ${error}`);
      }
    }, 30000);

    // Run immediately
    this.detectAndAnalyzeNewListings();
  }

  /**
   * Detect and analyze new listings
   */
  private async detectAndAnalyzeNewListings(): Promise<void> {
    try {
      const newListings = await this.mexcService.detectNewListings();

      if (newListings.length === 0) return;

      await this.log('info', `Detected ${newListings.length} potential new listings`);

      const targets: SnipeTarget[] = [];

      for (const symbol of newListings) {
        try {
          // Skip if already monitoring
          if (this.monitoredSymbols.has(symbol)) continue;

          // Get market data
          const [ticker, orderBook, liquidityScore] = await Promise.all([
            this.mexcService.getTicker(symbol),
            this.mexcService.getOrderBook(symbol),
            this.mexcService.getLiquidityScore(symbol),
          ]);

          // Store market snapshot
          await db.insert(marketSnapshots).values({
            symbol,
            exchange: 'mexc',
            price: ticker.last.toString(),
            volume24h: ticker.quoteVolume.toString(),
            priceChange24h: ticker.percentage.toString(),
            liquidity: liquidityScore.toString(),
            timestamp: new Date(),
          });

          // Analyze with AI if enabled
          let aiAnalysis = null;
          if (this.config.useAI) {
            const context: TradingContext = {
              symbol,
              currentPrice: ticker.last,
              ticker,
              orderBook,
              liquidityScore,
              isNewListing: true,
            };

            aiAnalysis = await this.aiService.analyzeTrade(context);

            await this.log('info', `AI Analysis for ${symbol}: ${aiAnalysis.recommendation} (confidence: ${aiAnalysis.confidence})`);
            this.emit('tradeAnalyzed', { symbol, analysis: aiAnalysis });

            // Check if we should trade based on AI recommendation
            if (
              aiAnalysis.recommendation === 'buy' &&
              aiAnalysis.confidence >= this.config.confidenceThreshold
            ) {
              targets.push({
                symbol,
                listingTime: Date.now(),
                initialPrice: ticker.last,
                liquidity: liquidityScore,
                confidence: aiAnalysis.confidence,
                aiReasoning: aiAnalysis.reasoning,
              });

              this.emit('newListingDetected', {
                symbol,
                price: ticker.last,
                liquidity: liquidityScore,
                aiAnalysis,
              });
            }
          }

          // Start monitoring this symbol
          this.monitoredSymbols.add(symbol);
          this.wsService.subscribeToTicker(symbol);
          this.wsService.subscribeToTrades(symbol);

        } catch (error) {
          await this.log('warn', `Error analyzing ${symbol}: ${error}`);
        }
      }

      // Execute trades for high-confidence targets
      if (targets.length > 0) {
        await this.log('info', `Found ${targets.length} high-confidence targets`);

        // Rank targets if using AI
        if (this.config.useAI) {
          const rankedTargets = await this.aiService.rankSnipeTargets(targets);
          await this.executeSnipes(rankedTargets);
        } else {
          await this.executeSnipes(targets);
        }
      }
    } catch (error) {
      await this.log('error', `Error in detectAndAnalyzeNewListings: ${error}`);
    }
  }

  /**
   * Execute snipe trades
   */
  private async executeSnipes(targets: SnipeTarget[]): Promise<void> {
    // Check daily trade limit
    await this.resetDailyTradeCountIfNeeded();

    if (this.config.maxDailyTrades && this.dailyTradeCount >= this.config.maxDailyTrades) {
      await this.log('warn', 'Daily trade limit reached');
      return;
    }

    // Check concurrent trade limit
    if (this.activeTrades.size >= this.config.maxConcurrentTrades) {
      await this.log('warn', 'Max concurrent trades reached');
      return;
    }

    for (const target of targets) {
      if (this.status !== 'running') break;
      if (this.activeTrades.size >= this.config.maxConcurrentTrades) break;
      if (this.config.maxDailyTrades && this.dailyTradeCount >= this.config.maxDailyTrades) break;

      try {
        await this.executeSingleSnipe(target);
      } catch (error) {
        await this.log('error', `Error executing snipe for ${target.symbol}: ${error}`);
      }
    }
  }

  /**
   * Execute a single snipe trade
   */
  private async executeSingleSnipe(target: SnipeTarget): Promise<void> {
    const { symbol, initialPrice, confidence, aiReasoning } = target;

    try {
      // Calculate trade amount
      const tradeAmount = this.calculateTradeAmount(initialPrice!);

      if (tradeAmount === 0) {
        await this.log('warn', `Trade amount too small for ${symbol}`);
        return;
      }

      await this.log('info', `Executing snipe for ${symbol} - Amount: ${tradeAmount}, Price: ${initialPrice}`);

      // Create the order
      const order = await this.mexcService.createMarketBuyOrder(symbol, tradeAmount);

      // Record trade in database
      const [trade] = await db.insert(trades).values({
        botConfigId: this.botConfigId,
        userId: this.userId,
        symbol,
        type: 'buy',
        status: 'executed',
        orderId: order.id,
        price: order.price.toString(),
        amount: order.amount.toString(),
        filled: order.filled.toString(),
        fee: order.fee?.cost.toString(),
        entryPrice: order.price.toString(),
        aiAnalysis: {
          confidence,
          reasoning: aiReasoning,
        },
        executedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      this.activeTrades.set(symbol, {
        tradeId: trade.id,
        entryPrice: order.price,
        amount: order.filled,
        timestamp: Date.now(),
      });

      this.dailyTradeCount++;

      this.emit('tradeExecuted', {
        symbol,
        type: 'buy',
        price: order.price,
        amount: order.filled,
        orderId: order.id,
      });

      await this.log('info', `Snipe executed successfully for ${symbol}`);

      // Start monitoring for exit
      this.monitorTradeForExit(symbol, trade.id);

    } catch (error) {
      await this.log('error', `Failed to execute snipe for ${symbol}: ${error}`);

      // Record failed trade
      await db.insert(trades).values({
        botConfigId: this.botConfigId,
        userId: this.userId,
        symbol,
        type: 'buy',
        status: 'failed',
        price: initialPrice!.toString(),
        amount: '0',
        filled: '0',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Monitor a trade for exit conditions
   */
  private monitorTradeForExit(symbol: string, tradeId: string): void {
    const trade = this.activeTrades.get(symbol);
    if (!trade) return;

    // Listen to price updates
    this.wsService.on(`ticker:${symbol}`, async (update) => {
      if (!this.activeTrades.has(symbol)) {
        this.wsService.off(`ticker:${symbol}`, () => {});
        return;
      }

      const currentPrice = update.price;
      const entryPrice = trade.entryPrice;
      const priceChange = ((currentPrice - entryPrice) / entryPrice) * 100;

      // Check stop loss
      if (this.config.stopLossPercentage && priceChange <= -this.config.stopLossPercentage) {
        await this.log('warn', `Stop loss triggered for ${symbol} at ${priceChange.toFixed(2)}%`);
        await this.exitTrade(symbol, tradeId, 'stop_loss');
      }

      // Check take profit
      if (this.config.takeProfitPercentage && priceChange >= this.config.takeProfitPercentage) {
        await this.log('info', `Take profit triggered for ${symbol} at ${priceChange.toFixed(2)}%`);
        await this.exitTrade(symbol, tradeId, 'take_profit');
      }
    });
  }

  /**
   * Exit a trade
   */
  private async exitTrade(symbol: string, tradeId: string, reason: string): Promise<void> {
    const trade = this.activeTrades.get(symbol);
    if (!trade) return;

    try {
      // Execute sell order
      const order = await this.mexcService.createMarketSellOrder(symbol, trade.amount);

      const profitLoss = (order.price - trade.entryPrice) * trade.amount;
      const profitLossPercentage = ((order.price - trade.entryPrice) / trade.entryPrice) * 100;

      // Update trade in database
      await db
        .update(trades)
        .set({
          exitPrice: order.price.toString(),
          profitLoss: profitLoss.toString(),
          profitLossPercentage: profitLossPercentage.toString(),
          status: 'executed',
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(trades.id, tradeId));

      this.activeTrades.delete(symbol);

      this.emit('tradeExecuted', {
        symbol,
        type: 'sell',
        price: order.price,
        amount: order.filled,
        profitLoss,
        profitLossPercentage,
        reason,
      });

      await this.log('info', `Trade closed for ${symbol}: ${reason} - P&L: ${profitLoss.toFixed(2)} (${profitLossPercentage.toFixed(2)}%)`);

    } catch (error) {
      await this.log('error', `Failed to exit trade for ${symbol}: ${error}`);
    }
  }

  /**
   * Calculate trade amount based on config
   */
  private calculateTradeAmount(price: number): number {
    const maxAmount = parseFloat(this.config.maxTradeAmount.toString());
    const minAmount = parseFloat(this.config.minTradeAmount.toString());

    // Calculate based on max trade amount in quote currency
    let amount = maxAmount / price;

    // Check minimum
    if (amount * price < minAmount) {
      return 0;
    }

    return amount;
  }

  /**
   * Reset daily trade count if needed
   */
  private async resetDailyTradeCountIfNeeded(): Promise<void> {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (now - this.lastTradeReset >= oneDayMs) {
      this.dailyTradeCount = 0;
      this.lastTradeReset = now;
      await this.log('info', 'Daily trade count reset');
    }
  }

  /**
   * Setup WebSocket listeners
   */
  private setupWebSocketListeners(): void {
    this.wsService.on('connected', () => {
      this.log('info', 'WebSocket connected');
    });

    this.wsService.on('disconnected', () => {
      this.log('warn', 'WebSocket disconnected');
    });

    this.wsService.on('error', (error) => {
      this.log('error', `WebSocket error: ${error}`);
    });
  }

  /**
   * Handle errors
   */
  private handleError(error: any): void {
    this.status = 'error';
    this.emit('error', error);
    this.emit('statusChanged', this.status);
  }

  /**
   * Log to database
   */
  private async log(level: string, message: string, metadata?: any): Promise<void> {
    try {
      await db.insert(botLogs).values({
        botConfigId: this.botConfigId,
        level,
        message,
        metadata,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to log to database:', error);
    }
  }

  /**
   * Get bot status
   */
  getStatus(): BotStatus {
    return this.status;
  }

  /**
   * Get active trades
   */
  getActiveTrades(): Map<string, any> {
    return this.activeTrades;
  }

  /**
   * Get monitored symbols
   */
  getMonitoredSymbols(): Set<string> {
    return this.monitoredSymbols;
  }

  /**
   * Get daily trade count
   */
  getDailyTradeCount(): number {
    return this.dailyTradeCount;
  }
}

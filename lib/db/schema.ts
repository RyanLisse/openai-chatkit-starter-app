import { pgTable, text, serial, timestamp, boolean, jsonb, decimal, integer, uuid, index, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const tradeStatusEnum = pgEnum('trade_status', ['pending', 'executed', 'failed', 'cancelled']);
export const tradeTypeEnum = pgEnum('trade_type', ['buy', 'sell']);
export const botStatusEnum = pgEnum('bot_status', ['idle', 'running', 'paused', 'error']);
export const strategyTypeEnum = pgEnum('strategy_type', ['snipe_new_listings', 'pump_detector', 'arbitrage', 'custom']);

// Users table
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Wallets table - stores user's exchange API credentials
export const wallets = pgTable("wallets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  exchange: text("exchange").notNull(), // 'mexc', 'binance', etc.
  apiKey: text("api_key").notNull(),
  apiSecret: text("api_secret").notNull(), // Should be encrypted in production
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("wallet_user_id_idx").on(table.userId),
}));

// Bot configurations
export const botConfigs = pgTable("bot_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  status: botStatusEnum("status").default('idle').notNull(),
  walletId: uuid("wallet_id").references(() => wallets.id, { onDelete: "cascade" }).notNull(),
  strategyId: uuid("strategy_id").references(() => strategies.id),

  // Trading parameters
  maxTradeAmount: decimal("max_trade_amount", { precision: 20, scale: 8 }).notNull(),
  minTradeAmount: decimal("min_trade_amount", { precision: 20, scale: 8 }).notNull(),
  stopLossPercentage: decimal("stop_loss_percentage", { precision: 5, scale: 2 }),
  takeProfitPercentage: decimal("take_profit_percentage", { precision: 5, scale: 2 }),
  maxDailyTrades: integer("max_daily_trades"),
  maxConcurrentTrades: integer("max_concurrent_trades").default(3),

  // AI settings
  useAI: boolean("use_ai").default(true).notNull(),
  aiModel: text("ai_model").default('claude-sonnet-4-5'),
  confidenceThreshold: decimal("confidence_threshold", { precision: 3, scale: 2 }).default('0.75'),

  // Additional config as JSON
  config: jsonb("config"), // For flexible additional settings

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("bot_config_user_id_idx").on(table.userId),
  statusIdx: index("bot_config_status_idx").on(table.status),
}));

// Trading strategies
export const strategies = pgTable("strategies", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  type: strategyTypeEnum("type").notNull(),
  description: text("description"),

  // Strategy parameters
  parameters: jsonb("parameters").notNull(), // Flexible JSON for different strategy types

  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("strategy_user_id_idx").on(table.userId),
  typeIdx: index("strategy_type_idx").on(table.type),
}));

// Trades table
export const trades = pgTable("trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  botConfigId: uuid("bot_config_id").references(() => botConfigs.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Trade details
  symbol: text("symbol").notNull(), // e.g., 'BTC/USDT'
  type: tradeTypeEnum("type").notNull(),
  status: tradeStatusEnum("status").default('pending').notNull(),

  // Order details
  orderId: text("order_id"), // Exchange order ID
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  filled: decimal("filled", { precision: 20, scale: 8 }).default('0'),
  fee: decimal("fee", { precision: 20, scale: 8 }),

  // P&L tracking
  entryPrice: decimal("entry_price", { precision: 20, scale: 8 }),
  exitPrice: decimal("exit_price", { precision: 20, scale: 8 }),
  profitLoss: decimal("profit_loss", { precision: 20, scale: 8 }),
  profitLossPercentage: decimal("profit_loss_percentage", { precision: 10, scale: 4 }),

  // AI analysis
  aiAnalysis: jsonb("ai_analysis"), // Store AI reasoning and confidence

  // Timestamps
  executedAt: timestamp("executed_at"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("trade_user_id_idx").on(table.userId),
  botConfigIdIdx: index("trade_bot_config_id_idx").on(table.botConfigId),
  symbolIdx: index("trade_symbol_idx").on(table.symbol),
  statusIdx: index("trade_status_idx").on(table.status),
  createdAtIdx: index("trade_created_at_idx").on(table.createdAt),
}));

// Market data snapshots
export const marketSnapshots = pgTable("market_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  symbol: text("symbol").notNull(),
  exchange: text("exchange").notNull(),

  // Price data
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  volume24h: decimal("volume_24h", { precision: 30, scale: 8 }),
  volumeChange: decimal("volume_change", { precision: 10, scale: 4 }),
  priceChange24h: decimal("price_change_24h", { precision: 10, scale: 4 }),

  // Market metrics
  marketCap: decimal("market_cap", { precision: 30, scale: 2 }),
  liquidity: decimal("liquidity", { precision: 30, scale: 8 }),

  // Additional data
  metadata: jsonb("metadata"),

  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  symbolIdx: index("market_snapshot_symbol_idx").on(table.symbol),
  timestampIdx: index("market_snapshot_timestamp_idx").on(table.timestamp),
}));

// Bot logs for debugging and monitoring
export const botLogs = pgTable("bot_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  botConfigId: uuid("bot_config_id").references(() => botConfigs.id, { onDelete: "cascade" }).notNull(),
  level: text("level").notNull(), // 'info', 'warn', 'error', 'debug'
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  botConfigIdIdx: index("bot_log_bot_config_id_idx").on(table.botConfigId),
  timestampIdx: index("bot_log_timestamp_idx").on(table.timestamp),
  levelIdx: index("bot_log_level_idx").on(table.level),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  wallets: many(wallets),
  botConfigs: many(botConfigs),
  strategies: many(strategies),
  trades: many(trades),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  botConfigs: many(botConfigs),
}));

export const botConfigsRelations = relations(botConfigs, ({ one, many }) => ({
  user: one(users, {
    fields: [botConfigs.userId],
    references: [users.id],
  }),
  wallet: one(wallets, {
    fields: [botConfigs.walletId],
    references: [wallets.id],
  }),
  strategy: one(strategies, {
    fields: [botConfigs.strategyId],
    references: [strategies.id],
  }),
  trades: many(trades),
  logs: many(botLogs),
}));

export const strategiesRelations = relations(strategies, ({ one, many }) => ({
  user: one(users, {
    fields: [strategies.userId],
    references: [users.id],
  }),
  botConfigs: many(botConfigs),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  user: one(users, {
    fields: [trades.userId],
    references: [users.id],
  }),
  botConfig: one(botConfigs, {
    fields: [trades.botConfigId],
    references: [botConfigs.id],
  }),
}));

export const botLogsRelations = relations(botLogs, ({ one }) => ({
  botConfig: one(botConfigs, {
    fields: [botLogs.botConfigId],
    references: [botConfigs.id],
  }),
}));

# AI Sniping Bot - MEXC Trading Platform

An automated, AI-powered cryptocurrency sniping bot for the MEXC exchange. This bot uses Claude AI via the Model Context Protocol (MCP) to analyze new token listings and execute trades with intelligent risk management.

## Features

- **AI-Powered Trading**: Uses Claude Sonnet 4.5 for intelligent trade analysis and decision-making
- **Real-time Market Data**: WebSocket integration for live price feeds from MEXC
- **Automated Sniping**: Detects and executes trades on new token listings
- **Risk Management**: Built-in stop-loss, take-profit, and position sizing
- **Trading Dashboard**: Real-time monitoring with Next.js 15 and shadcn/ui
- **PostgreSQL Database**: Comprehensive trade history and analytics
- **Effect-TS**: Functional programming for robust error handling
- **TanStack Query**: Efficient data fetching and caching

## Tech Stack

### Backend
- **Next.js 15** - Full-stack React framework with App Router
- **PostgreSQL** - Relational database for persistent storage
- **Drizzle ORM** - Type-safe database toolkit
- **CCXT** - Cryptocurrency exchange integration (MEXC)
- **WebSockets** - Real-time price feeds
- **Effect-TS** - Functional programming and error handling

### AI & Trading
- **Anthropic Claude API** - AI trading analysis and decision-making
- **Model Context Protocol (MCP)** - AI service integration
- **Hummingbot Integration** - Advanced trading strategies (optional)

### Frontend
- **Next.js 15** - React 19 with App Router
- **shadcn/ui** - High-quality UI components
- **TanStack Query** - Server state management
- **Tailwind CSS 4** - Utility-first styling
- **Lucide Icons** - Beautiful icon set
- **Recharts** - Trading charts and visualizations

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- MEXC Exchange Account with API keys
- Anthropic API key (for Claude AI)

## Installation

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd openai-chatkit-starter-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up PostgreSQL

Create a new PostgreSQL database:

```bash
createdb sniping_bot
```

Or using psql:

```sql
CREATE DATABASE sniping_bot;
```

### 4. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Update `.env.local` with your credentials:

```env
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/sniping_bot
ANTHROPIC_API_KEY=sk-ant-...

# MEXC API (users will add via UI, but you can set defaults for testing)
MEXC_API_KEY=your_mexc_api_key
MEXC_SECRET_KEY=your_mexc_secret_key
```

### 5. Initialize the database

Generate and run migrations:

```bash
npm run db:generate
npm run db:push
```

Or use Drizzle Studio to manage your database:

```bash
npm run db:studio
```

### 6. Run the development server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Project Structure

```
├── app/
│   ├── api/                    # API routes
│   │   ├── bot/               # Bot control endpoints
│   │   │   ├── start/
│   │   │   ├── stop/
│   │   │   └── status/
│   │   ├── trades/            # Trading history
│   │   ├── wallets/           # Wallet management
│   │   └── strategies/        # Trading strategies
│   ├── dashboard/             # Main dashboard page
│   └── layout.tsx             # Root layout with providers
├── components/
│   ├── ui/                    # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   └── input.tsx
│   ├── bot-dashboard.tsx      # Bot control panel
│   └── trading-history.tsx    # Trade history display
├── lib/
│   ├── db/
│   │   ├── schema.ts          # Database schema
│   │   └── index.ts           # Database connection
│   ├── services/
│   │   ├── mexc-service.ts    # MEXC API integration
│   │   ├── websocket-service.ts # Real-time data
│   │   ├── ai-trading-service.ts # Claude AI integration
│   │   └── sniping-bot.ts     # Core bot engine
│   ├── types/
│   │   └── trading.ts         # TypeScript types
│   ├── providers.tsx          # TanStack Query provider
│   └── utils.ts               # Utility functions
└── drizzle/                   # Database migrations
```

## Usage

### 1. Add Exchange Credentials

Navigate to the wallet management section and add your MEXC API credentials:

- API Key
- API Secret

**Important**: Store API keys securely. In production, use environment variables or a secrets manager.

### 2. Configure Bot Settings

Set up your bot with the following parameters:

- **Max Trade Amount**: Maximum USDT per trade
- **Min Trade Amount**: Minimum USDT per trade
- **Stop Loss %**: Automatic exit on loss
- **Take Profit %**: Automatic exit on profit
- **Max Daily Trades**: Limit total trades per day
- **Max Concurrent Trades**: Number of simultaneous positions
- **AI Confidence Threshold**: Minimum AI confidence to execute (0-1)

### 3. Start the Bot

Click "Start" on the dashboard to begin automated trading. The bot will:

1. Monitor MEXC for new token listings
2. Fetch market data (price, volume, liquidity)
3. Analyze opportunities using Claude AI
4. Execute trades based on AI recommendations
5. Monitor positions for exit conditions

### 4. Monitor Performance

The dashboard displays:

- Bot status (running, paused, stopped)
- Active trades
- Trading history
- Profit/Loss metrics
- AI analysis insights

## API Routes

### Bot Control

```typescript
POST /api/bot/start
POST /api/bot/stop
GET  /api/bot/status?botConfigId={id}
```

### Trading

```typescript
GET  /api/trades?userId={id}&botConfigId={id}&limit=50
GET  /api/trades/[id]
```

### Wallets

```typescript
GET  /api/wallets?userId={id}
POST /api/wallets
```

### Strategies

```typescript
GET  /api/strategies?userId={id}
POST /api/strategies
```

## Database Schema

### Key Tables

- **users** - User accounts
- **wallets** - Exchange API credentials
- **bot_configs** - Bot configuration and settings
- **strategies** - Trading strategies
- **trades** - Executed trades with P&L
- **market_snapshots** - Historical market data
- **bot_logs** - Bot activity logs

## Safety Features

### Built-in Risk Management

- ✅ Stop-loss orders
- ✅ Take-profit targets
- ✅ Maximum trade limits
- ✅ Position sizing
- ✅ AI confidence filtering
- ✅ Liquidity checks
- ✅ Daily trade caps

### Security Best Practices

- 🔒 Never commit API keys
- 🔒 Use environment variables
- 🔒 Encrypt sensitive data
- 🔒 Implement rate limiting
- 🔒 Add authentication (NextAuth)
- 🔒 Use testnet for development

## Development

### Run database migrations

```bash
npm run db:generate  # Generate migrations from schema
npm run db:migrate   # Apply migrations
npm run db:push      # Push schema directly (dev only)
```

### View database

```bash
npm run db:studio    # Open Drizzle Studio
```

### Build for production

```bash
npm run build
npm start
```

## Configuration

### AI Model Selection

The bot uses Claude Sonnet 4.5 by default. You can configure different models in the bot settings:

```typescript
aiModel: 'claude-sonnet-4-5-20250929'  // Default
aiModel: 'claude-opus-4-5'             // More powerful
aiModel: 'claude-haiku-4-5'            // Faster, cheaper
```

### Trading Strategies

Create custom strategies via the API:

```typescript
{
  type: 'snipe_new_listings',
  parameters: {
    minLiquidity: 50000,
    minVolume: 100000,
    maxSlippage: 0.01,
    // ... custom params
  }
}
```

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
pg_isready

# Reset database
dropdb sniping_bot && createdb sniping_bot
npm run db:push
```

### API Errors

- Verify API keys are correct
- Check MEXC API rate limits
- Ensure sufficient exchange balance
- Review bot logs in database

### WebSocket Disconnects

The WebSocket service automatically reconnects with exponential backoff (max 10 attempts).

## Disclaimer

⚠️ **Trading cryptocurrencies carries significant risk. This bot is for educational purposes only.**

- Never trade with funds you can't afford to lose
- Start with small amounts
- Use testnet for development
- Monitor bot performance regularly
- Understand the risks of automated trading

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:

- Open an issue on GitHub
- Check existing documentation
- Review bot logs in the database

## Roadmap

- [ ] NextAuth authentication
- [ ] Multi-exchange support (Binance, KuCoin)
- [ ] Advanced charting with TradingView
- [ ] Backtesting framework
- [ ] Mobile app (React Native)
- [ ] Telegram notifications
- [ ] Portfolio analytics
- [ ] Social trading features

---

Built with ❤️ using Next.js, Claude AI, and MEXC

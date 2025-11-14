import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { botConfigs, wallets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { MEXCService } from '@/lib/services/mexc-service';
import { AITradingService } from '@/lib/services/ai-trading-service';
import { SnipingBot } from '@/lib/services/sniping-bot';

// Store active bot instances
const activeBots = new Map<string, SnipingBot>();

export async function POST(request: NextRequest) {
  try {
    const { botConfigId } = await request.json();

    if (!botConfigId) {
      return NextResponse.json({ error: 'Bot config ID is required' }, { status: 400 });
    }

    // Check if bot is already running
    if (activeBots.has(botConfigId)) {
      return NextResponse.json({ error: 'Bot is already running' }, { status: 400 });
    }

    // Fetch bot configuration
    const [config] = await db
      .select()
      .from(botConfigs)
      .where(eq(botConfigs.id, botConfigId))
      .limit(1);

    if (!config) {
      return NextResponse.json({ error: 'Bot configuration not found' }, { status: 404 });
    }

    // Fetch wallet credentials
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, config.walletId))
      .limit(1);

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Initialize services
    const mexcService = new MEXCService({
      apiKey: wallet.apiKey,
      secret: wallet.apiSecret,
    });

    const aiService = new AITradingService({
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '',
      model: config.aiModel || 'claude-sonnet-4-5-20250929',
    });

    // Create and start bot
    const bot = new SnipingBot({
      botConfigId: config.id,
      userId: config.userId,
      mexcService,
      aiService,
      config: {
        id: config.id,
        maxTradeAmount: parseFloat(config.maxTradeAmount),
        minTradeAmount: parseFloat(config.minTradeAmount),
        stopLossPercentage: config.stopLossPercentage ? parseFloat(config.stopLossPercentage) : undefined,
        takeProfitPercentage: config.takeProfitPercentage ? parseFloat(config.takeProfitPercentage) : undefined,
        maxDailyTrades: config.maxDailyTrades || undefined,
        maxConcurrentTrades: config.maxConcurrentTrades || 3,
        useAI: config.useAI,
        aiModel: config.aiModel || undefined,
        confidenceThreshold: config.confidenceThreshold ? parseFloat(config.confidenceThreshold) : 0.75,
      },
    });

    await bot.start();
    activeBots.set(botConfigId, bot);

    return NextResponse.json({ message: 'Bot started successfully', status: 'running' });
  } catch (error) {
    console.error('Error starting bot:', error);
    return NextResponse.json(
      { error: 'Failed to start bot', details: String(error) },
      { status: 500 }
    );
  }
}

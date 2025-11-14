import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { botConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const botConfigId = searchParams.get('botConfigId');

    if (!botConfigId) {
      return NextResponse.json({ error: 'Bot config ID is required' }, { status: 400 });
    }

    const [config] = await db
      .select()
      .from(botConfigs)
      .where(eq(botConfigs.id, botConfigId))
      .limit(1);

    if (!config) {
      return NextResponse.json({ error: 'Bot configuration not found' }, { status: 404 });
    }

    return NextResponse.json({
      botConfigId: config.id,
      status: config.status,
      name: config.name,
      useAI: config.useAI,
      maxTradeAmount: config.maxTradeAmount,
      minTradeAmount: config.minTradeAmount,
      stopLossPercentage: config.stopLossPercentage,
      takeProfitPercentage: config.takeProfitPercentage,
      maxDailyTrades: config.maxDailyTrades,
      maxConcurrentTrades: config.maxConcurrentTrades,
      updatedAt: config.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching bot status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bot status', details: String(error) },
      { status: 500 }
    );
  }
}

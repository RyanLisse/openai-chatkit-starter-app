import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trades } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const botConfigId = searchParams.get('botConfigId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = db.select().from(trades);

    if (userId) {
      query = query.where(eq(trades.userId, userId)) as any;
    }

    if (botConfigId) {
      query = query.where(eq(trades.botConfigId, botConfigId)) as any;
    }

    const results = await query
      .orderBy(desc(trades.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      trades: results,
      count: results.length,
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trades', details: String(error) },
      { status: 500 }
    );
  }
}

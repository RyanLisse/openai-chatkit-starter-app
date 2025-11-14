import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { wallets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const results = await db
      .select({
        id: wallets.id,
        userId: wallets.userId,
        exchange: wallets.exchange,
        isActive: wallets.isActive,
        createdAt: wallets.createdAt,
        updatedAt: wallets.updatedAt,
        // Don't return API keys for security
      })
      .from(wallets)
      .where(eq(wallets.userId, userId));

    return NextResponse.json({ wallets: results });
  } catch (error) {
    console.error('Error fetching wallets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallets', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, exchange, apiKey, apiSecret } = body;

    if (!userId || !exchange || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // In production, encrypt the API secret before storing
    const [wallet] = await db
      .insert(wallets)
      .values({
        userId,
        exchange,
        apiKey,
        apiSecret, // Should be encrypted
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({
        id: wallets.id,
        userId: wallets.userId,
        exchange: wallets.exchange,
        isActive: wallets.isActive,
        createdAt: wallets.createdAt,
      });

    return NextResponse.json({ wallet }, { status: 201 });
  } catch (error) {
    console.error('Error creating wallet:', error);
    return NextResponse.json(
      { error: 'Failed to create wallet', details: String(error) },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { strategies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const results = await db
      .select()
      .from(strategies)
      .where(eq(strategies.userId, userId));

    return NextResponse.json({ strategies: results });
  } catch (error) {
    console.error('Error fetching strategies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch strategies', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, type, description, parameters } = body;

    if (!userId || !name || !type || !parameters) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const [strategy] = await db
      .insert(strategies)
      .values({
        userId,
        name,
        type,
        description,
        parameters,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ strategy }, { status: 201 });
  } catch (error) {
    console.error('Error creating strategy:', error);
    return NextResponse.json(
      { error: 'Failed to create strategy', details: String(error) },
      { status: 500 }
    );
  }
}

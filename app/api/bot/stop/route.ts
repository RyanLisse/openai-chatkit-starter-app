import { NextRequest, NextResponse } from 'next/server';

// Import the active bots map from start route
// In production, you'd use a proper state management solution like Redis
const activeBots = new Map();

export async function POST(request: NextRequest) {
  try {
    const { botConfigId } = await request.json();

    if (!botConfigId) {
      return NextResponse.json({ error: 'Bot config ID is required' }, { status: 400 });
    }

    const bot = activeBots.get(botConfigId);

    if (!bot) {
      return NextResponse.json({ error: 'Bot is not running' }, { status: 400 });
    }

    await bot.stop();
    activeBots.delete(botConfigId);

    return NextResponse.json({ message: 'Bot stopped successfully', status: 'idle' });
  } catch (error) {
    console.error('Error stopping bot:', error);
    return NextResponse.json(
      { error: 'Failed to stop bot', details: String(error) },
      { status: 500 }
    );
  }
}

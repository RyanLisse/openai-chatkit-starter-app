import Anthropic from '@anthropic-ai/sdk';
import type { AIAnalysis, SnipeTarget, Ticker, OrderBook } from '@/lib/types/trading';

export interface TradingContext {
  symbol: string;
  currentPrice: number;
  ticker: Ticker;
  orderBook?: OrderBook;
  volumeChange24h?: number;
  liquidityScore?: number;
  marketCap?: number;
  isNewListing?: boolean;
  listingAge?: number; // in minutes
}

export interface AITradingConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class AITradingService {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(config: AITradingConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model || 'claude-sonnet-4-5-20250929';
    this.maxTokens = config.maxTokens || 4096;
    this.temperature = config.temperature || 0.3;
  }

  /**
   * Analyze a potential trade opportunity using AI
   */
  async analyzeTrade(context: TradingContext, userStrategy?: string): Promise<AIAnalysis> {
    const prompt = this.buildAnalysisPrompt(context, userStrategy);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return this.parseAnalysisResponse(content.text);
      }

      throw new Error('Unexpected response format from AI');
    } catch (error) {
      console.error('Error analyzing trade:', error);
      throw error;
    }
  }

  /**
   * Analyze multiple snipe targets and rank them
   */
  async rankSnipeTargets(targets: SnipeTarget[]): Promise<SnipeTarget[]> {
    const prompt = `You are a cryptocurrency trading AI assistant. Analyze and rank the following potential snipe targets based on their likelihood of success.

Targets:
${JSON.stringify(targets, null, 2)}

For each target, provide:
1. Updated confidence score (0-1)
2. Risk assessment
3. Brief reasoning

Return your analysis as a JSON array of the targets, sorted by confidence (highest first).`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        // Extract JSON from response
        const jsonMatch = content.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      throw new Error('Could not parse ranked targets from AI response');
    } catch (error) {
      console.error('Error ranking snipe targets:', error);
      return targets; // Return original if ranking fails
    }
  }

  /**
   * Generate trading strategy based on market conditions
   */
  async generateStrategy(
    marketConditions: string,
    riskTolerance: 'low' | 'medium' | 'high'
  ): Promise<string> {
    const prompt = `You are a cryptocurrency trading AI assistant. Generate a trading strategy based on the following:

Market Conditions:
${marketConditions}

Risk Tolerance: ${riskTolerance}

Provide a detailed but concise trading strategy including:
1. Entry criteria
2. Exit criteria
3. Position sizing
4. Risk management rules
5. Stop loss and take profit levels

Keep the response practical and actionable.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: 0.5,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        return content.text;
      }

      throw new Error('Unexpected response format from AI');
    } catch (error) {
      console.error('Error generating strategy:', error);
      throw error;
    }
  }

  /**
   * Analyze market sentiment from price action
   */
  async analyzeMarketSentiment(
    symbol: string,
    priceHistory: number[],
    volumeHistory: number[]
  ): Promise<{ sentiment: 'bullish' | 'bearish' | 'neutral'; confidence: number; reasoning: string }> {
    const prompt = `Analyze the market sentiment for ${symbol} based on recent price and volume data.

Price History (last 24 hours): ${priceHistory.join(', ')}
Volume History (last 24 hours): ${volumeHistory.join(', ')}

Provide your analysis in the following JSON format:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      return {
        sentiment: 'neutral',
        confidence: 0.5,
        reasoning: 'Unable to analyze sentiment',
      };
    } catch (error) {
      console.error('Error analyzing market sentiment:', error);
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        reasoning: 'Error analyzing sentiment',
      };
    }
  }

  /**
   * Build the analysis prompt for AI
   */
  private buildAnalysisPrompt(context: TradingContext, userStrategy?: string): string {
    const { symbol, currentPrice, ticker, orderBook, volumeChange24h, liquidityScore, isNewListing } = context;

    return `You are a cryptocurrency trading AI assistant specializing in high-frequency trading and token sniping on MEXC exchange.

Analyze the following trading opportunity and provide a recommendation:

Symbol: ${symbol}
Current Price: $${currentPrice}
24h Volume: $${ticker.quoteVolume?.toFixed(2)}
24h Change: ${ticker.percentage?.toFixed(2)}%
24h High: $${ticker.high}
24h Low: $${ticker.low}
${volumeChange24h ? `Volume Change: ${volumeChange24h.toFixed(2)}%` : ''}
${liquidityScore ? `Liquidity Score: ${liquidityScore}/100` : ''}
${isNewListing ? 'Status: NEW LISTING (Listed in last 24h)' : ''}

${orderBook ? `
Order Book Summary:
- Best Bid: $${orderBook.bids[0]?.[0]}
- Best Ask: $${orderBook.asks[0]?.[0]}
- Bid/Ask Spread: ${((orderBook.asks[0]?.[0] - orderBook.bids[0]?.[0]) / orderBook.bids[0]?.[0] * 100).toFixed(3)}%
- Total Bid Liquidity (top 10): $${orderBook.bids.slice(0, 10).reduce((sum, [p, a]) => sum + p * a, 0).toFixed(2)}
- Total Ask Liquidity (top 10): $${orderBook.asks.slice(0, 10).reduce((sum, [p, a]) => sum + p * a, 0).toFixed(2)}
` : ''}

${userStrategy ? `User Strategy:\n${userStrategy}\n` : ''}

Provide your analysis in the following JSON format:
{
  "recommendation": "buy" | "sell" | "hold" | "skip",
  "confidence": 0.0-1.0,
  "riskLevel": "low" | "medium" | "high",
  "reasoning": "Detailed explanation of your recommendation",
  "entryPrice": suggested entry price (number),
  "stopLoss": suggested stop loss price (number),
  "takeProfit": suggested take profit price (number),
  "positionSize": suggested position size percentage (0-100)
}

Consider:
1. Market momentum and trend
2. Liquidity and order book depth
3. Volume patterns
4. Risk/reward ratio
5. For new listings: pump and dump risk
6. Market manipulation indicators

Be conservative and prioritize capital preservation. Only recommend "buy" if confidence > 0.7 and risk is manageable.`;
  }

  /**
   * Parse AI response into structured analysis
   */
  private parseAnalysisResponse(response: string): AIAnalysis {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        confidence: parsed.confidence || 0,
        recommendation: parsed.recommendation || 'skip',
        reasoning: parsed.reasoning || '',
        riskLevel: parsed.riskLevel || 'high',
        metadata: {
          entryPrice: parsed.entryPrice,
          stopLoss: parsed.stopLoss,
          takeProfit: parsed.takeProfit,
          positionSize: parsed.positionSize,
        },
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return {
        confidence: 0,
        recommendation: 'skip',
        reasoning: 'Failed to parse AI response',
        riskLevel: 'high',
      };
    }
  }
}

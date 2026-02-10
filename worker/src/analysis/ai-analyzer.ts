import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { withRetry, RetryableError } from '../utils/retry';
import { getPromptForAuditType } from './prompts';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

export interface AIAnalysisIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  recommendation: string;
  impact: string;
}

export interface AIAnalysisRecommendation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  estimatedImpact: string;
  effort: string;
}

export interface AIAnalysis {
  overallScore: number;
  scores: Record<string, number>;
  issues: AIAnalysisIssue[];
  recommendations: AIAnalysisRecommendation[];
  summary: string;
  trendAnalysis?: string;
}

export async function analyzeAuditResults(
  auditType: string,
  rawData: Record<string, any>,
  previousRunData?: Record<string, any> | null
): Promise<AIAnalysis> {
  const analysisLogger = logger.child({ auditType, hasPreviousData: !!previousRunData });
  analysisLogger.info('Starting AI analysis');

  try {
    const systemPrompt = getPromptForAuditType(auditType);
    
    const userMessage = JSON.stringify({
      currentAudit: rawData,
      previousAudit: previousRunData || null,
      analysisDate: new Date().toISOString(),
      auditType,
    }, null, 2);

    const analysis = await withRetry(
      async () => {
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Analyze the following audit data and return a JSON response matching the AIAnalysis interface. ${
                previousRunData 
                  ? 'Compare with previous audit data to identify trends and regressions.' 
                  : 'This is the first audit run for this client.'
              }\n\n${userMessage}`,
            },
          ],
        });

        const textContent = response.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('');

        return parseAIResponse(textContent);
      },
      {
        maxAttempts: 3,
        baseDelay: 1000,
      },
      'AI analysis'
    );

    // Validate the analysis result
    validateAnalysis(analysis);

    analysisLogger.info(
      { 
        overallScore: analysis.overallScore,
        issueCount: analysis.issues.length,
        recommendationCount: analysis.recommendations.length 
      }, 
      'AI analysis completed'
    );

    return analysis;

  } catch (error) {
    analysisLogger.error({ error }, 'AI analysis failed');
    
    // Return a fallback analysis if AI fails
    return createFallbackAnalysis(rawData, auditType);
  }
}

function parseAIResponse(textContent: string): AIAnalysis {
  try {
    // Remove markdown code fences if present
    const cleaned = textContent.replace(/```json\n?|\n?```/g, '').trim();
    
    // Try to find JSON content if wrapped in other text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : cleaned;
    
    const parsed = JSON.parse(jsonString);
    
    // Ensure required fields exist
    if (!parsed.overallScore && parsed.overallScore !== 0) {
      throw new Error('Missing overallScore in AI response');
    }
    
    return parsed as AIAnalysis;
  } catch (error) {
    logger.error({ error, textContent }, 'Failed to parse AI response');
    throw new RetryableError(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function validateAnalysis(analysis: AIAnalysis): void {
  const errors: string[] = [];

  // Validate overall score
  if (typeof analysis.overallScore !== 'number' || analysis.overallScore < 0 || analysis.overallScore > 100) {
    errors.push('Overall score must be a number between 0 and 100');
  }

  // Validate scores object
  if (!analysis.scores || typeof analysis.scores !== 'object') {
    errors.push('Scores must be an object');
  } else {
    for (const [key, value] of Object.entries(analysis.scores)) {
      if (typeof value !== 'number' || value < 0 || value > 100) {
        errors.push(`Score '${key}' must be a number between 0 and 100`);
      }
    }
  }

  // Validate issues array
  if (!Array.isArray(analysis.issues)) {
    errors.push('Issues must be an array');
  } else {
    analysis.issues.forEach((issue, index) => {
      if (!issue.severity || !['critical', 'warning', 'info'].includes(issue.severity)) {
        errors.push(`Issue ${index}: severity must be 'critical', 'warning', or 'info'`);
      }
      if (!issue.title || typeof issue.title !== 'string') {
        errors.push(`Issue ${index}: title must be a non-empty string`);
      }
    });
  }

  // Validate recommendations array
  if (!Array.isArray(analysis.recommendations)) {
    errors.push('Recommendations must be an array');
  } else {
    analysis.recommendations.forEach((rec, index) => {
      if (!rec.priority || !['high', 'medium', 'low'].includes(rec.priority)) {
        errors.push(`Recommendation ${index}: priority must be 'high', 'medium', or 'low'`);
      }
      if (!rec.title || typeof rec.title !== 'string') {
        errors.push(`Recommendation ${index}: title must be a non-empty string`);
      }
    });
  }

  // Validate summary
  if (!analysis.summary || typeof analysis.summary !== 'string') {
    errors.push('Summary must be a non-empty string');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid AI analysis: ${errors.join(', ')}`);
  }
}

function createFallbackAnalysis(rawData: Record<string, any>, auditType: string): AIAnalysis {
  logger.warn({ auditType }, 'Creating fallback analysis due to AI failure');

  return {
    overallScore: 50, // Neutral score when AI fails
    scores: {
      general: 50,
    },
    issues: [
      {
        severity: 'warning',
        category: 'Analysis',
        title: 'AI Analysis Unavailable',
        description: 'The AI analysis service was temporarily unavailable. Raw audit data was collected successfully.',
        recommendation: 'Review the raw audit data manually or retry the analysis later.',
        impact: 'Analysis insights are limited without AI processing.',
      },
    ],
    recommendations: [
      {
        priority: 'medium',
        title: 'Retry Analysis',
        description: 'Consider running the audit again when the AI service is available.',
        estimatedImpact: 'Will provide detailed insights and recommendations.',
        effort: 'Low - automated process',
      },
    ],
    summary: `Audit completed for ${auditType} but AI analysis was unavailable. Raw data collection was successful.`,
  };
}
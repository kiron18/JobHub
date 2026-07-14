import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

console.log(`LLM service initialized. Key present: ${!!OPENROUTER_API_KEY}`);

async function retryWithBackoff(fn: () => Promise<any>, retries: number = 2, delay: number = 2000): Promise<any> {
    try {
        return await fn();
    } catch (error: any) {
        const isRetryable = error.response?.status === 429 || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED';
        if (retries > 0 && isRetryable) {
            console.warn(`   ⚠️ LLM Internal Retry: ${error.code || error.response?.status}. Attempts left: ${retries}. Backoff: ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryWithBackoff(fn, retries - 1, delay * 2);
        }
        throw error;
    }
}

/**
 * Robust LLM caller using OpenRouter.

 * @param prompt - The instruction and data.
 * @param jsonMode - If true, requests JSON output.
 * @returns Raw content string or parsed object as requested.
 */
export async function callLLM(prompt: string, jsonMode: boolean = true, temperature: number = 0) {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not set in environment variables.');
    }

    return await retryWithBackoff(async () => {
        const response = await axios.post(
            OPENROUTER_URL,
            {
                model: process.env.FAST_MODEL || 'anthropic/claude-sonnet-4-5',
                temperature,
                max_tokens: 8192,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional resume parser and career coach assistant. ' +
                            (jsonMode ? 'Return ONLY valid JSON. No preamble or explanation.' : '')
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://aussiegradcareers.com.au',
                    'X-Title': process.env.OPENROUTER_APP_TITLE || 'JobHub',
                    'Content-Type': 'application/json',
                },
                timeout: 120000,
            }
        );

        const choices = response.data.choices;
        if (!choices?.length) {
            throw new Error(`OpenRouter returned no choices. Body: ${JSON.stringify(response.data).substring(0, 300)}`);
        }
        return choices[0].message.content;
    });
}

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'anthropic/claude-sonnet-4-5';

// Premium model for the high-value, wow-factor reasoning calls (CV scan, the
// generated resume/cover/SC, the diagnostic). Defaults to CLAUDE_MODEL so nothing
// breaks until CLAUDE_MODEL_PREMIUM is set in the environment. Set it to an Opus
// slug (e.g. anthropic/claude-opus-4-8) to turn premium on without code changes.
export const PREMIUM_MODEL = process.env.CLAUDE_MODEL_PREMIUM || CLAUDE_MODEL;

/**
 * Calls Claude via OpenRouter for strategic/reasoning tasks.
 * Returns content + usage for cost tracking.
 * Pass `model` (e.g. PREMIUM_MODEL) to override the default per call.
 */
export async function callClaude(
    prompt: string,
    jsonMode: boolean = true,
    cachedSystem?: string,
    model?: string
): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number } }> {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not set in environment variables.');
    }

    const baseSystem = jsonMode
        ? 'You are a strategic analyst. Return ONLY valid JSON. No preamble, no markdown fences.'
        : 'You are a strategic analyst.';

    // When a static instruction block is supplied, send it as a cached prefix.
    // The `cache_control` breakpoint tells Anthropic (via OpenRouter) to reuse the
    // prefix across calls within the cache TTL — cheaper tokens + faster first byte.
    // Identical on every call, so it only pays the write cost once under load.
    const systemMessage = cachedSystem
        ? {
            role: 'system',
            content: [
                { type: 'text', text: baseSystem },
                { type: 'text', text: cachedSystem, cache_control: { type: 'ephemeral' } },
            ],
        }
        : { role: 'system', content: baseSystem };

    return await retryWithBackoff(async () => {
        const response = await axios.post(
            OPENROUTER_URL,
            {
                model: model || CLAUDE_MODEL,
                temperature: 0,
                max_tokens: 8192,
                messages: [
                    systemMessage,
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'http://localhost:5174',
                    'X-Title': 'JobHub',
                    'Content-Type': 'application/json',
                },
                timeout: 90000,
            }
        );

        const choices = response.data.choices;
        if (!choices?.length) {
            throw new Error(`OpenRouter returned no choices. Body: ${JSON.stringify(response.data).substring(0, 300)}`);
        }
        const content = choices[0].message.content as string;
        const usage = response.data.usage || {};
        return {
            content,
            usage: {
                promptTokens: usage.prompt_tokens || 0,
                completionTokens: usage.completion_tokens || 0,
            }
        };
    });
}

/**
 * Calls Perplexity Sonar Pro via OpenRouter for web-search-backed research.
 * Returns content + citations from the search results.
 */
export async function callPerplexity(
  prompt: string,
  jsonMode: boolean = true
): Promise<{ content: string; citations: string[] }> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set in environment variables.');
  }

  return await retryWithBackoff(async () => {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model: 'perplexity/sonar-pro',
        temperature: 0,
        // sonar-pro is verbose (markdown + inline citations); 1024 truncated the
        // JSON mid-string and broke parsing. 2500 leaves headroom to close it.
        max_tokens: 2500,
        messages: [
          {
            role: 'system',
            content: jsonMode
              ? 'You are a company research assistant. Return ONLY valid JSON. No preamble, no markdown fences.'
              : 'You are a company research assistant.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://aussiegradcareers.com.au',
          'X-Title': process.env.OPENROUTER_APP_TITLE || 'JobHub',
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const choices = response.data.choices;
    if (!choices?.length) {
      throw new Error(`OpenRouter returned no choices. Body: ${JSON.stringify(response.data).substring(0, 300)}`);
    }
    const choice = choices[0];
    const content = choice.message.content as string;
    if (choice.finish_reason === 'length') {
      console.warn('[callPerplexity] response hit max_tokens — output truncated, JSON may be incomplete');
    }
    const citations: string[] = (response.data as any).citations ?? [];
    return { content, citations };
  });
}

/**
 * Generates embeddings for a given text.
 */
export async function embedText(text: string): Promise<number[]> {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not set.');
    }

    return await retryWithBackoff(async () => {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/embeddings',
            {
                model: 'openai/text-embedding-3-small',
                input: text
            },
            {
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            }
        );
        return response.data.data[0].embedding;
    });
}


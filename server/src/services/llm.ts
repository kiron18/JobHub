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
export async function callLLM(prompt: string, jsonMode: boolean = true) {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not set in environment variables.');
    }

    return await retryWithBackoff(async () => {
        const response = await axios.post(
            OPENROUTER_URL,
            {
                model: 'meta-llama/llama-3.3-70b-instruct',
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

        return response.data.choices[0].message.content;
    });
}

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'anthropic/claude-sonnet-4-5';

/**
 * Calls Claude via OpenRouter for strategic/reasoning tasks.
 * Returns content + usage for cost tracking.
 */
export async function callClaude(
    prompt: string,
    jsonMode: boolean = true
): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number } }> {
    if (!OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY is not set in environment variables.');
    }

    return await retryWithBackoff(async () => {
        const response = await axios.post(
            OPENROUTER_URL,
            {
                model: CLAUDE_MODEL,
                temperature: 0,
                max_tokens: 8192,
                messages: [
                    {
                        role: 'system',
                        content: jsonMode
                            ? 'You are a strategic analyst. Return ONLY valid JSON. No preamble, no markdown fences.'
                            : 'You are a strategic analyst.'
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
                    'HTTP-Referer': 'http://localhost:5174',
                    'X-Title': 'JobHub',
                    'Content-Type': 'application/json',
                },
                timeout: 90000,
            }
        );

        const content = response.data.choices[0].message.content as string;
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


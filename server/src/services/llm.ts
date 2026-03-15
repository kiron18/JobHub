import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

console.log(`LLM service initialized with key length: ${OPENROUTER_API_KEY?.length}, prefix: ${OPENROUTER_API_KEY?.substring(0, 10)}...`);

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
                    'HTTP-Referer': 'http://localhost:5174',
                    'X-Title': 'JobDash',
                    'Content-Type': 'application/json',
                },
                timeout: 60000,
            }
        );

        return response.data.choices[0].message.content;
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


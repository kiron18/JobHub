import { callLLM } from '../services/llm';

export async function callLLMWithRetry(
  prompt: string,
  isJson: boolean,
  maxRetries = 3
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callLLM(prompt, isJson);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[LLM Retry] Attempt ${attempt} failed. Retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('All LLM retries exhausted');
}

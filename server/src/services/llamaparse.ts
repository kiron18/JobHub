import axios from 'axios';
import FormData from 'form-data';

const BASE_URL = 'https://api.cloud.llamaindex.ai/api/v1/parsing';
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30; // 60s max wait

/**
 * Parses a document buffer via LlamaParse and returns clean Markdown.
 * LlamaParse preserves section headers, multi-column layouts, and tables —
 * significantly better than pdf-parse for structured resumes.
 *
 * Throws if the API key is missing, the upload fails, or the job errors.
 */
export async function parseWithLlamaParse(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!apiKey) throw new Error('LLAMA_CLOUD_API_KEY not set');

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  };

  // 1. Upload the file
  const form = new FormData();
  form.append('file', buffer, { filename, contentType: 'application/pdf' });

  const uploadRes = await axios.post<{ id: string; status: string }>(
    `${BASE_URL}/upload`,
    form,
    { headers: { ...headers, ...form.getHeaders() }, timeout: 30000 },
  );

  const jobId = uploadRes.data.id;
  if (!jobId) throw new Error('LlamaParse upload returned no job ID');

  // 2. Poll until complete
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const statusRes = await axios.get<{ status: string; error?: string }>(
      `${BASE_URL}/job/${jobId}`,
      { headers, timeout: 10000 },
    );

    const { status, error } = statusRes.data;

    if (status === 'SUCCESS') {
      // 3. Fetch markdown result
      const resultRes = await axios.get<{ markdown: string }>(
        `${BASE_URL}/job/${jobId}/result/markdown`,
        { headers, timeout: 10000 },
      );
      return resultRes.data.markdown ?? '';
    }

    if (status === 'ERROR') {
      throw new Error(`LlamaParse job failed: ${error ?? 'unknown error'}`);
    }

    // status === 'PENDING' — keep polling
  }

  throw new Error('LlamaParse job timed out after 60s');
}

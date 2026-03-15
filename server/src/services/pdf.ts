// @ts-ignore
import pdf from 'pdf-parse';

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
        // pdf-parse uses an older CJS export style that can be tricky with ESM/TS imports
        // Using a dynamic require or the direct imported function if available
        const PDFParser = typeof pdf === 'function' ? pdf : (pdf as any).default || pdf;
        const data = await PDFParser(buffer);
        return data.text;
    } catch (error) {



        console.error('PDF Extraction Error:', error);
        throw new Error('Failed to parse PDF file.');
    }
}

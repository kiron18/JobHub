export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
        // Dynamic import prevents server crash on environments missing browser globals (Node 18)
        const pdfModule = await import('pdf-parse');
        const pdfParse = (pdfModule as any).default || pdfModule;
        const data = await pdfParse(buffer);
        return data.text;
    } catch (error) {
        console.error('PDF Extraction Error:', error);
        throw new Error('Failed to parse PDF file.');
    }
}

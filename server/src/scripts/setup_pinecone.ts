import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'jobhub-achievements';

async function setup() {
    if (!PINECONE_API_KEY) {
        console.error('❌ PINECONE_API_KEY is missing');
        process.exit(1);
    }

    const pc = new Pinecone({ apiKey: PINECONE_API_KEY });

    try {
        console.log(`Checking if index "${PINECONE_INDEX_NAME}" exists...`);
        const indexes = await pc.listIndexes();
        const exists = indexes.indexes?.some(idx => idx.name === PINECONE_INDEX_NAME);

        if (!exists) {
            console.log(`🚀 Creating index "${PINECONE_INDEX_NAME}"...`);
            await pc.createIndex({
                name: PINECONE_INDEX_NAME,
                dimension: 1536, // OpenAI embedding-3-small dimension
                metric: 'cosine',
                spec: {
                    serverless: {
                        cloud: 'aws',
                        region: 'us-east-1'
                    }
                }
            });
            console.log('✅ Index created successfully. It may take a minute to be ready.');
        } else {
            console.log(`✅ Index "${PINECONE_INDEX_NAME}" already exists.`);
        }
    } catch (error) {
        console.error('❌ Error setting up Pinecone:', error);
    }
}

setup();

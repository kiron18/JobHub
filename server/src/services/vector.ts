import { Pinecone } from '@pinecone-database/pinecone';
import { embedText } from './llm';
import dotenv from 'dotenv';

dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'jobhub-achievements';

// Lazy singleton — avoids crash at startup when PINECONE_API_KEY is missing
let _pc: Pinecone | null = null;
function getPinecone(): Pinecone {
  if (!_pc) {
    if (!PINECONE_API_KEY) throw new Error('PINECONE_API_KEY env var is not set');
    _pc = new Pinecone({ apiKey: PINECONE_API_KEY });
  }
  return _pc;
}

/**
 * Upserts an achievement into Pinecone for semantic search.
 */
export async function indexAchievement(
    userId: string,
    achievementId: string,
    text: string,
    metadata: any = {}
) {
    try {
        const index = getPinecone().index(PINECONE_INDEX_NAME);
        const vector = await embedText(text);

        await index.namespace(userId).upsert({
            records: [
                {
                    id: achievementId,
                    values: vector,
                    metadata: {
                        ...metadata,
                        userId,
                        text,
                        type: 'achievement'
                    },
                }
            ]
        });
        console.log(`✅ Indexed achievement ${achievementId} in Pinecone namespace ${userId}`);
    } catch (error) {
        console.error('Pinecone Indexing Error:', error);
    }
}

/**
 * Searches for relevant achievements based on a query.
 */
export async function searchAchievements(userId: string, query: string, topK: number = 3) {
    try {
        const index = getPinecone().index(PINECONE_INDEX_NAME);
        const vector = await embedText(query);

        const results = await index.namespace(userId).query({
            vector,
            topK,
            includeMetadata: true,
        });

        return results.matches;
    } catch (error) {
        console.error('Pinecone Search Error:', error);
        return [];
    }
}

/**
 * Deletes an achievement from Pinecone.
 */
export async function deleteAchievement(userId: string, achievementId: string) {
    try {
        const index = getPinecone().index(PINECONE_INDEX_NAME);
        await index.namespace(userId).deleteOne({ id: achievementId });
        console.log(`🗑️ Deleted achievement ${achievementId} from Pinecone namespace ${userId}`);
    } catch (error) {
        console.error('Pinecone Deletion Error:', error);
    }
}



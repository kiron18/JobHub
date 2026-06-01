import { Pinecone } from '@pinecone-database/pinecone';
import { embedText } from './llm';
import dotenv from 'dotenv';

dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'jobhub-achievements';

// All achievements live in ONE namespace, isolated per-user by a userId metadata
// filter on query. The old design used one namespace per user, which hit the
// serverless 100-namespace cap once we crossed 100 users (every user past 100
// silently failed to index). A single namespace has no such cap, and achievement
// IDs are globally unique so they never collide across users.
export const SHARED_NAMESPACE = 'achievements';

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
    const index = getPinecone().index(PINECONE_INDEX_NAME);
    const vector = await embedText(text);

    // Pinecone rejects null/undefined metadata values ("Metadata value must be a
    // string, number, boolean or list of strings"). An achievement saved without
    // a metric arrives here with metric:null — strip empty fields so the upsert
    // succeeds and the achievement is actually searchable, instead of throwing
    // and silently never being indexed.
    const cleanMeta = Object.fromEntries(
        Object.entries(metadata).filter(([, v]) => v !== null && v !== undefined)
    );

    await index.namespace(SHARED_NAMESPACE).upsert({
        records: [
            {
                id: achievementId,
                values: vector,
                metadata: {
                    ...cleanMeta,
                    userId,
                    text,
                    type: 'achievement'
                },
            }
        ]
    });
    console.log(`Indexed achievement ${achievementId} for user ${userId}`);
}

/**
 * Searches for relevant achievements based on a query.
 */
export async function searchAchievements(userId: string, query: string, topK: number = 3) {
    try {
        const index = getPinecone().index(PINECONE_INDEX_NAME);
        const vector = await embedText(query);

        const results = await index.namespace(SHARED_NAMESPACE).query({
            vector,
            topK,
            includeMetadata: true,
            // Isolate to this user's achievements within the shared namespace.
            filter: { userId: { $eq: userId } },
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
        // Achievement IDs are globally unique, so delete-by-id in the shared
        // namespace targets exactly this record.
        await index.namespace(SHARED_NAMESPACE).deleteOne({ id: achievementId });
        console.log(`🗑️ Deleted achievement ${achievementId} (user ${userId})`);
    } catch (error) {
        console.error('Pinecone Deletion Error:', error);
    }
}



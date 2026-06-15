import { PrismaClient } from '@prisma/client';

// Use default configuration from schema.prisma
// The schema has url = env("DATABASE_URL") and directUrl = env("DIRECT_URL")
export const prisma = new PrismaClient();

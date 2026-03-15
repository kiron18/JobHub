import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

console.log('--- ENV DEBUG ---');
console.log('CWD:', process.cwd());
console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('.env exists:', fs.existsSync('.env'));
console.log('dev.db exists:', fs.existsSync('dev.db'));
console.log('prisma/dev.db exists:', fs.existsSync('prisma/dev.db'));
console.log('-----------------');

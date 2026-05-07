# Local Development Guide

This document outlines how to set up and run the JobHub project locally for development.

## Prerequisites

- Node.js (v18+ recommended)
- npm or yarn

## Environment Setup

### 1. Root Directory (Frontend)
Ensure you have a `.env.local` file in the root with the following:
```env
VITE_API_URL=http://localhost:3002/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Server Directory (Backend)
Ensure you have a `.env` file in the `server/` directory with the following:
```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3002
DEV_BYPASS_AUTH=true
NODE_ENV=development
```

## Running the Application

### 1. Start the Backend
Open a terminal in the `server/` directory:
```bash
cd server
npm run dev
```
The backend will run on `http://localhost:3002`.

### 2. Start the Frontend
Open a terminal in the root directory:
```bash
npm run dev
```
The frontend will run on `http://localhost:3000`.

## Key Features for Local Dev

- **Auth Bypass**: When `DEV_BYPASS_AUTH=true` is set in the backend `.env`, all requests will be authenticated as a default test user (`kiron182@gmail.com`).
- **Live Reload**: Both frontend and backend use watch modes for instant feedback on changes.
- **Local Logs**: In development mode, the backend mirrors logs to `server/server.log`.

## Troubleshooting

- **Port Conflicts**: If port 3000 or 3002 is in use, use `netstat -ano | findstr :<port>` to find the PID and `taskkill /F /PID <pid>` to kill it.
- **Database Migrations**: If you change the Prisma schema, run `npx prisma generate` in the `server/` directory.

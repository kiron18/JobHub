# Job Application Productivity Hub (Job Dash) - Guiding Document

## 🎯 Product Vision
A workflow-optimized hub designed to minimize the friction of job applications. It moves seekers from **"Job Description"** to **"Tailored Application"** using a structured **Achievement Bank** and Intelligent Match Engine. Instead of managing static documents, users manage a modular database of career value.

---

## 🏗️ Technical Stack
- **Frontend**: React (Vite), Tailwind CSS v4, Framer Motion, Lucide React.
- **Backend**: Express.js, TypeScript.
- **Database**: PostgreSQL (via Prisma), currently using SQLite for local development.
- **AI Engine**: LLM-powered extraction and analysis via OpenRouter (Meta Llama 3.3 70B).

---

## 🧠 Core Intelligence Logic

### 1. Resume Extraction (2-Stage Process)
To ensure high accuracy, resumes are parsed in two distinct phases:
- **Stage 1 (Structure)**: Extracts candidate profile data (Contact info, Education, Work History).
- **Stage 2 (Achievement Detection)**: Scans the text specifically for "High-Value Achievements" with metrics and impact, which are then saved into the **Achievement Bank**.

### 2. Match Engine (The "Brain")
Analyzes a provided Job Description (JD) against the candidate's Achievement Bank:
- **Match Score**: A percentage indicating alignment.
- **Keyword Alignment**: Visualizing matched vs. missing skills.
- **Strategy Highlights**: AI recommends which specific achievements to emphasize for this specific job.
- **Gap Analysis**: Identifies what's missing to help the user prepare for interviews.

---

## 📊 Component Architecture

### Frontend Components
- `MatchEngine.tsx`: The primary dashboard interaction tool for JD analysis.
- `ResumeImporter.tsx`: Handles the pasting and refinement of source resume data.
- `DashboardLayout.tsx`: Premium glassmorphism layout with persistent navigation.

### API Endpoints
- `POST /api/extract/resume`: Triggers the 2-stage LLM extraction.
- `POST /api/analyze/job`: Compares JD against the DB profile.
- `POST /api/profile`: Upserts candidate data and achievements.
- `GET /api/profile`: Retrieves the active candidate profile.

---

## 💾 Database Schema Highlights
- `CandidateProfile`: Basic info and professional summary.
- `Achievement`: The "Gold Mines" found in resumes (Description, Metric, Date, Skills, Tags).
- `Experience`: Work history linked to achievements.
- `JobApplication`: Tracker for specific roles being pursued.

---

## 🛠️ Setup & Maintenance
1. **Env Vars**: Needs `OPENROUTER_API_KEY` and `DATABASE_URL`.
2. **Database**: Use `npx prisma db push` to initialize the local SQLite `dev.db`.
3. **Styles**: Uses Tailwind v4 architecture (no `tailwind.config.js`). Custom theme and components are defined in `src/index.css`.

---

## 🚀 Future Roadmap
- **Live PDF Preview**: Using `@react-pdf/renderer` to generate tailored resumes on-the-fly.
- **Application Tracker**: Kanban-style board for status management.
- **STAR Response Generator**: Creating selection criteria responses based on the Achievement Bank.
- **Chrome Extension**: Rapid job analysis directly on LinkedIn/Indeed.

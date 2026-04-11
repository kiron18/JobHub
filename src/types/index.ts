export interface CandidateProfile {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    location?: string;
    professionalSummary?: string;
    targetRole?: string | null;
    seniority?: string | null;
    headshotUrl?: string | null;
    skills: string[];
    experience: Experience[];
    education: Education[];
    achievements: Achievement[];
    createdAt: string;
    updatedAt: string;
}

export interface Experience {
    id: string;
    company: string;
    role: string;
    startDate: string;
    endDate?: string;
    isCurrent: boolean;
    description?: string;
    achievements: Achievement[];
}

export interface Education {
    id: string;
    institution: string;
    degree: string;
    year: string;
}

export interface Achievement {
    id: string;
    title: string;
    description: string;
    metric?: string;
    skills: string[];
    tags: string[];
}

export interface JobApplication {
    id: string;
    title: string;
    company: string;
    description: string;
    dateApplied?: string;
    status: 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'REJECTED' | 'OFFER';
    documents: Document[];
    createdAt: string;
}

export interface Document {
    id: string;
    type: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE';
    content: string;
    createdAt: string;
}

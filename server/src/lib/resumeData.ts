// Server-local copy of ResumeData type.
// Duplicated from src/lib/resumeData.ts to avoid rootDir import issues.
// Keep in sync manually.

export type ResumeData = {
    name: string;
    targetRole?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    location?: string;
    professionalSummary?: string;
    skills?: string;
    additionalExperienceLine?: string;
    experience: Array<{
        id: string;
        role: string;
        company: string;
        location?: string;
        startDate: string;
        endDate?: string | null;
        isCurrent?: boolean;
        description?: string;
    }>;
    education: Array<{
        degree: string;
        field?: string;
        institution: string;
        location?: string;
        year?: string;
        startDate?: string;
        endDate?: string;
    }>;
    certifications?: Array<{ name: string; issuingBody: string; year?: string }>;
    volunteering?: Array<{ role: string; organization: string; description?: string }>;
    languages?: Array<{ name: string; proficiency: string }>;
    showReferees?: boolean;
};

// Shared ResumeData type — single source of truth for both client and server.
// Pure type file (no JSX, no runtime) so the server tsconfig can import it.

export type ResumeData = {
    name: string;
    targetRole?: string;
    email?: string;
    phone?: string;
    linkedin?: string;
    location?: string;
    professionalSummary?: string;
    skills?: string;
    experience: Array<{
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

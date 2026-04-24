import type React from 'react';

export type ApplicationStatus = 'SAVED' | 'APPLIED' | 'INTERVIEW' | 'REJECTED' | 'OFFER';
export type JobPriority = 'DREAM' | 'TARGET' | 'BACKUP' | null;

export interface TrackerDocument {
    id: string;
    type: 'RESUME' | 'COVER_LETTER' | 'STAR_RESPONSE';
    content: string;
    title?: string;
    createdAt: string;
}

export interface JobApplication {
    id: string;
    title: string;
    company: string;
    description: string;
    status: ApplicationStatus;
    dateApplied: string | null;
    closingDate: string | null;
    notes: string | null;
    sourceUrl: string | null;
    priority: JobPriority;
    documents: TrackerDocument[];
    createdAt: string;
    matchScore?: number;     // 0–100 weighted composite from 10-dimension scoring
    overallGrade?: string;   // "A" | "B" | "C" | "D" | "F"
}

export const PRIORITY_CONFIG: Record<NonNullable<JobPriority>, { label: string; dot: string; border: string; bg: string; text: string }> = {
    DREAM:  { label: 'Dream',  dot: '#f59e0b', border: 'rgba(245,158,11,0.35)', bg: 'rgba(245,158,11,0.08)', text: '#fbbf24' },
    TARGET: { label: 'Target', dot: '#818cf8', border: 'rgba(99,102,241,0.35)', bg: 'rgba(99,102,241,0.08)',  text: '#a5b4fc' },
    BACKUP: { label: 'Backup', dot: '#6b7280', border: 'rgba(107,114,128,0.3)', bg: 'rgba(107,114,128,0.07)', text: '#9ca3af' },
};

export type StatusConfigEntry = { label: string; color: string; icon: React.FC<{ size?: number; className?: string }> };

export const STATUS_FLOW: ApplicationStatus[] = ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'];

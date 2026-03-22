import axios from 'axios';
import type { CandidateProfile, JobApplication } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

const api = axios.create({
    baseURL: API_BASE_URL,
});

export const profileService = {
    getProfile: async (): Promise<CandidateProfile> => {
        const { data } = await api.get('/profile');
        return data;
    },
    updateProfile: async (profile: Partial<CandidateProfile>): Promise<CandidateProfile> => {
        const { data } = await api.patch('/profile', profile);
        return data;
    },
};

export const jobService = {
    getJobs: async (): Promise<JobApplication[]> => {
        const { data } = await api.get('/jobs');
        return data;
    },
    createJob: async (job: Partial<JobApplication>): Promise<JobApplication> => {
        const { data } = await api.post('/jobs', job);
        return data;
    },
};

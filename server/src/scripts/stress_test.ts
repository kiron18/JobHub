import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * Enhanced Stress Test Script for JobHub (Crush Test)
 * Objective: Generate 100+ synthetic resumes with noise and run them through the pipeline
 * with concurrency control, exponential backoff, and advanced reporting.
 */

const API_BASE = 'http://localhost:3002/api';
const OUTPUT_DIR = path.join(__dirname, '../../test_results');
const CONCURRENCY_LIMIT = 5;
const MAX_RETRIES = 3;

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

const ROLES = ['Senior Software Engineer', 'Product Manager', 'Operations Lead', 'Fullstack Developer', 'Marketing Executive', 'Digital Specialist'];
const COMPANIES = ['Atlassian', 'Canva', 'Google', 'Commonwealth Bank', 'Woolworths', 'Local Startup'];
const VERBS = ['Led', 'Optimized', 'Architected', 'Spearheaded', 'Delivered', 'Automated', 'Increased', 'Reduced'];
const TECHNOLOGIES = ['React & TypeScript', 'GCP infrastructure', 'Salesforce CRM', 'Python Data Pipelines', 'Agile Methodologies'];
const METRICS = [
    'resulting in a 25% increase in team velocity',
    'saving the company $50k per annum in licensing costs',
    'improving customer retention by 15% over 6 months',
    'reducing system latency from 500ms to 50ms',
    'leading to a successful $2M product launch'
];

/**
 * Randomly introduces typos, grammatical errors, and formatting noise.
 */
function addNoise(text: string): string {
    const chance = Math.random();
    if (chance > 0.8) return text; // 20% clean

    const words = text.split(' ');
    const noisyWords = words.map(word => {
        // Randomly swap adjacent characters (typo)
        if (Math.random() > 0.95 && word.length > 3) {
            const idx = Math.floor(Math.random() * (word.length - 1));
            const chars = word.split('');
            [chars[idx], chars[idx+1]] = [chars[idx+1], chars[idx]];
            return chars.join('');
        }
        // Randomly capitalize entire word
        if (Math.random() > 0.98) return word.toUpperCase();
        return word;
    });

    let noisyText = noisyWords.join(' ');
    
    // Add extra spaces
    if (Math.random() > 0.9) noisyText = noisyText.replace(/ /g, '  ');
    // Random header messed up
    if (Math.random() > 0.9) noisyText = noisyText.replace('EXPERIENCE', 'expERIEnCE..');

    return noisyText;
}

function generateRandomResume() {
    const roleCount = Math.floor(Math.random() * 3) + 1;
    const experience = [];
    
    for (let i = 0; i < roleCount; i++) {
        const bullets = [];
        const bulletCount = Math.floor(Math.random() * 4) + 1;
        for (let j = 0; j < bulletCount; j++) {
            const verb = VERBS[Math.floor(Math.random() * VERBS.length)];
            const tech = TECHNOLOGIES[Math.floor(Math.random() * TECHNOLOGIES.length)];
            const metric = Math.random() > 0.4 ? METRICS[Math.floor(Math.random() * METRICS.length)] : '';
            bullets.push(`${verb} ${tech} projects. ${metric}`);
        }
        
        experience.push({
            role: ROLES[Math.floor(Math.random() * ROLES.length)],
            company: COMPANIES[Math.floor(Math.random() * COMPANIES.length)],
            duration: '2020 - 2022',
            description: bullets.join('\n')
        });
    }

    const name = `Candidate ${Math.floor(Math.random() * 10000)}`;
    
    let text = `Name: ${name}\n\nEXPERIENCE\n`;
    experience.forEach(exp => {
        text += `${exp.role} | ${exp.company} | ${exp.duration}\n${exp.description}\n\n`;
    });
    
    return { name, text: addNoise(text), rawData: experience };
}

/**
 * Exponential backoff wrapper for API calls.
 */
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = MAX_RETRIES, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        // Retry on 429 (Rate Limit) or network errors like ECONNRESET
        const isRetryable = error.response?.status === 429 || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
        if (retries > 0 && isRetryable) {
            const nextDelay = delay * 2;
            console.warn(`   ⚠️ Retrying due to ${error.code || error.response?.status}. Remaining attempts: ${retries}. Backoff: ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryWithBackoff(fn, retries - 1, nextDelay);
        }
        throw error;
    }
}

function calculatePercentile(data: number[], p: number) {
    if (data.length === 0) return 0;
    const sorted = [...data].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * (p / 100);
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
        return sorted[base];
    }
}

async function runTest(count: number) {
    console.log(`🚀 Starting Crush Test: Processing ${count} resumes with concurrency ${CONCURRENCY_LIMIT}...`);
    const results: any[] = [];
    const latencies: number[] = [];
    const startTime = Date.now();

    const tasks = Array.from({ length: count }, (_, i) => async () => {
        const resume = generateRandomResume();
        const start = Date.now();
        const candidateId = i + 1;
        let currentStep = 'generating';

        try {
            // 1. Extract
            currentStep = 'extraction';
            const extractRes = await retryWithBackoff(() => axios.post(`${API_BASE}/extract/resume`, { text: resume.text }));
            const extracted = extractRes.data;

            // 2. Save Profile
            currentStep = 'profile_save';
            await retryWithBackoff(() => axios.post(`${API_BASE}/profile`, extracted));

            const duration = Date.now() - start;
            latencies.push(duration);
            
            results.push({
                index: candidateId,
                name: resume.name,
                status: 'Success',
                latencyMs: duration,
                achievementsFound: extracted.discoveredAchievements?.length || 0,
                alertsCount: extracted.coachingAlerts?.length || 0
            });
            process.stdout.write('✓');
        } catch (error: any) {
            process.stdout.write('✗');
            results.push({
                index: candidateId,
                name: resume.name,
                status: 'Failed',
                failedAt: currentStep,
                error: error.message,
                details: error.response?.data
            });
        }
    });

    // Simple concurrency limiter
    const pool = new Set();
    const executeTasks = async () => {
        for (const task of tasks) {
            if (pool.size >= CONCURRENCY_LIMIT) {
                await Promise.race(pool);
            }
            const promise = task().finally(() => pool.delete(promise));
            pool.add(promise);
        }
        await Promise.all(pool);
    };

    await executeTasks();

    const totalDuration = (Date.now() - startTime) / 1000;
    const reportPath = path.join(OUTPUT_DIR, `crush_test_report_${Date.now()}.json`);
    
    const summary = {
        totalTimeSeconds: totalDuration,
        averageLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
        p95LatencyMs: calculatePercentile(latencies, 95),
        p99LatencyMs: calculatePercentile(latencies, 99),
        successCount: results.filter(r => r.status === 'Success').length,
        failureCount: results.filter(r => r.status === 'Failed').length,
        memUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        results
    };

    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    console.log(`\n\n✅ Crush Test Complete.`);
    console.log(`Summary: ${summary.successCount}/${count} succeeded.`);
    console.log(`P95 Latency: ${summary.p95LatencyMs.toFixed(2)}ms`);
    console.log(`P99 Latency: ${summary.p99LatencyMs.toFixed(2)}ms`);
    console.log(`Total Time: ${totalDuration.toFixed(2)}s`);
    console.log(`Report saved to: ${reportPath}`);
}

const count = parseInt(process.argv[2]) || 100;
runTest(count).catch(err => console.error('\nPanic:', err));

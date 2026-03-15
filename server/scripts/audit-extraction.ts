
import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_URL = 'http://localhost:3002/api/extract/resume';

const testResumes = [
    {
        name: "Case 1: Extremely Poor / Missing Data",
        text: `
John Doe
Software Engineer
I worked at some company. I wrote code in Javascript.
I went to university.
        `
    },
    {
        name: "Case 2: Average / Vague Bullets",
        text: `
Jane Smith | janessmith@email.com | 0400 000 000
Software Engineer | Melboure, VIC

Experience:
Senior Developer, TechCorp (2020 - Present)
- Responsible for leading a team of developers.
- Developed features for the main application.
- Improved system performance and code quality.
- Mentored junior staff and attended scrum meetings.

Education:
B.Sc in Computer Science, RMIT University
        `
    },
    {
        name: "Case 3: Buzzwords & Clichés",
        text: `
Peter Pan | peter@neverland.com
Dynamic and passionate team player with excellent communication skills.
Proven track record of success in fast-paced environments.
Seeking a challenging role to leverage my synergies.

Skills:
Hard worker, Punctuality, Microsoft Word.
        `
    }
];

async function runAudit() {
    console.log("Starting AI Extraction Quality Audit...\n");

    for (const testCase of testResumes) {
        console.log(`--- Running: ${testCase.name} ---`);
        try {
            const response = await axios.post(API_URL, { text: testCase.text });
            const data = response.data;

            console.log("\nJSON Shape Check:");
            const keys = Object.keys(data);
            console.log("Root Keys:", keys.join(", "));
            
            const hasAlerts = data.coachingAlerts && Array.isArray(data.coachingAlerts);
            console.log("Has coachingAlerts array:", hasAlerts);

            if (hasAlerts) {
                console.log(`Found ${data.coachingAlerts.length} alerts.`);
                data.coachingAlerts.forEach((alert: any, i: number) => {
                    console.log(`  [${alert.color.toUpperCase()}] ${alert.type}: ${alert.message}`);
                });
            }

            // Verify a few mandatory fields
            console.log("\nData Density Check:");
            console.log("  Profile Name:", data.profile?.name || "MISSING");
            console.log("  Skills Count:", data.skills?.technical?.length || 0);
            console.log("  Experience Count:", data.experience?.length || 0);
            
            console.log("\nAchievement Metadata Check:");
            if (data.discoveredAchievements && data.discoveredAchievements.length > 0) {
                data.discoveredAchievements.forEach((ach: any, i: number) => {
                    console.log(`  Achievement ${i + 1}: ${ach.title}`);
                    console.log(`    Role Context (Exp Index): ${ach.experienceIndex}`);
                    console.log(`    Metric Type: ${ach.metricType || "NONE"}`);
                    console.log(`    Industry: ${ach.industry || "NONE"}`);
                    console.log(`    Metric: ${ach.metric || "NONE"}`);
                });
            } else {
                console.log("  No achievements discovered.");
            }
        } catch (error: any) {
            console.error(`Error running ${testCase.name}:`, error.response?.data || error.message);
        }
    }
}

runAudit();

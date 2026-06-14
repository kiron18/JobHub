// Test script: Verify fidelity guard strips invented employer from Shetty-like extraction
import { groundExtraction } from '../src/lib/fidelityGuard';

// Simulated Shetty resume text (excerpt with real employers)
const shettyResumeText = `
GANESH PRASAD SHETTY
Sydney, Australia

PROFESSIONAL EXPERIENCE

GeneTech Solutions
Software Developer Intern
June 2023 – August 2023

Lanka Hospitals
IT Support Specialist
January 2022 – December 2022

Deakin University
Research Assistant
March 2021 – November 2021

Red Rooster
Kitchen Hand
June 2019 – February 2020
`;

// Simulated Stage 1 extraction output (what the LLM might return)
// Including the invented "Noble Seeds Private Limited" for the seed trainee role
const simulatedExtraction = {
  profile: {
    name: 'Ganesh Prasad Shetty',
    location: 'Sydney, Australia',
  },
  experience: [
    {
      company: 'GeneTech Solutions',
      role: 'Software Developer Intern',
      startDate: '2023-06',
      endDate: '2023-08',
      bullets: ['Developed web applications', 'Worked with React and Node.js'],
    },
    {
      company: 'Lanka Hospitals',
      role: 'IT Support Specialist',
      startDate: '2022-01',
      endDate: '2022-12',
      bullets: ['Provided technical support', 'Managed ticketing system'],
    },
    {
      company: 'Deakin University',
      role: 'Research Assistant',
      startDate: '2021-03',
      endDate: '2021-11',
      bullets: ['Conducted data analysis', 'Published research findings'],
    },
    {
      company: 'Noble Seeds Private Limited',  // INVENTED - not in resume
      role: 'Seed Trainee',
      startDate: '2020-03',
      endDate: '2020-05',
      bullets: ['Assisted with seed processing'],
    },
    {
      company: 'Red Rooster',
      role: 'Kitchen Hand',
      startDate: '2019-06',
      endDate: '2020-02',
      bullets: ['Food preparation', 'Kitchen cleaning'],
    },
  ],
};

console.log('=== Fidelity Guard Test: Shetty Resume ===\n');
console.log('Input extraction has 5 experience entries:');
simulatedExtraction.experience.forEach((exp, i) => {
  console.log(`  ${i + 1}. ${exp.company} — ${exp.role}`);
});

const { cleaned, stripped } = groundExtraction(simulatedExtraction, shettyResumeText);

console.log('\n--- Results ---');
console.log(`\nStripped entries (${stripped.length}):`);
if (stripped.length === 0) {
  console.log('  (none)');
} else {
  stripped.forEach((s) => {
    console.log(`  • ${s.field}: "${s.value}"`);
    console.log(`    Reason: ${s.reason}`);
  });
}

console.log(`\nCleaned experience entries (${cleaned.experience.length}):`);
cleaned.experience.forEach((exp: any, i: number) => {
  const status = exp.company === null ? '❌ NULL (stripped)' : '✓ KEPT';
  console.log(`  ${i + 1}. ${exp.company || '(null)'} — ${exp.role} ${status}`);
});

// Assertions
const nobleSeedsStripped = stripped.some(
  (s) => s.value === 'Noble Seeds Private Limited'
);
const geneTechKept = cleaned.experience[0]?.company === 'GeneTech Solutions';
const lankaKept = cleaned.experience[1]?.company === 'Lanka Hospitals';
const redRoosterKept = cleaned.experience[4]?.company === 'Red Rooster';

console.log('\n=== Verification ===');
console.log(`✓ Noble Seeds Private Limited stripped: ${nobleSeedsStripped}`);
console.log(`✓ GeneTech Solutions kept: ${geneTechKept}`);
console.log(`✓ Lanka Hospitals kept: ${lankaKept}`);
console.log(`✓ Red Rooster kept: ${redRoosterKept}`);

const allPass = nobleSeedsStripped && geneTechKept && lankaKept && redRoosterKept;
console.log(`\n${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

process.exit(allPass ? 0 : 1);

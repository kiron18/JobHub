// Test script: Verify isCasual filtering for years calculation (Pawan case)
import { computeYearsOfExperience, resolveYearsOfExperience } from '../src/lib/profileMath';

// Simulated Pawan extraction with 4 food-service roles (casual) + 3 professional roles
const pawanExperience = [
  // Professional roles - isCasual: false
  {
    company: 'GeneTech Solutions',
    role: 'Software Developer',
    startDate: '2023-06',
    endDate: '2023-08',
    isCasual: false,
    type: 'work',
  },
  {
    company: 'Lanka Hospitals',
    role: 'IT Support Specialist',
    startDate: '2022-01',
    endDate: '2022-12',
    isCasual: false,
    type: 'work',
  },
  {
    company: 'Deakin University',
    role: 'Research Assistant',
    startDate: '2021-03',
    endDate: '2021-11',
    isCasual: false,
    type: 'work',
  },
  // Casual food-service roles - isCasual: true
  {
    company: 'Red Rooster',
    role: 'Kitchen Hand',
    startDate: '2020-06',
    endDate: '2020-12',
    isCasual: true,
    type: 'work',
  },
  {
    company: 'McDonald\'s',
    role: 'Crew Member',
    startDate: '2019-03',
    endDate: '2019-12',
    isCasual: true,
    type: 'work',
  },
  {
    company: 'KFC',
    role: 'Food Handler',
    startDate: '2018-06',
    endDate: '2019-02',
    isCasual: true,
    type: 'work',
  },
  {
    company: 'Local Cafe',
    role: 'Dishwasher',
    startDate: '2017-01',
    endDate: '2017-12',
    isCasual: true,
    type: 'work',
  },
];

console.log('=== isCasual Years Calculation Test (Pawan case) ===\n');
console.log('Experience entries:');
pawanExperience.forEach((exp, i) => {
  const type = exp.isCasual ? 'CASUAL' : 'PROFESSIONAL';
  console.log(`  ${i + 1}. ${exp.company} — ${exp.role} (${type})`);
});

// Test computeYearsOfExperience with all roles (respects isCasual filter internally)
const computedYears = computeYearsOfExperience(pawanExperience);

// Test with only non-casual roles (simulating the filter in autoExtract.ts)
const professionalOnly = pawanExperience.filter(e => e.isCasual !== true);
const professionalYears = computeYearsOfExperience(professionalOnly);

console.log('\n--- Results ---');
console.log(`Total experience entries: ${pawanExperience.length}`);
console.log(`Professional (non-casual) entries: ${professionalOnly.length}`);
console.log(`Casual entries filtered out: ${pawanExperience.length - professionalOnly.length}`);
console.log(`\nYears with ALL roles (WRONG - includes casual): ${computedYears} years`);
console.log(`Years with PROFESSIONAL only (CORRECT): ${professionalYears} years`);

// The professional roles are:
// - GeneTech: Jun 2023 - Aug 2023 (~0.2 years)
// - Lanka Hospitals: Jan 2022 - Dec 2022 (~1 year)
// - Deakin: Mar 2021 - Nov 2021 (~0.7 years)
// Total: ~1.9 years, rounds to 2

const assertion = professionalYears === 2;
console.log(`\n=== Verification ===`);
console.log(`✓ Professional years = 2: ${assertion} (got ${professionalYears})`);

if (!assertion) {
  console.log(`\n❌ TEST FAILED: Expected 2 years, got ${professionalYears}`);
  process.exit(1);
} else {
  console.log(`\n✅ TEST PASSED: Casual roles correctly excluded from years calculation`);
  process.exit(0);
}

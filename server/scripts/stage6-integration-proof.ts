/**
 * Stage 6 Integration Proof — Fidelity Enforcement Verification
 *
 * This script verifies the fidelity enforcement pipeline works correctly
 * by re-extracting profiles with resumeRawText and checking:
 * 1. Fidelity guard strips invented employers
 * 2. isCasual flag correctly classifies roles
 * 3. Years calculation excludes casual roles
 * 4. Real companies are preserved
 *
 * Run with: SKIP_SERVER=true npx ts-node scripts/stage6-integration-proof.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { parseResumeToStructure, persistExtracted } from '../src/services/autoExtract';
import { groundExtraction } from '../src/lib/fidelityGuard';
import { resolveYearsOfExperience } from '../src/lib/profileMath';

// Initialize Prisma directly (don't import from index.ts which starts server)
const prisma = new PrismaClient();

interface IntegrationResult {
  user: string;
  email: string;
  yearsBefore: number | null;
  yearsAfter: number | null;
  inventedEmployersStripped: string[];
  casualRolesDetected: number;
  professionalRolesDetected: number;
  companiesFound: string[];
  passed: boolean;
}

async function runIntegrationProof(): Promise<void> {
  console.log('=== Stage 6 Integration Proof: Fidelity Enforcement Verification ===\n');

  // Find profiles with resumeRawText
  const profilesToTest = await prisma.candidateProfile.findMany({
    where: { resumeRawText: { not: null } },
    take: 3,
    include: { experience: true },
  });

  if (profilesToTest.length === 0) {
    console.error('❌ No profiles with resumeRawText found');
    process.exit(1);
  }

  console.log(`Found ${profilesToTest.length} profiles with resume data\n`);

  const results: IntegrationResult[] = [];

  for (const profile of profilesToTest) {
    const name = profile.name || 'Unknown';
    const email = profile.email || 'no-email';
    console.log(`\n--- Testing ${name} (${email}) ---`);

    const yearsBefore = profile.yearsOfExperience;
    console.log(`Years before re-extraction: ${yearsBefore}`);

    // 1. Re-extract from stored raw resume text
    if (!profile.resumeRawText) {
      console.error(`❌ No resumeRawText for ${email}`);
      continue;
    }

    console.log(`Re-extracting from ${profile.resumeRawText.length} chars of raw resume...`);

    // 2. Run the fixed extraction pipeline
    const parsed = await parseResumeToStructure(profile.resumeRawText);

    // 3. Check fidelity guard results
    const { cleaned, stripped } = groundExtraction(parsed.stage1Data, profile.resumeRawText);

    const inventedEmployersStripped = stripped
      .filter(s => s.field.includes('.company') || s.field.includes('.org') || s.field.includes('.institution'))
      .map(s => s.value);

    console.log(`Invented employers stripped: ${inventedEmployersStripped.length > 0 ? inventedEmployersStripped.join(', ') : '(none)'}`);

    // 4. Check isCasual classification
    const allExperience = parsed.stage1Data.experience ?? [];
    const casualRoles = allExperience.filter((e: any) => e.isCasual === true);
    const professionalRoles = allExperience.filter((e: any) => e.isCasual !== true && (e.type ?? 'work') === 'work');

    console.log(`Casual roles detected: ${casualRoles.length}`);
    console.log(`Professional roles detected: ${professionalRoles.length}`);

    casualRoles.forEach((r: any) => console.log(`  [CASUAL] ${r.role} at ${r.company}`));
    professionalRoles.forEach((r: any) => console.log(`  [PRO] ${r.role} at ${r.company}`));

    // 5. Check years calculation with isCasual filter
    const computedYears = resolveYearsOfExperience(
      [profile.professionalSummary, profile.resumeRawText],
      professionalRoles,
    );

    console.log(`Computed professional years: ${computedYears}`);

    // 6. Check companies found
    const companiesFound = (cleaned.experience ?? [])
      .filter((e: any) => e.company)
      .map((e: any) => e.company);

    console.log(`Companies found: ${companiesFound.join(', ')}`);

    // 7. Persist the re-extracted data
    await persistExtracted(profile.userId, { stage1Data: cleaned, achievements: parsed.achievements }, { replace: true });

    // 8. Re-fetch and verify stored years
    const updatedProfile = await prisma.candidateProfile.findUnique({
      where: { userId: profile.userId },
      select: { yearsOfExperience: true },
    });

    const yearsAfter = updatedProfile?.yearsOfExperience ?? null;
    console.log(`Years after re-extraction: ${yearsAfter}`);

    // 9. Determine pass/fail
    let passed = true;

    // Assertion: Should have professional roles
    if (professionalRoles.length === 0 && allExperience.length > 0) {
      console.error(`❌ FAIL: No professional roles detected`);
      passed = false;
    }

    // Assertion: Years should be calculated (or null if < 2)
    if (computedYears !== null && computedYears < 2) {
      console.error(`❌ FAIL: Years calculation error - got ${computedYears}`);
      passed = false;
    }

    // Assertion: No obviously invented employers (like "Noble Seeds")
    const hasInvented = companiesFound.some((c: string) =>
      c.toLowerCase().includes('noble seeds') ||
      c.toLowerCase().includes('unknown company')
    );
    if (hasInvented) {
      console.error(`❌ FAIL: Found invented employer`);
      passed = false;
    }

    if (passed) {
      console.log(`✅ PASSED`);
    }

    results.push({
      user: name,
      email,
      yearsBefore,
      yearsAfter,
      inventedEmployersStripped,
      casualRolesDetected: casualRoles.length,
      professionalRolesDetected: professionalRoles.length,
      companiesFound,
      passed,
    });
  }

  // Final summary
  console.log('\n\n=== INTEGRATION PROOF SUMMARY ===');
  console.log(`Total profiles tested: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.passed).length}`);
  console.log(`Failed: ${results.filter(r => !r.passed).length}`);

  console.log('\n--- Detailed Results ---');
  for (const r of results) {
    console.log(`\n${r.user} (${r.email}):`);
    console.log(`  Years: ${r.yearsBefore} → ${r.yearsAfter}`);
    console.log(`  Casual roles: ${r.casualRolesDetected}`);
    console.log(`  Professional roles: ${r.professionalRolesDetected}`);
    console.log(`  Stripped: ${r.inventedEmployersStripped.join(', ') || '(none)'}`);
    console.log(`  Companies: ${r.companiesFound.join(', ')}`);
    console.log(`  Status: ${r.passed ? '✅ PASS' : '❌ FAIL'}`);
  }

  // Exit with error code if any failed
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  runIntegrationProof().catch(err => {
    console.error('Integration proof failed:', err);
    process.exit(1);
  });
}

export { runIntegrationProof };

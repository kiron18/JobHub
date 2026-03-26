import {
  Target,
  FileText,
  GitBranch,
  Lightbulb,
  Wrench,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface SectionMeta {
  icon: LucideIcon;
  label: string;  // short display label used in cross-section CTAs
}

export const SECTION_ICONS: Record<string, SectionMeta> = {
  targeting: {
    icon: Target,
    label: 'Targeting Assessment',
  },
  document_audit: {
    icon: FileText,
    label: 'Document Audit',
  },
  pipeline: {
    icon: GitBranch,
    label: 'Pipeline Diagnosis',
  },
  honest: {
    icon: Lightbulb,
    label: 'The Honest Assessment',
  },
  fix: {
    icon: Wrench,
    label: 'The 3-Step Fix',
  },
  what_jobhub_does: {
    icon: Sparkles,
    label: 'What JobHub Does For You',
  },
};

/** Cross-section CTA wiring. Each section links to two others with a reason why. */
export const SECTION_LINKS: Record<string, { key: string; why: string }[]> = {
  targeting: [
    { key: 'document_audit', why: 'Your targeting shapes what your resume needs to say' },
    { key: 'pipeline',       why: 'See where applications are actually dropping off' },
  ],
  document_audit: [
    { key: 'targeting', why: 'Targeting and documents live or die together' },
    { key: 'fix',       why: 'Your first fix is probably in here' },
  ],
  pipeline: [
    { key: 'honest', why: 'Your pipeline pattern reveals the real blocker' },
    { key: 'fix',    why: 'Three things you can fix this week' },
  ],
  honest: [
    { key: 'pipeline',       why: 'Your blocker shows up in your pipeline numbers' },
    { key: 'document_audit', why: 'The documents are where the fix starts' },
  ],
  fix: [
    { key: 'what_jobhub_does', why: 'See what the platform builds for you next' },
    { key: 'targeting',        why: 'Targeting is where most fixes begin' },
  ],
  what_jobhub_does: [
    { key: 'fix',            why: 'Your fixes are already waiting' },
    { key: 'document_audit', why: 'Your documents are the first thing we help you rebuild' },
  ],
};

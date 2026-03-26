import type { OrigamiIcon } from './reportSvgIcons';
import {
  TargetingIcon,
  DocumentAuditIcon,
  PipelineIcon,
  HonestIcon,
  FixIcon,
  WhatJobHubDoesIcon,
} from './reportSvgIcons';

export type { OrigamiIcon };

export interface SectionMeta {
  icon: OrigamiIcon;
  label: string;
  color: string;
  colorBg: string;
  /** px height of the collapsed card */
  collapsedHeight: number;
  /** CSS grid column span (masonry) */
  span: 1 | 2;
}

export const SECTION_ICONS: Record<string, SectionMeta> = {
  targeting: {
    icon: TargetingIcon,
    label: 'Targeting',
    color: '#FBBF24',
    colorBg: 'rgba(251,191,36,0.07)',
    collapsedHeight: 230,
    span: 1,
  },
  document_audit: {
    icon: DocumentAuditIcon,
    label: 'Document Audit',
    color: '#A78BFA',
    colorBg: 'rgba(167,139,250,0.07)',
    collapsedHeight: 210,
    span: 1,
  },
  pipeline: {
    icon: PipelineIcon,
    label: 'Pipeline',
    color: '#34D399',
    colorBg: 'rgba(52,211,153,0.07)',
    collapsedHeight: 250,
    span: 1,
  },
  honest: {
    icon: HonestIcon,
    label: 'The Honest Truth',
    color: '#FB7185',
    colorBg: 'rgba(251,113,133,0.07)',
    collapsedHeight: 220,
    span: 1,
  },
  fix: {
    icon: FixIcon,
    label: 'Your 3-Step Fix',
    color: '#5EEAD4',
    colorBg: 'rgba(94,234,212,0.07)',
    collapsedHeight: 220,
    span: 2,
  },
  what_jobhub_does: {
    icon: WhatJobHubDoesIcon,
    label: 'What JobHub Does For You',
    color: '#FCD34D',
    colorBg: 'rgba(252,211,77,0.07)',
    collapsedHeight: 210,
    span: 2,
  },
};

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

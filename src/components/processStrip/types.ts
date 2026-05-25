export type ProcessStep = 'paste' | 'analyse' | 'tailor' | 'save' | 'track';

export const PROCESS_STEPS: readonly ProcessStep[] = ['paste', 'analyse', 'tailor', 'save', 'track'] as const;

export interface ProcessProgress {
  /** The step the user is currently on. null = all done (about to retire). */
  currentStep: ProcessStep | null;
  /** Steps the user has finished (in order). */
  completedSteps: ProcessStep[];
  /** True when the strip should not render at all (retired forever, or manually hidden). */
  isHidden: boolean;
  /** True only when the user has explicitly hidden via the hide button (not when retired). */
  isManuallyHidden: boolean;
  /** True when status >= APPLIED has been observed. */
  isRetired: boolean;
}

export type SectionId =
  | 'applications'
  | 'documents'
  | 'profile'
  | 'jobs'
  | 'linkedin'
  | 'emailTemplates'
  | 'mindset';

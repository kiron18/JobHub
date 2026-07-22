export interface BannerCopy {
  formula: 'value-prop' | 'bold-positioning' | 'credibility-offer';
  copy: string;
  sublineSuggestion?: string;
}

export interface LinkedInProfileData {
  headline: string;
  about: string;
  skills: string[];
  experienceBullets: string[];
  openToWork: string;
  bannerCopies: BannerCopy[];
}

export interface OutreachData {
  connectionNote: string;
  firstMessage: string;
  afterConversationFollowUp: string;
  directAsk: string;
  questionSuggestions: string[];
}

export interface OutreachLogEntry {
  id: string;
  personName: string;
  company: string;
  topic: string;
  specificQuestion: string;
  status: 'ACTIVE' | 'REPLIED' | 'CALL_BOOKED' | 'REFERRAL' | 'CLOSED_NO_REPLY' | 'CLOSED_MANUAL';
  createdAt: string;
  // Stored drafts of the four generated templates. Persist from the moment the
  // connection request is sent, so they survive moving to the next person.
  connectionNote: string;
  firstMessage: string;
  followUpDraft: string;
  directAskDraft: string;
  messages?: Array<{
    touchNumber: number;
    body: string;
    copiedAt: string;
  }>;
  ladder?: {
    touches: Array<{
      touchNumber: number;
      copiedAt: string;
      body?: string;
    }>;
    nextTouchNumber: number | null;
    nextTouchDue: string | null;
    canAutoClose?: boolean;
  };
}

export interface BannerConfig {
  mainMessage: string;
  subLine: string;
  bgColor: string;
  texture: 'clean' | 'gradient' | 'grid';
}

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
  afterCallFollowUp: string;
  directAsk: string;
  questionSuggestions: string[];
}

export interface BannerConfig {
  mainMessage: string;
  subLine: string;
  bgColor: string;
  texture: 'clean' | 'gradient' | 'grid';
}

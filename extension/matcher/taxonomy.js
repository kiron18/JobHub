// The language structure behind job application questions.
//
// Two axes. A question's SHAPE says what form of answer it wants, and is close
// to pure pattern matching because the stems are formulaic. A question's THEME
// says which of the candidate's material to draw on, and needs scoring because
// wording varies wildly.
//
// Splitting them is what fixes the two cases that break naive keyword matching:
//
//   "made a mistake" vs "a setback you learned from"
//        -> no shared words, same slot          (both: past_event + failure)
//   "worked in a team" vs "had conflict in a team"
//        -> nearly all words shared, different slots
//        -> only separable because `teamwork` scores `conflict` NEGATIVELY
//
// Tuned for ENTRY LEVEL applicants. Graduates are not asked domain-technical
// questions, so the theme list is largely industry-independent. What varies by
// industry is the content of their stories, not the shape of the questions.
// The INDUSTRY_THEMES below are the small genuine exceptions.

/**
 * What form of answer the question wants, and which part of the bank answers it.
 * Order matters: the first shape whose stems match wins, so the most specific
 * stems must come first.
 */
export const SHAPES = [
  {
    id: 'past_event',
    answeredBy: 'story',
    stems: [
      'tell me about a time', 'tell us about a time', 'tell me about an occasion',
      'describe a time', 'describe a situation', 'describe an experience',
      'describe an occasion', 'give an example', 'give me an example',
      'give us an example', 'provide an example', 'share an example',
      'share an experience', 'walk me through a time', 'walk us through a time',
      'can you recall', 'recall a time', 'when have you', 'when did you last',
      'think of a time', 'a time when you', 'an example of when',
      'have you ever had to',
    ],
  },
  {
    id: 'hypothetical',
    answeredBy: 'story',
    stems: [
      'what would you do if', 'what would you do when', 'how would you handle',
      'how would you deal', 'how would you approach', 'how would you respond',
      'how do you handle', 'how do you deal', 'how do you approach',
      'imagine you', 'suppose you', 'if a customer', 'if a client',
      'if a patient', 'if you were', 'if you noticed', 'if you disagreed',
    ],
  },
  {
    id: 'self_description',
    answeredBy: 'statement',
    stems: [
      'tell me about yourself', 'tell us about yourself', 'about yourself',
      'describe yourself', 'what are your strengths', 'your greatest strength',
      'your biggest strength', 'your key strengths', 'best qualities',
      'your greatest weakness', 'your biggest weakness', 'your weaknesses',
      'areas for improvement', 'how would your friends describe',
      'how would your colleagues describe', 'how would your manager describe',
      'what are you good at', 'what do you bring', 'your top skills',
      'three words', 'what motivates you', 'your work style',
    ],
  },
  {
    id: 'motivation',
    answeredBy: 'statement',
    stems: [
      'why do you want to work', 'why do you want this', 'why do you want to join',
      'why are you interested', 'why are you applying', 'why have you applied',
      'why this role', 'why this company', 'why this position', 'why our company',
      'why us', 'why should we hire', 'why should we choose', 'why you',
      'what makes you the best', 'what makes you a good fit',
      'what makes you suitable', 'why are you the right', 'why are you the best',
      'what attracts you', 'what interests you about', 'what appeals to you',
      'what do you know about', 'where do you see yourself',
      'what are your career goals', 'why did you choose',
    ],
  },
  {
    id: 'fact',
    answeredBy: 'profile',
    stems: [
      'do you have the right to work', 'right to work', 'working rights',
      'work rights', 'require sponsorship', 'require visa', 'visa status',
      'are you legally', 'are you authorised', 'are you authorized',
      'notice period', 'when can you start', 'availability',
      'salary expectation', 'expected salary', 'remuneration expectation',
      'drivers licence', "driver's licence", 'drivers license',
      'do you hold', 'are you willing to relocate', 'willing to travel',
      'police check', 'working with children',
    ],
  },
];

/**
 * Themes. `signals` add to the score, `against` subtract from it.
 *
 * Signals are matched as word PREFIXES on a word boundary, so `learn` catches
 * learns / learned / learning, and `team` catches teams / teamwork, without
 * `lead` matching "misleading". Weight defaults to 1; give a signal a weight
 * when it is close to decisive on its own.
 */
export const THEMES = [
  {
    id: 'failure',
    label: 'Mistake or failure',
    signals: [
      ['made a mistake', 3], ['went wrong', 3], ['did not go to plan', 3],
      ['learned from', 2], ['learnt from', 2], ['messed up', 3], ['fell short', 2],
      'mistake', 'error', 'failure', 'failed', 'setback', 'misjudged',
      'regret', 'wrong', 'unsuccessful', 'let down', 'own up', 'accountab',
    ],
    against: ['success', 'achievement', 'proud'],
  },
  {
    id: 'conflict',
    label: 'Conflict or disagreement',
    signals: [
      ['difficult person', 3], ['difficult colleague', 3], ['difficult team member', 3],
      ['did not get along', 3], ['see eye to eye', 3], ['disagreed with', 3],
      'disagree', 'conflict', 'argument', 'tension', 'clash', 'friction',
      'pushback', 'confrontation', 'dispute', 'upset', 'awkward',
    ],
    against: [],
  },
  {
    id: 'teamwork',
    label: 'Working in a team',
    signals: [
      ['group project', 3], ['part of a team', 3], ['worked in a team', 3],
      'team', 'group', 'collaborat', 'together', 'colleague', 'peer',
      'contribut', 'cooperat', 'shared goal',
    ],
    // Without these, "conflict in a team" would score teamwork just as highly.
    against: [['conflict', 3], ['disagree', 3], ['difficult person', 3],
              ['led the', 2], ['in charge', 2], ['on your own', 2]],
  },
  {
    id: 'leadership',
    label: 'Leading or stepping up',
    signals: [
      ['took charge', 3], ['stepped up', 3], ['took the lead', 3],
      ['took responsibility', 2], ['led a', 3],
      'lead', 'leader', 'captain', 'supervis', 'delegat', 'motivat',
      'mentor', 'coach', 'guided', 'organis', 'organiz', 'coordinat',
    ],
    against: [],
  },
  {
    id: 'pressure',
    label: 'Pressure and deadlines',
    signals: [
      ['under pressure', 3], ['tight deadline', 3], ['short notice', 3],
      ['last minute', 3], ['time constraint', 2],
      'deadline', 'pressure', 'urgent', 'stress', 'rush', 'busy period',
      'peak', 'hectic', 'demanding', 'fast paced', 'fast-paced',
    ],
    against: [],
  },
  {
    id: 'initiative',
    label: 'Initiative and going beyond',
    signals: [
      ['above and beyond', 3], ['without being asked', 3], ['own initiative', 3],
      ['extra mile', 3], ['spotted an opportunity', 3], ['took it upon yourself', 3],
      'initiative', 'proactive', 'self starter', 'self-starter', 'suggest',
      'improve', 'volunteer', 'identified a', 'streamlin', 'efficien',
    ],
    against: [],
  },
  {
    id: 'customer',
    label: 'Customers, clients or patients',
    signals: [
      ['difficult customer', 3], ['unhappy customer', 3], ['angry customer', 3],
      ['customer service', 3], ['member of the public', 2],
      'customer', 'client', 'patient', 'guest', 'complaint', 'service',
      'stakeholder', 'satisfaction', 'resident', 'consumer',
    ],
    against: [],
  },
  {
    id: 'learning',
    label: 'Learning something new',
    signals: [
      ['learning curve', 3], ['new skill', 3], ['taught yourself', 3],
      ['picked up quickly', 3], ['out of your comfort zone', 3],
      'learn', 'unfamiliar', 'new software', 'new system', 'new tool',
      'training', 'upskill', 'self taught', 'self-taught', 'never done before',
    ],
    against: [],
  },
  {
    id: 'detail',
    label: 'Accuracy and attention to detail',
    signals: [
      ['attention to detail', 3], ['double check', 3], ['spotted an error', 3],
      ['quality control', 2],
      'accura', 'detail', 'precis', 'thorough', 'meticulous', 'checking',
      'verif', 'proofread', 'discrepanc',
    ],
    against: [],
  },
  {
    id: 'change',
    label: 'Adapting to change or uncertainty',
    signals: [
      ['plans changed', 3], ['change of plan', 3], ['at short notice', 2],
      ['out of your control', 2],
      'adapt', 'flexib', 'unexpected', 'uncertain', 'ambigu', 'pivot',
      'shift', 'disruption', 'unpredictab',
    ],
    against: [],
  },
  {
    id: 'priorities',
    label: 'Juggling multiple priorities',
    signals: [
      ['multiple tasks', 3], ['competing priorities', 3], ['at the same time', 2],
      ['manage your time', 3], ['juggl', 3],
      'prioriti', 'workload', 'multitask', 'several tasks', 'balance',
      'time management', 'organis your', 'organiz your',
    ],
    against: [],
  },
];

/**
 * Genuine industry exceptions at entry level. Merged into THEMES when the
 * candidate's field calls for them, rather than carried for everyone.
 */
export const INDUSTRY_THEMES = {
  health: ['safety', 'procedure', 'ethics'],
  lab: ['safety', 'procedure', 'detail'],
  trades: ['safety', 'procedure'],
  finance: ['ethics', 'procedure', 'detail'],
  education: ['ethics', 'safety'],
};

export const ADDON_THEMES = [
  {
    id: 'safety',
    label: 'Safety and escalation',
    signals: [
      ['safety issue', 3], ['unsafe', 3], ['raise a concern', 3], ['escalat', 3],
      'safety', 'hazard', 'incident', 'risk', 'injur', 'emergency', 'ppe',
      'near miss', 'duty of care',
    ],
    against: [],
  },
  {
    id: 'procedure',
    label: 'Following procedure or policy',
    signals: [
      ['standard operating', 3], ['followed the procedure', 3],
      ['against policy', 3], ['cut corners', 3],
      'procedure', 'protocol', 'policy', 'complian', 'regulat', 'guideline',
      'standard', 'audit', 'documentation',
    ],
    against: [],
  },
  {
    id: 'ethics',
    label: 'Ethics, honesty and confidentiality',
    signals: [
      ['right thing', 3], ['ethical dilemma', 3], ['breach of', 3],
      'ethic', 'integrity', 'honest', 'confidential', 'privacy', 'dishonest',
      'misconduct', 'fraud', 'conflict of interest',
    ],
    against: [],
  },
];

/** Word budgets that map an answer length onto a stored variant. */
export const LENGTH_BANDS = [
  { variant: 'headline', maxWords: 30 },
  { variant: 'short', maxWords: 90 },
  { variant: 'medium', maxWords: 200 },
  { variant: 'full', maxWords: Infinity },
];

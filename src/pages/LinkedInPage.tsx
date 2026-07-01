import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { warm } from '../lib/theme/warmTokens';
import api from '../lib/api';
import { ProfileIntroCard } from '../components/linkedin/ProfileIntroCard';
import { ProfileSectionBlock } from '../components/linkedin/ProfileSectionBlock';
import { ReadinessBar } from '../components/linkedin/ReadinessBar';
import { OutreachTemplates } from '../components/linkedin/OutreachTemplates';
import { LinkedInOnboardingModal } from '../components/linkedin/LinkedInOnboardingModal';
import type { LinkedInProfileData, BannerConfig } from '../components/linkedin/types';
import { useProfile } from '../hooks/useProfile';
import { SectionIntroBanner } from '../components/processStrip';
import { Sparkles, ChevronDown, ChevronUp, Star, Loader2 } from 'lucide-react';

type Tab = 'profile' | 'outreach';

const DEFAULT_BANNER: BannerConfig = {
  mainMessage: '',
  subLine: '',
  bgColor: '#0F172A',
  texture: 'clean',
};

export const LinkedInPage: React.FC = () => {
  const { profile } = useProfile();

  const [tab, setTab] = useState<Tab>('profile');
  const [targetRole, setTargetRole] = useState('');
  const [showTargetRole, setShowTargetRole] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<LinkedInProfileData | null>(null);
  const [bannerConfig, setBannerConfig] = useState<BannerConfig>(DEFAULT_BANNER);
  const [bannerEditorOpen, setBannerEditorOpen] = useState(false);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(profile?.headshotUrl ?? null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [hydrating, setHydrating] = useState(true);

  // Refs used to guard the bannerConfig persistence effect from firing during hydration.
  const hasHydrated = useRef(false);
  const hydratedBannerRef = useRef<BannerConfig | null>(null);

  useEffect(() => {
    if (profile?.headshotUrl) setHeadshotUrl(profile.headshotUrl);
  }, [profile?.headshotUrl]);

  // ── Mount: hydrate from server state ──────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const { data } = await api.get<{
          profile: LinkedInProfileData | null;
          banner: BannerConfig | null;
          onboardedAt: string | null;
        }>('/linkedin/state');
        if (data.profile) setProfileData(data.profile);
        if (data.banner) {
          setBannerConfig(data.banner);
          hydratedBannerRef.current = data.banner;
        }
        if (data.onboardedAt === null) setOnboardingOpen(true);
      } catch {
        // Don't crash the page on a failed hydration fetch.
      } finally {
        // Set the ref synchronously before triggering a re-render so the
        // bannerConfig useEffect (defined below) can safely check it.
        hasHydrated.current = true;
        setHydrating(false);
      }
    }
    init();
  }, []);

  // ── Persist banner changes (skips the value hydrated from the server) ──────
  useEffect(() => {
    if (!hasHydrated.current) return;
    // Same reference means this is exactly what we received from the GET — skip.
    if (bannerConfig === hydratedBannerRef.current) return;
    api.patch('/linkedin/state', { banner: bannerConfig }).catch(() => {});
  }, [bannerConfig]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleGenerateAll() {
    if (generating) return;
    setGenerating(true);
    try {
      const { data } = await api.post<LinkedInProfileData>('/linkedin/generate', {
        targetRole: targetRole.trim() || undefined,
      });
      setProfileData(data);
      if (data.bannerCopies?.[0]) {
        setBannerConfig(c => ({
          ...c,
          mainMessage: data.bannerCopies[0].copy,
          subLine: data.bannerCopies[0].sublineSuggestion ?? '',
        }));
      }
      toast.success('Profile generated — copy sections to LinkedIn');
    } catch (err: any) {
      toast.error('Generation failed — try again.');
      throw err; // allow callers (e.g. the onboarding modal wrapper) to detect failure
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate(section: string) {
    if (!profileData || regeneratingSection) return;
    setRegeneratingSection(section);
    try {
      const { data } = await api.post<LinkedInProfileData>('/linkedin/generate', {
        targetRole: targetRole.trim() || undefined,
      });
      const key = section as keyof LinkedInProfileData;
      setProfileData(prev => prev ? { ...prev, [key]: data[key] } : data);
      toast.success(`${section} regenerated`);
    } catch {
      toast.error('Regeneration failed — try again.');
    } finally {
      setRegeneratingSection(null);
    }
  }

  function handleSectionChange(
    section: keyof Omit<LinkedInProfileData, 'bannerCopies'>,
    value: string | string[]
  ) {
    if (profileData) {
      const updated: LinkedInProfileData = { ...profileData, [section]: value };
      // Fire-and-forget persist; don't block the UI.
      api.patch('/linkedin/state', { profile: updated }).catch(() => {});
      setProfileData(updated);
    } else {
      setProfileData(prev => prev ? { ...prev, [section]: value } : prev);
    }
  }

  // Wrapper called by the onboarding modal — patches onboarded flag then closes.
  const handleModalGenerate = async () => {
    await handleGenerateAll(); // throws on error so we don't mark as onboarded
    await api.patch('/linkedin/state', { onboarded: true }).catch(() => {});
    setOnboardingOpen(false);
  };

  // ── Readiness checks ──────────────────────────────────────────────────────
  const readiness = {
    photo: !!headshotUrl,
    banner: !!bannerConfig.mainMessage,
    headline: !!profileData?.headline,
    about: !!profileData?.about,
    experience: !!profileData?.experienceBullets?.length,
    skills: !!profileData?.skills?.length,
  };

  const coreSectionsComplete = readiness.photo && readiness.headline && readiness.about;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: 14,
    background: active ? '#0A66C2' : 'transparent',
    color: active ? 'white' : warm.colors.textSecondary,
    transition: 'all 0.15s',
  });

  // Ghost content examples
  const aboutGhost = (
    <div style={{ fontSize: 14, lineHeight: 1.6 }}>
      <p style={{ margin: '0 0 8px' }}>Chemistry graduate at Deakin University, finishing my BSc in October 2025...</p>
      <p style={{ margin: 0, opacity: 0.6 }}>I specialize in analytical chemistry — HPLC, UV-Vis spectroscopy, and quality control protocols.</p>
    </div>
  );

  const experienceGhost = (
    <div style={{ fontSize: 14 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 8,
          background: warm.colors.bgAlt,
          flexShrink: 0,
        }} />
        <div style={{ opacity: 0.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>QC Trainee · Company Name</div>
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            <li>Maintained 98% accuracy across QC analysis...</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const skillsGhost = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, opacity: 0.5 }}>
      {['HPLC', 'UV-Vis', 'Quality Control', 'GLP', '+4 more'].map((skill, i) => (
        <span
          key={i}
          style={{
            fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
            background: warm.colors.bgAlt, color: warm.colors.textMuted,
          }}
        >
          {skill}
        </span>
      ))}
    </div>
  );

  // ── Hydration loading guard ───────────────────────────────────────────────
  if (hydrating) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 240,
        }}
      >
        <Loader2
          size={24}
          color={warm.colors.textMuted}
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 740, margin: '0 auto' }}>
      {/* ── Onboarding modal — unskippable, first visit only ────────────── */}
      {onboardingOpen && (
        <LinkedInOnboardingModal
          name={profile?.name ?? ''}
          location={profile?.location ?? ''}
          headshotUrl={headshotUrl}
          targetRole={targetRole}
          onTargetRoleChange={setTargetRole}
          bannerConfig={bannerConfig}
          onBannerConfigChange={setBannerConfig}
          onHeadshotSaved={setHeadshotUrl}
          generating={generating}
          onGenerate={handleModalGenerate}
        />
      )}

      <SectionIntroBanner sectionId="linkedin">
        Around 70% of Aussie roles are filled via networking. This is your LinkedIn toolkit: profile rewrite, outreach templates, and headline drafts.
      </SectionIntroBanner>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 26, fontWeight: 600, color: warm.colors.textPrimary,
          margin: '0 0 4px', letterSpacing: '-0.015em',
        }}>
          LinkedIn Hub
        </h1>
        <p style={{ fontSize: 14, color: warm.colors.textSecondary, margin: 0 }}>
          Make your profile worth finding — then start conversations that lead to roles
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 14, marginBottom: 28,
        background: warm.colors.bgAlt, border: `1px solid ${warm.colors.borderWhisper}`,
        width: 'fit-content',
      }}>
        <button style={tabStyle(tab === 'profile')} onClick={() => setTab('profile')}>Profile</button>
        <button style={tabStyle(tab === 'outreach')} onClick={() => setTab('outreach')}>Outreach</button>
      </div>

      {tab === 'profile' && (
        <>
          {/* Readiness Bar */}
          <ReadinessBar
            photoDone={readiness.photo}
            bannerDone={readiness.banner}
            headlineDone={readiness.headline}
            aboutDone={readiness.about}
            experienceDone={readiness.experience}
            skillsDone={readiness.skills}
            onStartOutreach={() => setTab('outreach')}
          />

          {/* Start Here Banner — highlights high-impact incomplete sections */}
          {!coreSectionsComplete && (
            <div style={{
              background: `linear-gradient(135deg, ${warm.colors.bgSurface} 0%, rgba(197,160,89,0.08) 100%)`,
              border: `1px solid rgba(197,160,89,0.3)`,
              borderRadius: warm.radius.card,
              padding: '14px 18px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}>
              <Star size={18} color="#C5A059" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: warm.colors.textPrimary,
                  margin: '0 0 4px',
                }}>
                  Start here
                </p>
                <p style={{
                  fontSize: 12,
                  color: warm.colors.textSecondary,
                  margin: 0,
                  lineHeight: 1.5,
                }}>
                  Your Photo, Headline and About are what a stranger judges in the first 5 seconds. Nail those first.
                </p>
              </div>
            </div>
          )}

          {/* Target Role — collapsible tuning affordance */}
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setShowTargetRole(v => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                color: warm.colors.textMuted,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {showTargetRole ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Tune output (optional)
            </button>

            {showTargetRole && (
              <div style={{ marginTop: 12 }}>
                <label
                  htmlFor="targetRole"
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: warm.colors.textMuted,
                    marginBottom: 8,
                  }}
                >
                  Target Role
                </label>
                <input
                  id="targetRole"
                  type="text"
                  value={targetRole}
                  onChange={e => setTargetRole(e.target.value)}
                  placeholder="e.g. Senior Product Manager · B2B SaaS"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 10,
                    fontSize: 14,
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${warm.colors.borderWhisper}`,
                    color: warm.colors.textPrimary,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <p style={{
                  fontSize: 12,
                  color: warm.colors.textMuted,
                  margin: '6px 0 0',
                  lineHeight: 1.5,
                }}>
                  Adding a target role sharpens the output. Leave blank for a general profile.
                </p>
              </div>
            )}
          </div>

          {/* Profile Intro Card — cover, photo, headline, location */}
          <ProfileIntroCard
            name={profile?.name ?? ''}
            location={profile?.location ?? ''}
            headshotUrl={headshotUrl}
            profileData={profileData}
            bannerConfig={bannerConfig}
            bannerEditorOpen={bannerEditorOpen}
            generating={generating}
            regeneratingSection={regeneratingSection}
            onBannerConfigChange={setBannerConfig}
            onOpenBannerEditor={() => setBannerEditorOpen(true)}
            onCloseBannerEditor={() => setBannerEditorOpen(false)}
            onHeadshotSaved={setHeadshotUrl}
            onGenerateAll={handleGenerateAll}
            onRegenerate={handleRegenerate}
            onHeadlineChange={(val) => handleSectionChange('headline', val)}
          />

          {/* About Section */}
          <ProfileSectionBlock
            label="About"
            why="This is your pitch. Most people read the first two lines, then decide whether to keep reading. Keep it to a few short paragraphs."
            howToPaste="LinkedIn → your profile → About → Edit → paste."
            content={
              <p style={{
                fontSize: 14,
                lineHeight: 1.7,
                color: warm.colors.textPrimary,
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}>
                {profileData?.about}
              </p>
            }
            generated={!!profileData?.about}
            ghostContent={aboutGhost}
            onRegenerate={() => handleRegenerate('about')}
            regenerating={regeneratingSection === 'about'}
            onContentChange={(val) => handleSectionChange('about', val)}
            rawContent={profileData?.about}
          />

          {/* Experience Section */}
          <ProfileSectionBlock
            label="Experience"
            why="Recruiters scan for outcomes, not duties. These bullets lead with results."
            howToPaste="LinkedIn → Experience → your role → Edit → paste bullets."
            content={
              <div>
                {profileData?.experienceBullets?.map((bullet, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      marginBottom: i < profileData.experienceBullets.length - 1 ? 16 : 0,
                    }}
                  >
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      background: warm.colors.bgAlt,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      color: warm.colors.textMuted,
                    }}>
                      LOGO
                    </div>
                    <div style={{ flex: 1 }}>
                      {i === 0 && (
                        <div style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: warm.colors.textPrimary,
                          marginBottom: 4,
                        }}>
                          {profile?.targetRole || 'Your Role'} · Company
                        </div>
                      )}
                      <div style={{
                        fontSize: 14,
                        color: warm.colors.textSecondary,
                        lineHeight: 1.6,
                      }}>
                        • {bullet}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            }
            generated={!!profileData?.experienceBullets?.length}
            ghostContent={experienceGhost}
            onRegenerate={() => handleRegenerate('experienceBullets')}
            regenerating={regeneratingSection === 'experienceBullets'}
            onContentChange={(val) => handleSectionChange('experienceBullets', val.split('\n').filter(Boolean))}
            rawContent={profileData?.experienceBullets?.join('\n')}
          />

          {/* Skills Section */}
          <ProfileSectionBlock
            label="Skills"
            why="Skills drive LinkedIn search. The right ones make you findable."
            howToPaste="LinkedIn → Skills → Add → paste each."
            content={
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {profileData?.skills?.map((skill, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 20,
                      background: 'rgba(10,102,194,0.12)',
                      color: '#60a5fa',
                      border: '1px solid rgba(10,102,194,0.25)',
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            }
            generated={!!profileData?.skills?.length}
            ghostContent={skillsGhost}
            onRegenerate={() => handleRegenerate('skills')}
            regenerating={regeneratingSection === 'skills'}
            onContentChange={(val) => handleSectionChange('skills', val.split(',').map(s => s.trim()).filter(Boolean))}
            rawContent={profileData?.skills?.join(', ')}
          />

          {/* Open to Work — shown inline in intro card but also as standalone if needed */}
          {profileData?.openToWork && (
            <ProfileSectionBlock
              label="Open to Work"
              why="This signal appears on your profile photo and helps recruiters find you."
              howToPaste="LinkedIn → your profile → Open to → paste this text into 'What kind of work are you looking for?'"
              content={
                <p style={{
                  fontSize: 14,
                  color: warm.colors.textPrimary,
                  fontStyle: 'italic',
                  margin: 0,
                }}>
                  {profileData.openToWork}
                </p>
              }
              generated={true}
              onRegenerate={() => handleRegenerate('openToWork')}
              regenerating={regeneratingSection === 'openToWork'}
              onContentChange={(val) => handleSectionChange('openToWork', val)}
              rawContent={profileData.openToWork}
            />
          )}

          {/* Generate Button (if not yet generated) */}
          {!profileData && (
            <button
              onClick={handleGenerateAll}
              disabled={generating}
              style={{
                width: '100%',
                padding: '16px 0',
                borderRadius: 12,
                border: 'none',
                background: generating ? 'rgba(10,102,194,0.4)' : '#0A66C2',
                color: 'white',
                fontSize: 15,
                fontWeight: 700,
                cursor: generating ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 8,
              }}
            >
              {generating && (
                <span style={{ animation: 'spin 1s linear infinite' }}>⟳</span>
              )}
              <Sparkles size={18} />
              {generating ? 'Generating your profile…' : '✨ Generate my profile'}
            </button>
          )}
        </>
      )}

      {tab === 'outreach' && <OutreachTemplates />}
    </div>
  );
};

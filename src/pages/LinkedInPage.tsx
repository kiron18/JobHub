import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAppTheme } from '../contexts/ThemeContext';
import api from '../lib/api';
import { ProfileStrip } from '../components/linkedin/ProfileStrip';
import { ProfileSections } from '../components/linkedin/ProfileSections';
import { BannerCopyPicker } from '../components/linkedin/BannerCopyPicker';
import { BannerCanvas } from '../components/linkedin/BannerCanvas';
import { HeadshotGenerator } from '../components/linkedin/HeadshotGenerator';
import { OutreachTemplates } from '../components/linkedin/OutreachTemplates';
import type { LinkedInProfileData, BannerConfig } from '../components/linkedin/types';
import { useProfile } from '../hooks/useProfile';

type Tab = 'profile' | 'outreach';

const DEFAULT_BANNER: BannerConfig = {
  mainMessage: '',
  subLine: '',
  bgColor: '#0F172A',
  texture: 'clean',
};

export const LinkedInPage: React.FC = () => {
  const { T } = useAppTheme();
  const { profile } = useProfile();

  const [tab, setTab] = useState<Tab>('profile');
  const [targetRole, setTargetRole] = useState('');
  const [generating, setGenerating] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<LinkedInProfileData | null>(null);
  const [bannerConfig, setBannerConfig] = useState<BannerConfig>(DEFAULT_BANNER);
  const [bannerEditorOpen, setBannerEditorOpen] = useState(false);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(profile?.headshotUrl ?? null);

  useEffect(() => {
    if (profile?.headshotUrl) setHeadshotUrl(profile.headshotUrl);
  }, [profile?.headshotUrl]);

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
      toast.success('LinkedIn profile generated');
    } catch {
      toast.error('Generation failed — try again.');
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
    setProfileData(prev => prev ? { ...prev, [section]: value } : prev);
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: 14,
    background: active ? '#0A66C2' : 'transparent',
    color: active ? 'white' : T.textMuted,
    transition: 'all 0.15s',
  });

  return (
    <div style={{ maxWidth: 740, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: T.text, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          LinkedIn Hub
        </h1>
        <p style={{ fontSize: 14, color: T.textMuted, margin: 0 }}>
          Profile · Outreach · Headshot · Banner — one cohesive system
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: 4, borderRadius: 14, marginBottom: 28,
        background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.cardBorder}`,
        width: 'fit-content',
      }}>
        <button style={tabStyle(tab === 'profile')} onClick={() => setTab('profile')}>Profile</button>
        <button style={tabStyle(tab === 'outreach')} onClick={() => setTab('outreach')}>Outreach</button>
      </div>

      {tab === 'profile' && (
        <>
          <ProfileStrip
            name={profile?.name ?? ''}
            title={profile?.targetRole ?? profile?.seniority ?? ''}
            headshotUrl={headshotUrl}
          />
          <ProfileSections
            profileData={profileData}
            generating={generating}
            regeneratingSection={regeneratingSection}
            targetRole={targetRole}
            onTargetRoleChange={setTargetRole}
            onGenerateAll={handleGenerateAll}
            onSectionChange={handleSectionChange}
            onRegenerate={handleRegenerate}
          />
          {profileData && (
            <>
              {!bannerEditorOpen ? (
                <BannerCopyPicker
                  bannerCopies={profileData.bannerCopies}
                  config={bannerConfig}
                  onConfigChange={setBannerConfig}
                  onOpenEditor={() => setBannerEditorOpen(true)}
                />
              ) : (
                <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24, marginBottom: 16 }}>
                  <BannerCanvas
                    config={bannerConfig}
                    onConfigChange={setBannerConfig}
                    onClose={() => setBannerEditorOpen(false)}
                  />
                </div>
              )}
              <HeadshotGenerator
                initialHeadshotUrl={headshotUrl}
                onSaved={setHeadshotUrl}
              />
            </>
          )}
        </>
      )}

      {tab === 'outreach' && <OutreachTemplates />}
    </div>
  );
};

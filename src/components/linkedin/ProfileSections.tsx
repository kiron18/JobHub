import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAppTheme } from '../../contexts/ThemeContext';
import { SectionCard } from './SectionCard';
import type { LinkedInProfileData } from './types';

interface Props {
  profileData: LinkedInProfileData | null;
  generating: boolean;
  regeneratingSection: string | null;
  targetRole: string;
  onTargetRoleChange: (val: string) => void;
  onGenerateAll: () => void;
  onSectionChange: (section: keyof Omit<LinkedInProfileData, 'bannerCopies'>, value: string | string[]) => void;
  onRegenerate: (section: string) => void;
}

export const ProfileSections: React.FC<Props> = ({
  profileData, generating, regeneratingSection, targetRole,
  onTargetRoleChange, onGenerateAll, onSectionChange, onRegenerate,
}) => {
  const { T } = useAppTheme();

  return (
    <div>
      {/* Target role input */}
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="targetRole" style={{ display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textFaint, marginBottom: 8 }}>
          Target Role (optional — sharpens output)
        </label>
        <input
          id="targetRole"
          type="text"
          value={targetRole}
          onChange={e => onTargetRoleChange(e.target.value)}
          placeholder="e.g. Senior Product Manager · B2B SaaS"
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.cardBorder}`,
            color: T.text, outline: 'none', boxSizing: 'border-box',
          }}
        />
        <p style={{ fontSize: 12, color: T.textFaint, margin: '6px 0 0', lineHeight: 1.5 }}>
          Adding a target role sharpens the output. Leave blank for a general profile.
        </p>
      </div>

      {/* Generate All */}
      <button
        onClick={onGenerateAll}
        disabled={generating}
        style={{
          width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
          background: generating ? 'rgba(10,102,194,0.4)' : '#0A66C2',
          color: 'white', fontSize: 15, fontWeight: 700,
          cursor: generating ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 28, transition: 'background 0.15s',
        }}
      >
        {generating && <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />}
        {generating ? 'Generating your LinkedIn profile…' : (profileData ? '↻ Regenerate All' : 'Generate LinkedIn Profile')}
      </button>

      {profileData && (
        <>
          <SectionCard
            label="Headline"
            charLimit={220}
            content={profileData.headline}
            onContentChange={v => onSectionChange('headline', v)}
            onRegenerate={() => onRegenerate('headline')}
            regenerating={regeneratingSection === 'headline'}
          />
          <SectionCard
            label="About"
            charTarget="1,800–2,200"
            content={profileData.about}
            onContentChange={v => onSectionChange('about', v)}
            onRegenerate={() => onRegenerate('about')}
            regenerating={regeneratingSection === 'about'}
          />
          <SectionCard
            label="Skills"
            content={profileData.skills.join(', ')}
            onContentChange={v => onSectionChange('skills', v.split(',').map(s => s.trim()).filter(Boolean))}
            onRegenerate={() => onRegenerate('skills')}
            regenerating={regeneratingSection === 'skills'}
            renderContent={(content) => (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
                {content.split(',').map(s => s.trim()).filter(Boolean).map((skill, i) => (
                  <span key={i} style={{
                    fontSize: 13, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                    background: 'rgba(10,102,194,0.12)', color: '#60a5fa',
                    border: '1px solid rgba(10,102,194,0.25)',
                  }}>{skill}</span>
                ))}
              </div>
            )}
          />
          <SectionCard
            label="Experience Bullets (Most Recent Role)"
            content={profileData.experienceBullets.join('\n')}
            onContentChange={v => onSectionChange('experienceBullets', v.split('\n').filter(Boolean))}
            onRegenerate={() => onRegenerate('experienceBullets')}
            regenerating={regeneratingSection === 'experienceBullets'}
          />
          <SectionCard
            label="Open to Work Signal"
            charLimit={150}
            content={profileData.openToWork}
            onContentChange={v => onSectionChange('openToWork', v)}
            onRegenerate={() => onRegenerate('openToWork')}
            regenerating={regeneratingSection === 'openToWork'}
          />
        </>
      )}
    </div>
  );
};

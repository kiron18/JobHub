import React from 'react';
import { ArrowRight } from 'lucide-react';
import { warm } from '../../lib/theme/warmTokens';

interface Props {
  photoDone: boolean;
  bannerDone: boolean;
  headlineDone: boolean;
  aboutDone: boolean;
  experienceDone: boolean;
  skillsDone: boolean;
  onStartOutreach: () => void;
}

const LINKEDIN_BLUE = '#0A66C2';
const SUCCESS_GREEN = '#2A9D6F';

export const ReadinessBar: React.FC<Props> = ({
  photoDone,
  bannerDone,
  headlineDone,
  aboutDone,
  experienceDone,
  skillsDone,
  onStartOutreach,
}) => {
  const items = [
    { key: 'photo', label: 'Photo', done: photoDone },
    { key: 'banner', label: 'Banner', done: bannerDone },
    { key: 'headline', label: 'Headline', done: headlineDone },
    { key: 'about', label: 'About', done: aboutDone },
    { key: 'experience', label: 'Experience', done: experienceDone },
    { key: 'skills', label: 'Skills', done: skillsDone },
  ];

  const completedCount = items.filter(i => i.done).length;
  const totalCount = items.length;
  const isComplete = completedCount === totalCount;

  // Render progress dots
  const renderDots = () => {
    return items.map((item, idx) => (
      <span
        key={item.key}
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: item.done ? SUCCESS_GREEN : warm.colors.borderWhisper,
          marginRight: idx < items.length - 1 ? 6 : 0,
          transition: 'background 0.2s',
        }}
      />
    ));
  };

  return (
    <div style={{
      background: warm.colors.bgSurface,
      border: `1px solid ${warm.colors.borderWhisper}`,
      borderRadius: warm.radius.card,
      padding: '16px 20px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: warm.colors.textPrimary,
          }}>
            Profile readiness
          </span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {renderDots()}
          </div>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: isComplete ? SUCCESS_GREEN : warm.colors.textSecondary,
          }}>
            {completedCount} of {totalCount}
          </span>
        </div>

        {/* Completion checklist tooltip-style summary */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingLeft: 16,
          borderLeft: `1px solid ${warm.colors.borderWhisper}`,
          flexWrap: 'wrap',
        }}>
          {items.filter(i => !i.done).slice(0, 3).map(item => (
            <span
              key={item.key}
              style={{
                fontSize: 11,
                color: warm.colors.textMuted,
              }}
            >
              {item.label}
            </span>
          ))}
          {items.filter(i => !i.done).length > 3 && (
            <span style={{ fontSize: 11, color: warm.colors.textMuted }}>
              +{items.filter(i => !i.done).length - 3} more
            </span>
          )}
          {isComplete && (
            <span style={{ fontSize: 11, color: SUCCESS_GREEN, fontWeight: 600 }}>
              All set! Copy sections to LinkedIn
            </span>
          )}
        </div>
      </div>

      {/* Start Outreach Button */}
      <button
        onClick={onStartOutreach}
        disabled={!isComplete}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 20px',
          borderRadius: 20,
          border: 'none',
          background: isComplete ? LINKEDIN_BLUE : warm.colors.bgAlt,
          color: isComplete ? 'white' : warm.colors.textMuted,
          fontSize: 14,
          fontWeight: 700,
          cursor: isComplete ? 'pointer' : 'default',
          transition: 'all 0.15s',
        }}
        title={isComplete ? 'Start outreach' : 'Finish your profile first'}
      >
        Start outreach
        <ArrowRight size={16} />
      </button>
    </div>
  );
};

import React, { useState } from 'react';
import { warm } from '../lib/theme/warmTokens';
import { SectionIntroBanner } from '../components/processStrip';
import { Building2, Heart, Briefcase, Clock, Code, FileText, AlertTriangle, Play } from 'lucide-react';

interface VideoPlaceholderProps {
  section: string;
  title: string;
}

function VideoPlaceholder({ section, title }: VideoPlaceholderProps) {
  return (
    <div
      style={{
        background: warm.colors.bgAlt,
        border: `2px dashed ${warm.colors.borderWhisper}`,
        borderRadius: 12,
        padding: '40px 24px',
        textAlign: 'center',
        marginBottom: 16,
      }}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: 'rgba(10,102,194,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <Play size={24} color="#0A66C2" />
      </div>
      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: warm.colors.textPrimary }}>
        {title}
      </p>
      <p style={{ margin: 0, fontSize: 11, color: warm.colors.textMuted }}>
        Video placeholder — Section {section}
      </p>
    </div>
  );
}

interface SectionProps {
  icon: React.ReactNode;
  number: string;
  title: string;
  children: React.ReactNode;
}

function Section({ icon, number, title, children }: SectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      style={{
        background: warm.colors.bgSurface,
        border: `1px solid ${warm.colors.borderWhisper}`,
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(10,102,194,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#0A66C2',
              letterSpacing: '0.05em',
            }}
          >
            {number}
          </span>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: warm.colors.textPrimary }}>{title}</h3>
        </div>
        <span style={{ fontSize: 18, color: warm.colors.textMuted }}>{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${warm.colors.borderWhisper}` }}>
          <div style={{ paddingTop: 16 }}>{children}</div>
        </div>
      )}
    </div>
  );
}

function CautionBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: 10,
        padding: '14px 16px',
        marginTop: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, lineHeight: 1.6, color: warm.colors.textSecondary }}>{children}</div>
      </div>
    </div>
  );
}

export const LocalExperiencePlaybookPage: React.FC = () => {
  return (
    <div style={{ maxWidth: 740, margin: '0 auto' }}>
      <SectionIntroBanner sectionId="local-experience">
        For international graduates, local experience is often the fastest path to your first professional role in
        Australia. This playbook covers every channel — from temp agencies to open source.
      </SectionIntroBanner>

      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 600,
            color: warm.colors.textPrimary,
            margin: '0 0 4px',
            letterSpacing: '-0.015em',
          }}
        >
          Local Experience Playbook
        </h1>
        <p style={{ fontSize: 14, color: warm.colors.textSecondary, margin: 0 }}>
          Six proven paths to building Australian experience — and how to document each one
        </p>
      </div>

      <Section icon={<Building2 size={18} color="#0A66C2" />} number="01" title="Temp Agencies">
        <VideoPlaceholder section="01" title="How to Work with Temp Agencies" />

        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: warm.colors.textSecondary, marginBottom: 16 }}>
          Temp and contract recruitment agencies are a legitimate fast route to local experience — even though agency
          perm recruiters rarely handle entry-level roles. The key is targeting the <strong>temp/contract desk</strong>,
          not the permanent placement team.
        </p>

        <ul style={{ fontSize: 13, lineHeight: 1.8, color: warm.colors.textSecondary, paddingLeft: 20 }}>
          <li>Register with Hays, Randstad, Adecco, and Michael Page</li>
          <li>Be explicit: "I'm looking for temp or contract roles to build local experience"</li>
          <li>Ask about short-term admin, data entry, or project support roles</li>
          <li>A 3-month temp placement counts as Australian work experience</li>
          <li>Get a reference from your temp agency consultant — they become a referee</li>
        </ul>
      </Section>

      <Section icon={<Heart size={18} color="#0A66C2" />} number="02" title="Volunteering">
        <VideoPlaceholder section="02" title="Finding Strategic Volunteering Opportunities" />

        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: warm.colors.textSecondary, marginBottom: 16 }}>
          Volunteering is not just about "giving back" — it's a structured way to build Australian workplace skills,
          references, and local networks. The key is picking roles <strong>adjacent to your target field</strong>.
        </p>

        <ul style={{ fontSize: 13, lineHeight: 1.8, color: warm.colors.textSecondary, paddingLeft: 20 }}>
          <li>Seek: Australian Red Cross, Smith Family, local councils, industry associations</li>
          <li>Target roles with transferable skills: event coordination, admin, marketing, data analysis</li>
          <li>Ask for a role description upfront — document your responsibilities</li>
          <li>Request a reference from your volunteer supervisor after 2–3 months</li>
          <li>Track outcomes: "Coordinated 3 fundraising events, raising $15K" is resume-worthy</li>
        </ul>
      </Section>

      <Section icon={<Briefcase size={18} color="#0A66C2" />} number="03" title="Internships and Unpaid Work">
        <VideoPlaceholder section="03" title="Navigating Internships and Unpaid Work" />

        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: warm.colors.textSecondary, marginBottom: 16 }}>
          Unpaid internships can provide valuable experience — but know your rights under Australian law. Unpaid trials
          and internships are only legal in narrow, specific circumstances.
        </p>

        <ul style={{ fontSize: 13, lineHeight: 1.8, color: warm.colors.textSecondary, paddingLeft: 20 }}>
          <li>Vocational placements (part of your course) are legal and common</li>
          <li>Genuine volunteering for a non-profit is legal</li>
          <li>"Trial shifts" that last more than a few hours are usually illegal</li>
          <li>If you're doing productive work that benefits the business, you should be paid</li>
          <li>Check fairwork.gov.au or call 13 13 94 if unsure</li>
        </ul>

        <CautionBox>
          <strong>Warning:</strong> Unpaid internships where you're doing productive work (not just shadowing) may
          violate the Fair Work Act. If you're producing work the company uses, you are likely entitled to minimum wage.
          Don't let desperation lead to exploitation — legal unpaid roles exist, but they have strict criteria.
        </CautionBox>
      </Section>

      <Section icon={<Clock size={18} color="#0A66C2" />} number="04" title="Part-Time In-Field and Adjacent Work">
        <VideoPlaceholder section="04" title="Finding Part-Time and Adjacent Roles" />

        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: warm.colors.textSecondary, marginBottom: 16 }}>
          You don't need your dream job to build local experience. Adjacent roles — those near your field but not in it
          — build local references and demonstrate you can work in Australian workplaces.
        </p>

        <ul style={{ fontSize: 13, lineHeight: 1.8, color: warm.colors.textSecondary, paddingLeft: 20 }}>
          <li>Target software? Try IT support, QA testing, or technical writing</li>
          <li>Target marketing? Try retail marketing coordinator, events assistant, or content admin</li>
          <li>Target finance? Try accounts payable, payroll admin, or bookkeeping</li>
          <li>Even 10–15 hours/week counts — consistency matters more than volume</li>
          <li>Highlight transferable skills: "Used Salesforce" or "Managed client enquiries" is valuable</li>
        </ul>
      </Section>

      <Section icon={<Code size={18} color="#0A66C2" />} number="05" title="Projects, Hackathons, and Open Source">
        <VideoPlaceholder section="05" title="Building Evidence Through Projects" />

        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: warm.colors.textSecondary, marginBottom: 16 }}>
          Self-directed work counts as experience — if you can prove you did it and show the outcome. The key is
          documentation: code, designs, case studies, or portfolio pieces with measurable results.
        </p>

        <ul style={{ fontSize: 13, lineHeight: 1.8, color: warm.colors.textSecondary, paddingLeft: 20 }}>
          <li>GitHub repos with real code, documentation, and a README</li>
          <li>Hackathon participation (even virtual) with a demo or case study</li>
          <li>Open source contributions — start with documentation, move to code</li>
          <li>Freelance projects for friends, family, or local small businesses</li>
          <li>Personal projects with measurable outcomes: "Built a tool that reduced processing time by 40%"</li>
        </ul>

        <div
          style={{
            background: warm.colors.bgAlt,
            borderRadius: 10,
            padding: '14px 16px',
            marginTop: 16,
          }}
        >
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: warm.colors.textSecondary }}>
            <strong>What counts as evidence:</strong> Code samples, portfolio links, screenshots with outcomes,
            testimonials from users, or metrics showing impact. A project without evidence is a claim without proof.
          </p>
        </div>
      </Section>

      <Section icon={<FileText size={18} color="#0A66C2" />} number="06" title="How to Put This on Your Resume">
        <VideoPlaceholder section="06" title="Resume Strategies for Local Experience" />

        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: warm.colors.textSecondary, marginBottom: 16 }}>
          The biggest mistake? Waiting until an experience is "finished" to put it on your resume. Local experience
          should appear on your resume <strong>the moment it starts</strong> — with an end date of "Present" or
          "Ongoing."
        </p>

        <div
          style={{
            background: warm.colors.bgAlt,
            borderRadius: 10,
            padding: '16px 18px',
            marginBottom: 16,
          }}
        >
          <p
            style={{
              margin: '0 0 12px',
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: warm.colors.textSecondary,
            }}
          >
            Resume Formula
          </p>
          <code
            style={{
              display: 'block',
              fontSize: 12.5,
              lineHeight: 1.7,
              color: warm.colors.textPrimary,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
            }}
          >
            {`Role Title | Organisation | Location
Month Year – Present (or Month Year)

• Specific accomplishment with metric [e.g. "Coordinated 5 events for 200+ attendees"]
• Skill used in context [e.g. "Managed CRM database of 1,000+ contacts"]
• Outcome or result [e.g. "Reduced response time by 30% through process improvement"]`}
          </code>
        </div>

        <ul style={{ fontSize: 13, lineHeight: 1.8, color: warm.colors.textSecondary, paddingLeft: 20 }}>
          <li>Use Australian dates: "Jan 2024 – Present" not "01/2024 – Current"</li>
          <li>Include location: "Sydney, Australia" — signals local context</li>
          <li>Lead with outcomes, not responsibilities</li>
          <li>Group related experience under "Local Experience" or "Australian Experience" section</li>
          <li>Update monthly — don't wait for things to finish</li>
        </ul>
      </Section>

      <div
        style={{
          background: 'rgba(10,102,194,0.05)',
          border: '1px solid rgba(10,102,194,0.15)',
          borderRadius: 14,
          padding: '20px 24px',
          marginTop: 24,
        }}
      >
        <p
          style={{
            margin: '0 0 8px',
            fontSize: 13,
            fontWeight: 700,
            color: warm.colors.textPrimary,
          }}
        >
          Remember: Start now. Document everything.
        </p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: warm.colors.textSecondary }}>
          Local experience is a volume game. A temp role + volunteering + a side project = three local references and
          concrete Australian experience to discuss in interviews. Don't wait for the perfect opportunity — build
          momentum with what's available.
        </p>
      </div>
    </div>
  );
};

import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

type PolicyKey = 'privacy' | 'terms' | 'refunds' | 'cancellation' | 'trial' | 'disclaimer';

const NAV: { key: PolicyKey; label: string }[] = [
  { key: 'terms',        label: 'Terms of Service' },
  { key: 'privacy',      label: 'Privacy Policy' },
  { key: 'refunds',      label: 'Refund Policy' },
  { key: 'cancellation', label: 'Cancellation Policy' },
  { key: 'trial',        label: 'Free Trial Terms' },
  { key: 'disclaimer',   label: 'Disclaimer' },
];

// ── Policy content ─────────────────────────────────────────────────────────────

function Terms() {
  return (
    <Policy title="Terms of Service" updated="April 2026">
      <Section title="1. Acceptance">
        <p>By creating an account or using Aussie Grad Careers, you agree to these terms. If you do not agree, do not use the service.</p>
      </Section>
      <Section title="2. What we provide">
        <p>Aussie Grad Careers is an AI-powered job application platform for people seeking work in Australia. We provide resume tailoring, cover letter generation, job feed aggregation, LinkedIn profile generation, and related tools.</p>
      </Section>
      <Section title="3. Your account">
        <ul>
          <li>You are responsible for keeping your login credentials secure.</li>
          <li>You must not share your account with others.</li>
          <li>You must be at least 18 years old to use this service.</li>
          <li>You must be located in Australia and eligible to work here.</li>
        </ul>
      </Section>
      <Section title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>Use the service to generate false or misleading job application documents.</li>
          <li>Attempt to reverse-engineer, scrape, or abuse the platform.</li>
          <li>Use the service on behalf of others without their knowledge.</li>
          <li>Resell or redistribute any outputs from the service.</li>
        </ul>
      </Section>
      <Section title="5. No employment guarantee">
        <p>We provide tools to improve your job application materials. We do not guarantee job interviews, offers, or employment outcomes. Results depend on factors outside our control including employer decisions, market conditions, and your individual circumstances.</p>
      </Section>
      <Section title="6. Intellectual property">
        <p>Content you upload (resumes, cover letters) remains yours. AI-generated outputs are provided for your personal use. You may not resell or redistribute them.</p>
      </Section>
      <Section title="7. Limitation of liability">
        <p>To the maximum extent permitted by Australian law, we are not liable for any indirect, incidental, or consequential loss arising from your use of the service. Our total liability is limited to the amount you paid us in the 30 days before the claim.</p>
      </Section>
      <Section title="8. Changes to terms">
        <p>We may update these terms from time to time. We will notify you by email of material changes. Continued use of the service after changes constitutes acceptance.</p>
      </Section>
      <Section title="9. Governing law">
        <p>These terms are governed by the laws of Victoria, Australia. Any disputes are subject to the exclusive jurisdiction of Victorian courts.</p>
      </Section>
      <Section title="10. Contact">
        <p>Questions about these terms: <a href="mailto:kiron@aussiegradcareers.com.au" style={{ color: '#2dd4bf' }}>kiron@aussiegradcareers.com.au</a></p>
      </Section>
    </Policy>
  );
}

function Privacy() {
  return (
    <Policy title="Privacy Policy" updated="April 2026">
      <Section title="1. Who we are">
        <p>Aussie Grad Careers operates at aussiegradcareers.com.au. This policy explains how we collect, use, and protect your personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles.</p>
      </Section>
      <Section title="2. What we collect">
        <ul>
          <li><strong style={{ color: '#e2e8f0' }}>Account data:</strong> name, email address</li>
          <li><strong style={{ color: '#e2e8f0' }}>Resume and career data:</strong> resume text, work history, achievements, education, skills</li>
          <li><strong style={{ color: '#e2e8f0' }}>Onboarding answers:</strong> job search stage, target role, location, visa status, application history</li>
          <li><strong style={{ color: '#e2e8f0' }}>Usage data:</strong> pages visited, features used, document generation history</li>
          <li><strong style={{ color: '#e2e8f0' }}>Payment data:</strong> handled entirely by Stripe. We do not store card details.</li>
        </ul>
      </Section>
      <Section title="3. Why we collect it">
        <p>We use your data to:</p>
        <ul>
          <li>Generate personalised resumes, cover letters, and LinkedIn profiles</li>
          <li>Match you with relevant job listings</li>
          <li>Improve the accuracy of AI-generated content over time</li>
          <li>Send service-related emails (account, billing, product updates)</li>
          <li>With your consent: send job search tips and product news</li>
        </ul>
      </Section>
      <Section title="4. Who we share it with">
        <p>We do not sell your data. We share data only with:</p>
        <ul>
          <li><strong style={{ color: '#e2e8f0' }}>Anthropic (Claude AI):</strong> your resume and career data is sent to Claude to generate documents. Anthropic's data processing agreements apply.</li>
          <li><strong style={{ color: '#e2e8f0' }}>Google (Gemini AI):</strong> used for headshot generation only, if you use that feature.</li>
          <li><strong style={{ color: '#e2e8f0' }}>Supabase:</strong> our database and file storage provider.</li>
          <li><strong style={{ color: '#e2e8f0' }}>Stripe:</strong> payment processing.</li>
        </ul>
      </Section>
      <Section title="5. Data storage and security">
        <p>Your data is stored in Supabase on servers located in the United States. We use industry-standard encryption in transit and at rest. We take reasonable steps to protect your information from misuse, loss, and unauthorised access.</p>
      </Section>
      <Section title="6. Your rights">
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your account and data</li>
          <li>Withdraw marketing consent at any time</li>
        </ul>
        <p>To exercise any of these rights, email <a href="mailto:kiron@aussiegradcareers.com.au" style={{ color: '#2dd4bf' }}>kiron@aussiegradcareers.com.au</a>.</p>
      </Section>
      <Section title="7. Data retention">
        <p>We retain your data while your account is active. If you delete your account, we will delete your personal data within 30 days, except where we are required to retain it by law (e.g. financial records).</p>
      </Section>
      <Section title="8. Cookies">
        <p>We use essential cookies for authentication only. We do not use tracking or advertising cookies.</p>
      </Section>
      <Section title="9. Contact">
        <p>Privacy enquiries: <a href="mailto:kiron@aussiegradcareers.com.au" style={{ color: '#2dd4bf' }}>kiron@aussiegradcareers.com.au</a></p>
      </Section>
    </Policy>
  );
}

function Refunds() {
  return (
    <Policy title="Refund Policy" updated="April 2026">
      <Section title="Overview">
        <p>We offer refunds in line with your rights under the Australian Consumer Law (ACL). We also offer discretionary goodwill refunds in certain circumstances.</p>
      </Section>
      <Section title="When you are entitled to a refund">
        <p>Under the ACL, you are entitled to a refund if:</p>
        <ul>
          <li>The service has a major failure and cannot be fixed</li>
          <li>The service is not fit for the purpose we described</li>
          <li>The service is significantly different from what was advertised</li>
        </ul>
      </Section>
      <Section title="Goodwill refunds">
        <p>Outside of ACL rights, we will consider refund requests on a case-by-case basis:</p>
        <ul>
          <li><strong style={{ color: '#e2e8f0' }}>Monthly plan:</strong> requests made within 7 days of your first charge (after the free trial) will generally be approved.</li>
          <li><strong style={{ color: '#e2e8f0' }}>Annual plan:</strong> requests made within 14 days of your first charge will generally be approved.</li>
          <li><strong style={{ color: '#e2e8f0' }}>3-Month Bundle:</strong> requests made within 14 days of purchase will generally be approved if the service has not been substantially used.</li>
        </ul>
        <p>Change-of-mind refunds outside these windows are not guaranteed but can be requested.</p>
      </Section>
      <Section title="How to request a refund">
        <p>Email <a href="mailto:kiron@aussiegradcareers.com.au" style={{ color: '#2dd4bf' }}>kiron@aussiegradcareers.com.au</a> with your account email and reason. We aim to respond within 2 business days. Approved refunds are processed via Stripe and appear within 5-10 business days.</p>
      </Section>
      <Section title="What we do not refund">
        <ul>
          <li>Unused days remaining in a billing period after cancellation (access continues until period end)</li>
          <li>Subscriptions where the free trial was used and the account was not cancelled before day 8</li>
          <li>Accounts found to have violated our Terms of Service</li>
        </ul>
      </Section>
    </Policy>
  );
}

function Cancellation() {
  return (
    <Policy title="Cancellation Policy" updated="April 2026">
      <Section title="Monthly and Annual plans">
        <p>You can cancel at any time from your account settings. When you cancel:</p>
        <ul>
          <li>Your access continues until the end of the current billing period</li>
          <li>You will not be charged again after the current period</li>
          <li>No partial refunds are issued for the remaining days (unless required by the ACL)</li>
        </ul>
      </Section>
      <Section title="3-Month Bundle">
        <p>The 3-Month Bundle is a one-time payment. There is no recurring subscription to cancel. Your access runs for 90 days from the date of purchase and expires automatically.</p>
      </Section>
      <Section title="Free trial cancellation">
        <p>If you are on a free trial, you must cancel before day 8 to avoid being charged. Cancelling during the trial ends your access at the end of the trial period.</p>
      </Section>
      <Section title="Your data after cancellation">
        <p>Your documents and profile data are retained for 30 days after your access expires. You can request immediate deletion by emailing <a href="mailto:kiron@aussiegradcareers.com.au" style={{ color: '#2dd4bf' }}>kiron@aussiegradcareers.com.au</a>.</p>
      </Section>
      <Section title="How to cancel">
        <p>Log in to your account, go to Settings, and click "Manage subscription". This opens the Stripe billing portal where you can cancel immediately. Alternatively, email us and we will cancel on your behalf.</p>
      </Section>
    </Policy>
  );
}

function Trial() {
  return (
    <Policy title="Free Trial Terms" updated="April 2026">
      <Section title="Which plans include a free trial">
        <p>The Monthly and Annual plans include a 7-day free trial. The 3-Month Bundle does not include a free trial as it is a one-time payment.</p>
      </Section>
      <Section title="How the trial works">
        <ul>
          <li>Your trial starts immediately when you sign up</li>
          <li>A valid payment card is required to start the trial</li>
          <li>Your card is not charged during the 7-day trial period</li>
          <li>On day 8, your card is automatically charged for the first billing period</li>
          <li>You have full access to all features during the trial</li>
        </ul>
      </Section>
      <Section title="Cancelling before the trial ends">
        <p>You can cancel at any time before day 8 and you will not be charged. Your access will end at the conclusion of the 7-day trial period.</p>
      </Section>
      <Section title="One trial per person">
        <p>Free trials are available once per person. Creating multiple accounts to access additional trials is a violation of our Terms of Service.</p>
      </Section>
      <Section title="After the trial">
        <p>If you do not cancel, your subscription becomes active and you are billed according to your chosen plan. You can cancel at any time after this point in accordance with our Cancellation Policy.</p>
      </Section>
    </Policy>
  );
}

function Disclaimer() {
  return (
    <Policy title="Disclaimer" updated="April 2026">
      <Section title="No employment guarantee">
        <p>Aussie Grad Careers provides tools to help you prepare job application materials. We do not guarantee that using our service will result in job interviews, employment offers, or any particular career outcome. Results depend on many factors outside our control, including employer requirements, labour market conditions, your qualifications, and competition for roles.</p>
      </Section>
      <Section title="AI-generated content">
        <p>Documents generated by our AI tools are starting points, not finished products. You should review all AI-generated content before submitting it to employers. We are not responsible for inaccuracies, omissions, or content that does not reflect your actual experience or qualifications.</p>
        <p>Do not submit AI-generated content that misrepresents your skills, experience, or achievements. Doing so may have serious consequences with employers and is a violation of our Terms of Service.</p>
      </Section>
      <Section title="Job listings">
        <p>Job listings shown on the platform are sourced from third-party providers including Seek, LinkedIn, and Adzuna. We do not verify the accuracy, legitimacy, or current availability of any listing. Always confirm details directly with the employer before applying.</p>
      </Section>
      <Section title="Not professional career advice">
        <p>The content and tools on this platform are not a substitute for professional career coaching, legal advice, or migration advice. If you need advice on your visa status, work rights, or employment contracts, consult a registered professional.</p>
      </Section>
      <Section title="Third-party services">
        <p>We are not responsible for the practices or content of third-party services linked to or integrated with our platform, including Stripe, Supabase, Seek, LinkedIn, and Adzuna.</p>
      </Section>
    </Policy>
  );
}

// ── Shared layout components ───────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', margin: '0 0 10px' }}>{title}</h3>
      <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}

function Policy({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 26, fontWeight: 900, color: 'white', margin: '0 0 6px' }}>{title}</h2>
        <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Last updated: {updated}</p>
      </div>
      <div style={{
        fontSize: 14, color: '#94a3b8', lineHeight: 1.8,
      }}>
        <style>{`
          .legal-content ul { margin: 8px 0 8px 20px; padding: 0; }
          .legal-content li { margin-bottom: 6px; }
          .legal-content p { margin: 0 0 12px; }
          .legal-content p:last-child { margin-bottom: 0; }
        `}</style>
        <div className="legal-content">{children}</div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const POLICIES: Record<PolicyKey, React.ReactNode> = {
  terms:        <Terms />,
  privacy:      <Privacy />,
  refunds:      <Refunds />,
  cancellation: <Cancellation />,
  trial:        <Trial />,
  disclaimer:   <Disclaimer />,
};

export function LegalPage() {
  const { policy } = useParams<{ policy: PolicyKey }>();
  const navigate = useNavigate();
  const active = (policy as PolicyKey) || 'terms';

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [active]);

  if (!POLICIES[active]) {
    navigate('/legal/terms', { replace: true });
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0d1a2d 0%, #080f1a 100%)',
      color: 'white',
    }}>
      {/* Nav */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={16} style={{ color: '#2dd4bf' }} />
          <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.05em', color: 'white' }}>
            Aussie Grad Careers
          </span>
        </div>
        <button
          onClick={() => navigate('/pricing')}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 700,
            color: '#94a3b8',
            cursor: 'pointer',
          }}
        >
          Back to pricing
        </button>
      </div>

      <div style={{
        maxWidth: 960,
        margin: '0 auto',
        padding: '48px 24px 96px',
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: 48,
        alignItems: 'start',
      }}>
        {/* Sidebar */}
        <nav style={{ position: 'sticky', top: 32 }}>
          <p style={{
            fontSize: 10, fontWeight: 900, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#475569', marginBottom: 12,
          }}>
            Legal
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV.map(({ key, label }) => (
              <Link
                key={key}
                to={`/legal/${key}`}
                style={{
                  display: 'block',
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: active === key ? 700 : 500,
                  color: active === key ? 'white' : '#64748b',
                  background: active === key ? 'rgba(255,255,255,0.06)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  borderLeft: `2px solid ${active === key ? '#2dd4bf' : 'transparent'}`,
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Content */}
        <main style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 20,
          padding: '36px 40px',
        }}>
          {POLICIES[active]}
        </main>
      </div>
    </div>
  );
}

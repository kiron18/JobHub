import { describe, it, expect } from 'vitest';
import {
    clientForAddress, composeUrl, fitBody, rankAddresses, confidenceNote,
    MAX_BODY_CHARS, type AddressOption,
} from '../composeHandoff';

describe('clientForAddress', () => {
    it('routes on the address they signed up with', () => {
        expect(clientForAddress('someone@gmail.com')).toBe('gmail');
        expect(clientForAddress('SOMEONE@GoogleMail.com')).toBe('gmail');
        expect(clientForAddress('someone@outlook.com.au')).toBe('outlook');
        expect(clientForAddress('someone@hotmail.com')).toBe('outlook');
    });

    it('falls back to mailto for a work or university address', () => {
        expect(clientForAddress('a@student.unsw.edu.au')).toBe('default');
        expect(clientForAddress('a@company.com.au')).toBe('default');
    });

    it('does not throw on the address being missing', () => {
        // A profile with no email must not break the button, and 'default'
        // renders a mailto link that simply does nothing if unhandled.
        expect(clientForAddress(null)).toBe('default');
        expect(clientForAddress('')).toBe('default');
        expect(clientForAddress('not-an-address')).toBe('default');
    });
});

describe('fitBody', () => {
    it('leaves a normal follow-up alone', () => {
        const body = 'Hi Sarah,\n\nI applied for the Data Analyst role last week.\n\nThanks,\nKiron';
        expect(fitBody(body)).toEqual({ body, truncated: false });
    });

    it('cuts at a paragraph break rather than mid-sentence', () => {
        const para = 'x'.repeat(1000);
        const { body, truncated } = fitBody(`${para}\n\n${para}\n\n${para}`);
        expect(truncated).toBe(true);
        expect(body).toBe(para);              // a whole paragraph, nothing dangling
        expect(body.length).toBeLessThanOrEqual(MAX_BODY_CHARS);
    });

    it('still trims when there is no paragraph break to cut on', () => {
        const { body, truncated } = fitBody('y'.repeat(5000));
        expect(truncated).toBe(true);
        expect(body.length).toBeLessThanOrEqual(MAX_BODY_CHARS);
    });
});

describe('composeUrl', () => {
    const draft = {
        to: 'sarah.chen@acme.com.au',
        subject: 'Following up: Data Analyst application',
        body: 'Hi Sarah,\n\nI applied last week.',
    };

    it('opens Gmail compose with the draft filled in', () => {
        const url = composeUrl(draft, 'gmail');
        expect(url.startsWith('https://mail.google.com/mail/?')).toBe(true);
        const q = new URL(url).searchParams;
        expect(q.get('view')).toBe('cm');
        expect(q.get('to')).toBe(draft.to);
        expect(q.get('su')).toBe(draft.subject);
        expect(q.get('body')).toBe(draft.body);
    });

    it('opens Outlook compose for a hotmail signup', () => {
        const url = composeUrl(draft, 'outlook');
        expect(url.startsWith('https://outlook.live.com/mail/0/deeplink/compose?')).toBe(true);
        expect(new URL(url).searchParams.get('subject')).toBe(draft.subject);
    });

    it('encodes a mailto so spaces survive as spaces', () => {
        // URLSearchParams renders a space as "+", which mail clients show
        // literally in the subject line. This is why mailto is hand-encoded.
        const url = composeUrl(draft, 'default');
        expect(url).toContain('%20');
        expect(url).not.toContain('+');
        expect(url.startsWith('mailto:')).toBe(true);
    });
});

describe('rankAddresses', () => {
    const opt = (address: string, confidence: AddressOption['confidence']): AddressOption =>
        ({ address, confidence, label: '', why: [] });

    it('puts a shared inbox ahead of a guessed personal address', () => {
        // A constructed address is accepted silently by any catch-all domain
        // and read by nobody. careers@ is certain to be monitored.
        const ranked = rankAddresses([
            opt('s.chen@acme.com.au', 'constructed'),
            opt('careers@acme.com.au', 'generic'),
        ]);
        expect(ranked.map(o => o.address)).toEqual(['careers@acme.com.au', 's.chen@acme.com.au']);
    });

    it('puts a published address first of all', () => {
        const ranked = rankAddresses([
            opt('careers@acme.com.au', 'generic'),
            opt('guess@acme.com.au', 'constructed'),
            opt('real.person@acme.com.au', 'published'),
            opt('checked@acme.com.au', 'verified'),
        ]);
        expect(ranked.map(o => o.confidence)).toEqual(['published', 'verified', 'generic', 'constructed']);
    });

    it('does not mutate what it was given', () => {
        const input = [opt('b@x.com', 'constructed'), opt('a@x.com', 'published')];
        rankAddresses(input);
        expect(input[0].address).toBe('b@x.com');
    });
});

describe('confidenceNote', () => {
    it('never reassures the candidate about a guess', () => {
        const note = confidenceNote('constructed');
        expect(note).toMatch(/not confirmed|may bounce/i);
        expect(confidenceNote('published')).toMatch(/not a guess/i);
    });
});

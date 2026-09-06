import { describe, it, expect } from 'vitest';
import { readAddresses, siteContactLimits } from './siteContact';

const limits = { ...siteContactLimits(), sameDomainOnly: true };

describe('readAddresses', () => {
    it('reads the address a small business publishes on its contact page', () => {
        const html = `<p>Call us on 02 4340 1234 or email
            <a href="mailto:info@digdeepcivil.com.au">info@digdeepcivil.com.au</a></p>`;
        expect(readAddresses(html, 'digdeepcivil.com.au', limits)[0].email)
            .toBe('info@digdeepcivil.com.au');
    });

    it('prefers a named person over the shared inbox', () => {
        const html = `mailto:info@nsnelectrical.com.au mailto:sarah@nsnelectrical.com.au`;
        const out = readAddresses(html, 'nsnelectrical.com.au', limits);
        expect(out[0].email).toBe('sarah@nsnelectrical.com.au');
        expect(out[0].generic).toBe(false);
        expect(out[1].generic).toBe(true);
    });

    it('drops the web designer, the accountant and anyone else off-domain', () => {
        // The exact shape of a small business site: their own address, the
        // agency that built it, and a form handler.
        const html = `
            <a href="mailto:admin@nsnelectrical.com.au">us</a>
            <a href="mailto:hello@brightsparkdigital.com">site by Brightspark</a>
            <a href="mailto:forms@formspree.io">form</a>`;
        const out = readAddresses(html, 'nsnelectrical.com.au', limits);
        expect(out.map(o => o.email)).toEqual(['admin@nsnelectrical.com.au']);
    });

    it('keeps a subdomain of the employer, which is still the employer', () => {
        const html = 'mailto:jobs@mail.itstrategic.com.au';
        expect(readAddresses(html, 'itstrategic.com.au', limits)).toHaveLength(1);
    });

    it('drops no-reply and postmaster, which nobody reads', () => {
        const html = 'mailto:no-reply@acme.com.au mailto:postmaster@acme.com.au mailto:info@acme.com.au';
        expect(readAddresses(html, 'acme.com.au', limits).map(o => o.email))
            .toEqual(['info@acme.com.au']);
    });

    it('is not fooled by an image filename that looks like an address', () => {
        const html = '<img src="logo@2x.acme.com.au/hero.png"> mailto:info@acme.com.au';
        expect(readAddresses(html, 'acme.com.au', limits).map(o => o.email))
            .toEqual(['info@acme.com.au']);
    });

    it('returns nothing rather than something when the page has no address', () => {
        expect(readAddresses('<p>Use the form below.</p>', 'acme.com.au', limits)).toEqual([]);
    });

    it('lets the same-domain rule be switched off, rather than baking it in', () => {
        const html = 'mailto:hello@somebodyelse.com';
        expect(readAddresses(html, 'acme.com.au', { ...limits, sameDomainOnly: true })).toHaveLength(0);
        expect(readAddresses(html, 'acme.com.au', { ...limits, sameDomainOnly: false })).toHaveLength(1);
    });
});

describe('a small business whose real inbox is a Gmail account', () => {
    it('keeps the free-mail address that carries the business name', () => {
        // Verbatim from eclipsegames.com.au, the Good Games ad in the corpus.
        const html = '<a href="mailto:%20info.eclipsegames@gmail.com\\">Email us</a>';
        const out = readAddresses(html, 'eclipsegames.com.au', limits);
        expect(out.map(o => o.email)).toEqual(['info.eclipsegames@gmail.com']);
    });

    it('still drops a personal free-mail address that does not', () => {
        const html = 'mailto:johnsmith84@gmail.com';
        expect(readAddresses(html, 'eclipsegames.com.au', limits)).toHaveLength(0);
    });

    it('prefers the address on the employer\'s own domain when both are present', () => {
        const html = 'mailto:info.eclipsegames@gmail.com mailto:sales@eclipsegames.com.au';
        expect(readAddresses(html, 'eclipsegames.com.au', limits)[0].email)
            .toBe('sales@eclipsegames.com.au');
    });

    it('can be switched off', () => {
        const html = 'mailto:info.eclipsegames@gmail.com';
        expect(readAddresses(html, 'eclipsegames.com.au', { ...limits, allowNamedFreeMail: false }))
            .toHaveLength(0);
    });
});

describe('limits that were wrong the first time', () => {
    it('finds an address in a page footer past the old 400KB cap', () => {
        // eclipsegames.com.au is 1.2MB of inlined script before its only
        // address. The first version of this module capped reads at 400KB and
        // silently found nothing here.
        // Realistic filler, not one repeated character: a page this size is
        // inlined script, and the scan has to stay linear over it.
        const html = '<script>var a=1;fn(x,y);</script>'.repeat(30_000)
            + '<a href="mailto:info.eclipsegames@gmail.com">Email</a>';
        expect(readAddresses(html, 'eclipsegames.com.au', limits)[0].email)
            .toBe('info.eclipsegames@gmail.com');
    });

    it('reports an encoded address once, not twice', () => {
        const html = '<a href="mailto:%20info@acme.com.au">Email</a>';
        expect(readAddresses(html, 'acme.com.au', limits).map(o => o.email))
            .toEqual(['info@acme.com.au']);
    });
});

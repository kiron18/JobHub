import { Router } from 'express';
import { isGateEnforced } from '../config/accessGate';

const router = Router();

/**
 * Reports which build is actually serving traffic.
 *
 * Added because a deploy question cost a whole debugging session: the frontend
 * was running code from several commits back and there was no way to tell from
 * the outside, so the symptom read as "the fix does not work" rather than "the
 * fix is not deployed". Railway injects the commit it built, so hitting this
 * answers it in one request.
 *
 * It also reports uptime, for the other question a deploy raises: a 502 on a
 * long request is either the proxy giving up on something the app is still
 * working on, or the container having restarted underneath it, and those have
 * completely different fixes. An uptime of nine seconds says which one it was
 * without going anywhere near the platform's logs.
 */
/**
 * Whether a variable is SET. Never what it is set to.
 *
 * Contact discovery is the case that needs this. It depends on a flag and two
 * vendor keys held per environment, and every way it fails when one is missing
 * looks identical to it working and finding nobody: the search client catches
 * its own error, returns an empty array, and the route reports "no domain" for
 * every employer. The only difference between "misconfigured" and "this
 * employer is genuinely not findable" is a variable nobody outside the platform
 * can see.
 *
 * Booleans only. A health endpoint is unauthenticated, so it can say that a key
 * exists and must never say more than that.
 */
function contactDiscoveryConfig() {
    return {
        enabled: (process.env.COMPANY_RESEARCH_ENABLED ?? '').toLowerCase() === 'true',
        /*
          BOTH search vendors, because the pipeline uses both and reporting one
          of them hid a real outage. routes/research.ts runs its people searches
          through Serper; services/employerDomain.ts resolves the employer's
          website through SerpApi. On 8 Sep 2026 staging reported
          `serpapiKey: true` and looked healthy while every contact lookup came
          back empty, because the missing key was the OTHER one — the log said
          "[serper] SERPER_API_KEY not set" three times a lookup and the health
          endpoint had no opinion about it.
        */
        serpapiKey: Boolean(process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY),
        serperKey: Boolean(process.env.SERPER_API_KEY),
        hunterKey: Boolean(process.env.HUNTER_API_KEY),
    };
}

router.get('/', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7)
            ?? process.env.GIT_COMMIT_SHA?.slice(0, 7)
            ?? 'unknown',
        uptimeSeconds: Math.round(process.uptime()),
        contactDiscovery: contactDiscoveryConfig(),
        /*
          Whether free accounts are being limited right now.

          FREE_TIER_GATE is the one variable that decides whether a signed-in
          free account gets five generations or an unlimited product, and it can
          be changed in Railway without a deploy — which means the commit above
          does NOT tell you which mode is live. This does. A boolean only: it
          says which of two documented modes is running and nothing else.
        */
        freeTierGate: isGateEnforced() ? 'enforced' : 'paused',
    });
});

export default router;

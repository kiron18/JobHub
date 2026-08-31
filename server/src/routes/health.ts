import { Router } from 'express';

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
router.get('/', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7)
            ?? process.env.GIT_COMMIT_SHA?.slice(0, 7)
            ?? 'unknown',
        uptimeSeconds: Math.round(process.uptime()),
    });
});

export default router;

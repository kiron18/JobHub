-- Text extraction returns text only, so a photo or logo in the upload is
-- invisible to every prompt downstream. detectDocumentSignals inspects the raw
-- bytes; the result is stored so /build can use it as well as /brief.
ALTER TABLE "WelcomeSession" ADD COLUMN IF NOT EXISTS "signals" JSONB;

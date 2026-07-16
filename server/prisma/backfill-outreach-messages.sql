INSERT INTO "OutreachMessage" ("id", "outreachLogId", "touchNumber", "body", "copiedAt")
SELECT
    gen_random_uuid()::text,
    ol."id",
    1,
    ol."firstMessage",
    ol."createdAt"
FROM "OutreachLog" ol
WHERE ol."firstMessage" IS NOT NULL
  AND ol."firstMessage" != ''
  AND NOT EXISTS (
    SELECT 1 FROM "OutreachMessage" om
    WHERE om."outreachLogId" = ol."id" AND om."touchNumber" = 1
  );

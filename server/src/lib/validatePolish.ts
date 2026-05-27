import { z } from 'zod';

export const PolishPayloadSchema = z.object({
  summary: z.string().optional(),
  experience: z
    .array(
      z.object({
        id: z.string(),
        bullets: z.array(z.string()),
      }),
    )
    .optional(),
});

export type ValidatedPolish = z.infer<typeof PolishPayloadSchema>;

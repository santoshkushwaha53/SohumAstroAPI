import { z } from 'zod';
import { BirthInputSchema } from './astro.validator';

export const REPORT_TYPES = [
  'vedic-birth-chart',
  'western-birth-chart',
  'vimshottari-dasha',
  'navamsa',
  'synastry',
  'transit-report',
] as const;

export const GenerateReportSchema = z.object({
  reportType: z.enum(REPORT_TYPES),
  userId:     z.string().min(1),
  /** Primary birth data */
  natal:      BirthInputSchema,
  /** Secondary birth data (required for synastry) */
  natal2:     BirthInputSchema.optional(),
  /** Transit date (required for transit-report) */
  transitDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  transitTimezone: z.string().optional(),
  options: z.object({
    ayanamsa:    z.enum(['LAHIRI','RAMAN','KRISHNAMURTI','FAGAN_BRADLEY','TRUE_CITRA']).default('LAHIRI'),
    houseSystem: z.enum(['P','W','E','K']).default('W'),
    yearsAhead:  z.number().int().min(1).max(200).default(100),
  }).optional(),
});

export type GenerateReportDto = z.infer<typeof GenerateReportSchema>;

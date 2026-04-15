import { z } from 'zod';
import { DateSchema, TimezoneSchema } from './astro.validator';

export const PanchangSchema = z.object({
  date:      DateSchema,
  timezone:  TimezoneSchema,
  latitude:  z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  ayanamsa:  z.enum(['LAHIRI','RAMAN','KRISHNAMURTI','FAGAN_BRADLEY','TRUE_CITRA']).default('LAHIRI'),
});

export const PanchangRangeSchema = z.object({
  startDate:   DateSchema,
  days:        z.number().int().min(1).max(365).default(7),
  timezone:    TimezoneSchema,
  latitude:    z.number().min(-90).max(90),
  longitude:   z.number().min(-180).max(180),
  ayanamsa:    z.enum(['LAHIRI','RAMAN','KRISHNAMURTI','FAGAN_BRADLEY','TRUE_CITRA']).default('LAHIRI'),
  /** When true, stream response as Excel file download */
  exportExcel: z.boolean().default(false),
});

export type PanchangDto      = z.infer<typeof PanchangSchema>;
export type PanchangRangeDto = z.infer<typeof PanchangRangeSchema>;

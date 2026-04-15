import { z } from 'zod';
import { BirthInputSchema, PLANET_NAMES } from './astro.validator';

const PersonSchema = BirthInputSchema.extend({ label: z.string().max(50).optional() });

// ── /western/birth-chart ──────────────────────────────────────────────────────
export const WesternBirthChartSchema = BirthInputSchema.extend({
  houseSystem: z.enum(['P','W','E','K','O','R','C']).default('P'),
});

// ── /western/aspects ──────────────────────────────────────────────────────────
export const AspectsSchema = z.object({
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time:     z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default('12:00:00'),
  timezone: z.string().default('+00:00'),
  planets:  z.array(z.enum(PLANET_NAMES)).optional(),
  /** Overrides for aspect orbs in degrees */
  orbs: z.record(
    z.enum(['Conjunction','Sextile','Square','Trine','Opposition','Quincunx','Semi-sextile','Semi-square','Sesquiquadrate']),
    z.number().min(0).max(15)
  ).optional(),
});

// ── /western/synastry ─────────────────────────────────────────────────────────
export const SynastrySchema = z.object({
  person1: PersonSchema,
  person2: PersonSchema,
});

// ── /transits ─────────────────────────────────────────────────────────────────
export const TransitSchema = z.object({
  natal: BirthInputSchema,
  transitDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transitTime:     z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default('12:00:00'),
  transitTimezone: z.string().default('+00:00'),
  planets:  z.array(z.enum(PLANET_NAMES)).optional(),
});

// ── Types ─────────────────────────────────────────────────────────────────────
export type WesternBirthChartDto = z.infer<typeof WesternBirthChartSchema>;
export type AspectsDto           = z.infer<typeof AspectsSchema>;
export type SynastryDto          = z.infer<typeof SynastrySchema>;
export type TransitDto           = z.infer<typeof TransitSchema>;

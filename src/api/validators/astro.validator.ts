import { z } from 'zod';

// ── Shared base ────────────────────────────────────────────────────────────────

export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');
export const TimeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Must be HH:mm or HH:mm:ss').default('12:00:00');
export const TimezoneSchema = z.string().regex(/^([+-]\d{2}:\d{2}|UTC|Z)$/, 'Must be ±HH:MM, UTC, or Z').default('+00:00');

export const BirthInputSchema = z.object({
  date:      DateSchema,
  time:      TimeSchema,
  timezone:  TimezoneSchema,
  latitude:  z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const PLANET_NAMES = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Rahu','Ketu'] as const;
export const HOUSE_SYSTEMS = ['P','W','E','K','O','R','C'] as const;
export const ASTRO_MODES   = ['tropical','sidereal'] as const;

// ── /astro/julian-day ─────────────────────────────────────────────────────────
export const JulianDaySchema = z.object({
  date:     DateSchema,
  time:     TimeSchema,
  timezone: TimezoneSchema,
});

// ── /astro/planet-positions ───────────────────────────────────────────────────
export const PlanetPositionsSchema = z.object({
  date:     DateSchema,
  time:     TimeSchema,
  timezone: TimezoneSchema,
  mode:     z.enum(ASTRO_MODES).default('tropical'),
  ayanamsa: z.enum(['LAHIRI','RAMAN','KRISHNAMURTI','FAGAN_BRADLEY','TRUE_CITRA']).default('LAHIRI'),
  planets:  z.array(z.enum(PLANET_NAMES)).optional(),
});

// ── /astro/houses ─────────────────────────────────────────────────────────────
export const HousesSchema = z.object({
  date:        DateSchema,
  time:        TimeSchema,
  timezone:    TimezoneSchema,
  latitude:    z.number().min(-90).max(90),
  longitude:   z.number().min(-180).max(180),
  houseSystem: z.enum(HOUSE_SYSTEMS).default('P'),
  mode:        z.enum(ASTRO_MODES).default('tropical'),
  ayanamsa:    z.enum(['LAHIRI','RAMAN','KRISHNAMURTI','FAGAN_BRADLEY','TRUE_CITRA']).default('LAHIRI'),
});

// ── Types ─────────────────────────────────────────────────────────────────────
export type BirthInputDto       = z.infer<typeof BirthInputSchema>;
export type JulianDayDto        = z.infer<typeof JulianDaySchema>;
export type PlanetPositionsDto  = z.infer<typeof PlanetPositionsSchema>;
export type HousesDto           = z.infer<typeof HousesSchema>;

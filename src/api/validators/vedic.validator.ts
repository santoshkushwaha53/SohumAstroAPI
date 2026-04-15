import { z } from 'zod';
import { BirthInputSchema } from './astro.validator';

export const AyanamsaSchema = z.enum(['LAHIRI','RAMAN','KRISHNAMURTI','FAGAN_BRADLEY','TRUE_CITRA']).default('LAHIRI');
export const VedicHouseSchema = z.enum(['W','P','E','K']).default('W');

// ── /vedic/ayanamsa ───────────────────────────────────────────────────────────
export const AyanamsaQuerySchema = z.object({
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time:     z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default('12:00:00'),
  timezone: z.string().default('+00:00'),
  ayanamsa: AyanamsaSchema,
});

// ── /vedic/birth-chart ────────────────────────────────────────────────────────
export const VedicBirthChartSchema = BirthInputSchema.extend({
  ayanamsa:    AyanamsaSchema,
  houseSystem: VedicHouseSchema,
});

// ── /vedic/nakshatra ──────────────────────────────────────────────────────────
export const NakshatraSchema = z.discriminatedUnion('mode', [
  z.object({
    mode:      z.literal('longitude'),
    longitude: z.number().min(0).max(360),  // sidereal longitude
  }),
  z.object({
    mode:      z.literal('birth'),
    date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time:      z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).default('12:00:00'),
    timezone:  z.string().default('+00:00'),
    latitude:  z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    planet:    z.enum(['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Rahu','Ketu']).default('Moon'),
    ayanamsa:  AyanamsaSchema,
  }),
]);

// ── /vedic/dasha/vimshottari ──────────────────────────────────────────────────
export const VimshottariSchema = BirthInputSchema.extend({
  ayanamsa:               AyanamsaSchema,
  yearsAhead:             z.number().int().min(1).max(200).default(100),
  includePratyantardasha: z.boolean().default(false),
});

// ── /vedic/navamsa ────────────────────────────────────────────────────────────
export const NavamsaSchema = BirthInputSchema.extend({
  ayanamsa: AyanamsaSchema,
});

// ── /vedic/vargas ─────────────────────────────────────────────────────────────
const VARGA_CODE = z.enum(['D1','D2','D3','D4','D7','D9','D10','D12','D16','D20','D24','D27','D30','D40','D45','D60']);
export const VargasSchema = BirthInputSchema.extend({
  ayanamsa: AyanamsaSchema,
  vargas:   z.array(VARGA_CODE).min(1).max(16).default(['D1','D2','D3','D4','D7','D9','D10','D12']),
});

// ── /vedic/compatibility ──────────────────────────────────────────────────────
export const CompatibilitySchema = z.object({
  person1: BirthInputSchema,
  person2: BirthInputSchema,
  ayanamsa: AyanamsaSchema,
});

// ── /vedic/yogas ─────────────────────────────────────────────────────────────
export const YogasSchema = BirthInputSchema.extend({
  ayanamsa:    AyanamsaSchema,
  houseSystem: VedicHouseSchema,
});

// ── /vedic/horoscope ──────────────────────────────────────────────────────────
export const HoroscopeSchema = BirthInputSchema.extend({
  ayanamsa:         AyanamsaSchema,
  houseSystem:      VedicHouseSchema,
  period:           z.enum(['daily','tomorrow','weekly','monthly','yearly']).default('daily'),
  startDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  transitLatitude:  z.number().min(-90).max(90).optional(),
  transitLongitude: z.number().min(-180).max(180).optional(),
  transitTimezone:  z.string().optional(),
});

// ── /vedic/kundali ────────────────────────────────────────────────────────────
export const KundaliSchema = BirthInputSchema.extend({
  ayanamsa:               AyanamsaSchema,
  houseSystem:            VedicHouseSchema,
  includePratyantardasha: z.boolean().default(false),
  partner:                BirthInputSchema.optional(),
  transitDate:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  transitLatitude:        z.number().min(-90).max(90).optional(),
  transitLongitude:       z.number().min(-180).max(180).optional(),
  transitTimezone:        z.string().optional(),
});

// ── Types ─────────────────────────────────────────────────────────────────────
export type AyanamsaQueryDto     = z.infer<typeof AyanamsaQuerySchema>;
export type VedicBirthChartDto   = z.infer<typeof VedicBirthChartSchema>;
export type NakshatraDto         = z.infer<typeof NakshatraSchema>;
export type VimshottariDto       = z.infer<typeof VimshottariSchema>;
export type NavamsaDto           = z.infer<typeof NavamsaSchema>;
export type VargasDto            = z.infer<typeof VargasSchema>;
export type CompatibilityDto     = z.infer<typeof CompatibilitySchema>;
export type YogasDto             = z.infer<typeof YogasSchema>;
export type HoroscopeDto         = z.infer<typeof HoroscopeSchema>;
export type KundaliDto           = z.infer<typeof KundaliSchema>;

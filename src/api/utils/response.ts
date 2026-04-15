/**
 * Standard raw-data response envelope.
 *
 * Every calculation endpoint must return this shape:
 * {
 *   success, input, meta, calculationContext, data, warnings, errors
 * }
 *
 * This ensures machine-readable, schema-consistent outputs that downstream
 * AI interpretation layers can rely on.
 */

export interface ResponseMeta {
  engine:      string;
  version:     string;
  generatedAt: string;  // ISO 8601
}

export interface CalcContext {
  utcDateTime:  string;   // ISO 8601 UTC
  julianDay:    number;
  zodiacMode:   string;   // 'tropical' | 'sidereal'
  ayanamsa:     { name: string; value: number } | null;
  houseSystem:  { code: string; name: string } | null;
}

export interface RawResponse<T = unknown> {
  success:            boolean;
  input:              Record<string, unknown>;
  meta:               ResponseMeta;
  calculationContext: CalcContext | null;
  data:               T;
  warnings:           string[];
  errors:             string[];
}

// ── House system name map ──────────────────────────────────────────────────────

const HOUSE_SYSTEM_NAMES: Record<string, string> = {
  P: 'Placidus',
  W: 'Whole Sign',
  E: 'Equal',
  K: 'Koch',
  O: 'Porphyry',
  R: 'Regiomontanus',
  C: 'Campanus',
  A: 'Equal (Asc)',
  B: 'Alcabitus',
  M: 'Morinus',
  X: 'Axial Rotation',
};

// ── Builders ───────────────────────────────────────────────────────────────────

export function buildMeta(): ResponseMeta {
  return {
    engine:      'Swiss Ephemeris (swisseph npm v0.5.x, Moshier built-in)',
    version:     process.env.npm_package_version ?? '1.0.0',
    generatedAt: new Date().toISOString(),
  };
}

export function buildCalcContext(opts: {
  julianDay:   number;
  utcDateTime: string;
  mode:        string;
  ayanamsa?:   { name: string; value: number } | null;
  houseSystem?: string | null;
}): CalcContext {
  const hsCode = opts.houseSystem ?? null;
  return {
    utcDateTime: opts.utcDateTime,
    julianDay:   opts.julianDay,
    zodiacMode:  opts.mode,
    ayanamsa:    opts.ayanamsa ?? null,
    houseSystem: hsCode
      ? { code: hsCode, name: HOUSE_SYSTEM_NAMES[hsCode] ?? hsCode }
      : null,
  };
}

export function buildResponse<T>(opts: {
  input:              Record<string, unknown>;
  calculationContext: CalcContext | null;
  data:               T;
  warnings?:          string[];
  errors?:            string[];
}): RawResponse<T> {
  return {
    success:            (opts.errors?.length ?? 0) === 0,
    input:              opts.input,
    meta:               buildMeta(),
    calculationContext: opts.calculationContext,
    data:               opts.data,
    warnings:           opts.warnings ?? [],
    errors:             opts.errors   ?? [],
  };
}

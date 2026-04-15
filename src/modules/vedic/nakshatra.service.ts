/**
 * Nakshatra (lunar mansion) calculation.
 * 27 nakshatras × 13°20' each = 360°
 * Each nakshatra has 4 padas × 3°20' each.
 */

export interface NakshatraResult {
  name: string;
  index: number;       // 0-based (0=Ashwini…26=Revati)
  pada: number;        // 1–4
  lord: string;
  degreesInNakshatra: number;
}

const NAKSHATRAS = [
  { name: 'Ashwini',      lord: 'Ketu' },
  { name: 'Bharani',      lord: 'Venus' },
  { name: 'Krittika',     lord: 'Sun' },
  { name: 'Rohini',       lord: 'Moon' },
  { name: 'Mrigashira',   lord: 'Mars' },
  { name: 'Ardra',        lord: 'Rahu' },
  { name: 'Punarvasu',    lord: 'Jupiter' },
  { name: 'Pushya',       lord: 'Saturn' },
  { name: 'Ashlesha',     lord: 'Mercury' },
  { name: 'Magha',        lord: 'Ketu' },
  { name: 'Purva Phalguni', lord: 'Venus' },
  { name: 'Uttara Phalguni', lord: 'Sun' },
  { name: 'Hasta',        lord: 'Moon' },
  { name: 'Chitra',       lord: 'Mars' },
  { name: 'Swati',        lord: 'Rahu' },
  { name: 'Vishakha',     lord: 'Jupiter' },
  { name: 'Anuradha',     lord: 'Saturn' },
  { name: 'Jyeshtha',     lord: 'Mercury' },
  { name: 'Mula',         lord: 'Ketu' },
  { name: 'Purva Ashadha', lord: 'Venus' },
  { name: 'Uttara Ashadha', lord: 'Sun' },
  { name: 'Shravana',     lord: 'Moon' },
  { name: 'Dhanishtha',   lord: 'Mars' },
  { name: 'Shatabhisha',  lord: 'Rahu' },
  { name: 'Purva Bhadrapada', lord: 'Jupiter' },
  { name: 'Uttara Bhadrapada', lord: 'Saturn' },
  { name: 'Revati',       lord: 'Mercury' },
] as const;

const NAKSHATRA_SPAN = 360 / 27;   // 13.333...°
const PADA_SPAN = NAKSHATRA_SPAN / 4;  // 3.333...°

export function getNakshatra(siderealMoonLongitude: number): NakshatraResult {
  const lon = ((siderealMoonLongitude % 360) + 360) % 360;
  const index = Math.floor(lon / NAKSHATRA_SPAN);
  const degreesIn = lon - index * NAKSHATRA_SPAN;
  const pada = Math.floor(degreesIn / PADA_SPAN) + 1;

  const nk = NAKSHATRAS[index];

  return {
    name: nk.name,
    index,
    pada: Math.min(pada, 4),
    lord: nk.lord,
    degreesInNakshatra: degreesIn,
  };
}

export { NAKSHATRAS };

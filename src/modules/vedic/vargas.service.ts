/**
 * Varga (Divisional) Chart Calculator — Parashari system.
 *
 * Supported charts:
 *  D1  Rashi          (natal)
 *  D2  Hora           (wealth)         15° divisions
 *  D3  Drekkana       (siblings)       10° divisions
 *  D4  Chaturthamsha  (property)        7.5° divisions
 *  D7  Saptamsha      (children)        4°17'8" divisions
 *  D9  Navamsa        (spouse/dharma)   3°20' divisions  ← already in navamsa.service
 *  D10 Dashamsha      (career)          3° divisions
 *  D12 Dwadashamsha   (parents)         2.5° divisions
 *  D16 Shodashamsha   (vehicles)        1°52'30" divisions
 *  D20 Vimshamsha     (spirituality)    1.5° divisions
 *  D24 Chaturvimshamsha (education)     1.25° divisions
 *  D27 Saptavimshamsha (strength)       1°6'40" divisions
 *  D30 Trimshamsha    (misfortune)      irregular Parashari divisions
 *  D40 Khavedamsha    (auspiciousness)  0°45' divisions
 *  D45 Akshavedamsha  (general)         0°40' divisions
 *  D60 Shashtiamsha   (karma)           0°30' divisions
 *
 * Each varga result reports: sign name, sign index, planet name, natal longitude.
 * No house placement in vargas — that requires a separate ascendant calculation.
 */

const ZODIAC_SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
] as const;

export interface VargaPosition {
  planet:         string;
  natalLongitude: number;   // sidereal decimal degrees
  natalSign:      string;
  natalSignIndex: number;
  vargaSignIndex: number;
  vargaSign:      string;
  divisionIndex:  number;   // which division (0-based) within the natal sign
}

export interface VargaChart {
  varga:     string;   // e.g. "D9"
  name:      string;   // e.g. "Navamsa"
  planets:   VargaPosition[];
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function normalize360(n: number): number {
  return ((n % 360) + 360) % 360;
}

function signOf(lon: number): number {
  return Math.floor(normalize360(lon) / 30);
}

function degInSign(lon: number): number {
  return normalize360(lon) % 30;
}

function vargaPosition(
  planet: string, lon: number, divisions: number, startFn: (signIdx: number, divIdx: number) => number
): VargaPosition {
  const natalSignIndex = signOf(lon);
  const d              = degInSign(lon);
  const divSize        = 30 / divisions;
  const divisionIndex  = Math.min(Math.floor(d / divSize), divisions - 1);
  const vargaSignIndex = ((startFn(natalSignIndex, divisionIndex) % 12) + 12) % 12;
  return {
    planet,
    natalLongitude:  Number(lon.toFixed(6)),
    natalSign:       ZODIAC_SIGNS[natalSignIndex]  ?? 'Unknown',
    natalSignIndex,
    vargaSignIndex,
    vargaSign:       ZODIAC_SIGNS[vargaSignIndex] ?? 'Unknown',
    divisionIndex,
  };
}

// ── Sign property helpers ──────────────────────────────────────────────────────

/** Odd (1,3,5,7,9,11) vs even (0,2,4,6,8,10) sign — 0=Aries */
function isOddSign(i: number): boolean { return i % 2 !== 0; }

/** Moveable (0,3,6,9 → Aries/Cancer/Libra/Cap), Fixed (1,4,7,10), Dual (2,5,8,11) */
function signQuality(i: number): 'moveable' | 'fixed' | 'dual' {
  const r = i % 3;
  return r === 0 ? 'moveable' : r === 1 ? 'fixed' : 'dual';
}

/** Element: 0,4,8=Fire; 1,5,9=Earth; 2,6,10=Air; 3,7,11=Water */
function signElement(i: number): 'fire' | 'earth' | 'air' | 'water' {
  const r = i % 4;
  return ['fire','earth','air','water'][r] as 'fire'|'earth'|'air'|'water';
}

// ── D30 Trimshamsha — Parashari irregular ──────────────────────────────────────
// Returns sign index for Trimshamsha given planet's sign type and degree-in-sign.

function d30Sign(natalSignIdx: number, d: number): number {
  const odd = isOddSign(natalSignIdx);
  if (odd) {
    if (d < 5)  return 0;   // Mars  → Aries
    if (d < 10) return 10;  // Saturn → Aquarius
    if (d < 18) return 8;   // Jupiter → Sagittarius
    if (d < 25) return 2;   // Mercury → Gemini
    return 6;               // Venus → Libra
  } else {
    if (d < 5)  return 1;   // Venus → Taurus
    if (d < 12) return 5;   // Mercury → Virgo
    if (d < 20) return 11;  // Jupiter → Pisces
    if (d < 25) return 9;   // Saturn → Capricorn
    return 7;               // Mars → Scorpio
  }
}

// ── Navamsa start (reused from navamsa.service logic) ─────────────────────────
function navamsaStart(signIdx: number): number {
  const el = signElement(signIdx);
  return el === 'fire' ? 0 : el === 'earth' ? 9 : el === 'air' ? 6 : 3;
}

// ── Per-varga start sign functions ─────────────────────────────────────────────

const VARGA_CALCS: Record<string, (si: number, di: number, d?: number) => number> = {
  D2:  (si) => {
    // Odd sign: 1st half=Leo(4), 2nd half=Cancer(3)
    // Even sign: 1st half=Cancer(3), 2nd half=Leo(4)
    // D2 divIndex is always 0 or 1 (since 2 divisions)
    // We'll call this from the special handler below
    return si; // unused — handled separately
  },
  D3:  (si, di) => (si + [0,4,8][di]!) % 12,
  D4:  (si, di) => (si + di * 3)       % 12,
  D7:  (si, di) => ((isOddSign(si) ? si : si + 6) + di) % 12,
  D9:  (si, di) => (navamsaStart(si) + di) % 12,
  D10: (si, di) => ((isOddSign(si) ? si : si + 8) + di) % 12,
  D12: (si, di) => (si + di)           % 12,
  D16: (si, di) => {
    const q = signQuality(si);
    const s = q === 'moveable' ? 0 : q === 'fixed' ? 4 : 8;
    return (s + di) % 12;
  },
  D20: (si, di) => {
    const q = signQuality(si);
    const s = q === 'moveable' ? 0 : q === 'fixed' ? 8 : 4;
    return (s + di) % 12;
  },
  D24: (si, di) => ((isOddSign(si) ? 4 : 3) + di) % 12,
  D27: (si, di) => {
    const el = signElement(si);
    const s  = el === 'fire' ? 0 : el === 'earth' ? 3 : el === 'air' ? 6 : 9;
    return (s + di) % 12;
  },
  D40: (si, di) => ((isOddSign(si) ? 0 : 6) + di) % 12,
  D45: (si, di) => {
    const q = signQuality(si);
    const s = q === 'moveable' ? 0 : q === 'fixed' ? 4 : 8;
    return (s + di) % 12;
  },
  D60: (si, di) => ((isOddSign(si) ? 0 : 6) + di) % 12,
};

// ── Public function ────────────────────────────────────────────────────────────

export type VargaCode = 'D1'|'D2'|'D3'|'D4'|'D7'|'D9'|'D10'|'D12'|'D16'|'D20'|'D24'|'D27'|'D30'|'D40'|'D45'|'D60';

const VARGA_META: Record<VargaCode, { name: string; divisions: number }> = {
  D1:  { name: 'Rashi',            divisions: 1  },
  D2:  { name: 'Hora',             divisions: 2  },
  D3:  { name: 'Drekkana',         divisions: 3  },
  D4:  { name: 'Chaturthamsha',    divisions: 4  },
  D7:  { name: 'Saptamsha',        divisions: 7  },
  D9:  { name: 'Navamsa',          divisions: 9  },
  D10: { name: 'Dashamsha',        divisions: 10 },
  D12: { name: 'Dwadashamsha',     divisions: 12 },
  D16: { name: 'Shodashamsha',     divisions: 16 },
  D20: { name: 'Vimshamsha',       divisions: 20 },
  D24: { name: 'Chaturvimshamsha', divisions: 24 },
  D27: { name: 'Saptavimshamsha',  divisions: 27 },
  D30: { name: 'Trimshamsha',      divisions: 30 },
  D40: { name: 'Khavedamsha',      divisions: 40 },
  D45: { name: 'Akshavedamsha',    divisions: 45 },
  D60: { name: 'Shashtiamsha',     divisions: 60 },
};

/**
 * Compute varga charts for a list of planets.
 * @param planets  Array of { planet: string; longitude: number } (sidereal longitudes)
 * @param vargas   Which vargas to compute (default: D1 through D12)
 */
export function calcVargas(
  planets: Array<{ planet: string; longitude: number }>,
  vargas: VargaCode[] = ['D1','D2','D3','D4','D7','D9','D10','D12']
): VargaChart[] {
  return vargas.map((code) => {
    const meta = VARGA_META[code];
    if (!meta) throw new Error(`Unknown varga: ${code}`);

    const positions: VargaPosition[] = planets.map(({ planet, longitude }) => {
      const si = signOf(longitude);
      const d  = degInSign(longitude);

      if (code === 'D1') {
        return {
          planet,
          natalLongitude:  Number(longitude.toFixed(6)),
          natalSign:       ZODIAC_SIGNS[si] ?? 'Unknown',
          natalSignIndex:  si,
          vargaSignIndex:  si,
          vargaSign:       ZODIAC_SIGNS[si] ?? 'Unknown',
          divisionIndex:   0,
        };
      }

      if (code === 'D2') {
        // Hora: Cancer(3) or Leo(4) only
        const odd  = isOddSign(si);
        const first = d < 15;
        const vsi   = odd
          ? (first ? 4 : 3)   // Odd sign: Leo then Cancer
          : (first ? 3 : 4);  // Even sign: Cancer then Leo
        return {
          planet,
          natalLongitude: Number(longitude.toFixed(6)),
          natalSign:      ZODIAC_SIGNS[si]  ?? 'Unknown',
          natalSignIndex: si,
          vargaSignIndex: vsi,
          vargaSign:      ZODIAC_SIGNS[vsi] ?? 'Unknown',
          divisionIndex:  first ? 0 : 1,
        };
      }

      if (code === 'D30') {
        const vsi = d30Sign(si, d);
        const divSize = 30 / meta.divisions;
        return {
          planet,
          natalLongitude: Number(longitude.toFixed(6)),
          natalSign:      ZODIAC_SIGNS[si]  ?? 'Unknown',
          natalSignIndex: si,
          vargaSignIndex: vsi,
          vargaSign:      ZODIAC_SIGNS[vsi] ?? 'Unknown',
          divisionIndex:  Math.min(Math.floor(d / divSize), meta.divisions - 1),
        };
      }

      // General case
      const startFn = VARGA_CALCS[code] ?? ((s: number, i: number) => (s + i) % 12);
      return vargaPosition(planet, longitude, meta.divisions, startFn);
    });

    return { varga: code, name: meta.name, planets: positions };
  });
}

/**
 * Western astrology aspects.
 *
 * Applying / Separating:
 *   Forward-projection method: advance both planets by DT=0.01 days (≈14 min).
 *   If the future orb is smaller than the current orb the aspect is APPLYING
 *   (the angle is tightening toward exact). This correctly handles all combinations:
 *   direct+direct, retrograde+direct, retrograde+retrograde.
 */

export interface AspectDefinition {
  name:       string;
  angle:      number;  // exact aspect angle in degrees
  defaultOrb: number;  // maximum allowed orb in degrees
}

export interface Aspect {
  planet1:    string;
  planet2:    string;
  aspectName: string;
  angle:      number;  // exact aspect angle
  orb:        number;  // degrees from exact (always >= 0)
  isApplying: boolean; // true = aspect tightening; false = separating
}

export const ASPECT_DEFINITIONS: AspectDefinition[] = [
  { name: 'Conjunction',    angle: 0,   defaultOrb: 8 },
  { name: 'Sextile',        angle: 60,  defaultOrb: 6 },
  { name: 'Square',         angle: 90,  defaultOrb: 8 },
  { name: 'Trine',          angle: 120, defaultOrb: 8 },
  { name: 'Opposition',     angle: 180, defaultOrb: 8 },
  { name: 'Quincunx',       angle: 150, defaultOrb: 3 },
  { name: 'Semi-sextile',   angle: 30,  defaultOrb: 2 },
  { name: 'Semi-square',    angle: 45,  defaultOrb: 2 },
  { name: 'Sesquiquadrate', angle: 135, defaultOrb: 2 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalize360(n: number): number {
  return ((n % 360) + 360) % 360;
}

/** Minimum arc between two ecliptic longitudes, always 0–180°. */
function angleDiff(a: number, b: number): number {
  let diff = Math.abs(normalize360(a) - normalize360(b)) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

export interface PlanetLon {
  planet:    string;
  longitude: number;  // 0–360°
  speed:     number;  // °/day (negative = retrograde)
}

// ── Main calculator ───────────────────────────────────────────────────────────

/**
 * Detect aspects between all unique pairs in `planets`.
 *
 * @param planets  Array of planet positions (longitude + speed required).
 * @param orbs     Optional per-aspect orb overrides (key = aspect name).
 */
export function calcAspects(
  planets: PlanetLon[],
  orbs?: Partial<Record<string, number>>
): Aspect[] {
  const aspects: Aspect[] = [];
  const DT = 0.01;  // 0.01 days ≈ 14.4 minutes — forward step for applying test

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const p1 = planets[i];
      const p2 = planets[j];

      const currentSep = angleDiff(p1.longitude, p2.longitude);

      for (const def of ASPECT_DEFINITIONS) {
        const allowedOrb = orbs?.[def.name] ?? def.defaultOrb;
        const orb = Math.abs(currentSep - def.angle);

        if (orb <= allowedOrb) {
          // Forward-project to determine applying vs separating.
          // Works for any combination of direct/retrograde planets.
          const p1Future = normalize360(p1.longitude + p1.speed * DT);
          const p2Future = normalize360(p2.longitude + p2.speed * DT);
          const futureOrb = Math.abs(angleDiff(p1Future, p2Future) - def.angle);
          const isApplying = futureOrb < orb;

          aspects.push({
            planet1:    p1.planet,
            planet2:    p2.planet,
            aspectName: def.name,
            angle:      def.angle,
            orb:        Math.round(orb * 1000) / 1000,
            isApplying,
          });
          break;  // One aspect per pair (closest match wins)
        }
      }
    }
  }

  return aspects.sort((a, b) => a.orb - b.orb);
}

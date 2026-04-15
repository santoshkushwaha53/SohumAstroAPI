/**
 * Navamsa (D9) chart calculation.
 * Each sign (30°) is divided into 9 parts (3°20' each).
 * The navamsa sign for each planet is derived from its position in that division.
 */

const ZODIAC_SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
] as const;

export interface NavamsaPosition {
  planet: string;
  natalSign: string;
  natalLongitude: number;
  navamsaSign: string;
  navamsaSignIndex: number;
}

/**
 * Get Navamsa sign index from sidereal longitude.
 *
 * Each sign is split into 9 navamsa divisions (3°20' each).
 * The first division of a Fire sign starts at Aries.
 * The first division of an Earth sign starts at Capricorn.
 * The first division of an Air sign starts at Libra.
 * The first division of a Water sign starts at Cancer.
 */
const NAVAMSA_START: Record<number, number> = {
  0: 0,   // Aries    → starts at Aries (0)
  1: 9,   // Taurus   → starts at Capricorn (9)
  2: 6,   // Gemini   → starts at Libra (6)
  3: 3,   // Cancer   → starts at Cancer (3)
  4: 0,   // Leo      → starts at Aries (0)
  5: 9,   // Virgo    → starts at Capricorn (9)
  6: 6,   // Libra    → starts at Libra (6)
  7: 3,   // Scorpio  → starts at Cancer (3)
  8: 0,   // Sag      → starts at Aries (0)
  9: 9,   // Cap      → starts at Capricorn (9)
  10: 6,  // Aquarius → starts at Libra (6)
  11: 3,  // Pisces   → starts at Cancer (3)
};

export function getNavamsaSign(siderealLongitude: number): { sign: string; signIndex: number } {
  const lon = ((siderealLongitude % 360) + 360) % 360;
  const signIndex = Math.floor(lon / 30);
  const degInSign = lon % 30;
  const navamsaIndex = Math.floor(degInSign / (30 / 9));  // 0–8
  const start = NAVAMSA_START[signIndex] ?? 0;
  const navamsaSignIndex = (start + navamsaIndex) % 12;
  return { sign: ZODIAC_SIGNS[navamsaSignIndex] ?? 'Unknown', signIndex: navamsaSignIndex };
}

export function calcNavamsa(
  planets: Array<{ planet: string; longitude: number; sign: string }>
): NavamsaPosition[] {
  return planets.map((p) => {
    const { sign, signIndex } = getNavamsaSign(p.longitude);
    return {
      planet: p.planet,
      natalSign: p.sign,
      natalLongitude: p.longitude,
      navamsaSign: sign,
      navamsaSignIndex: signIndex,
    };
  });
}

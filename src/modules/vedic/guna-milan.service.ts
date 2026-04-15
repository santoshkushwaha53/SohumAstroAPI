/**
 * Guna Milan (Ashtakuta / 8-kuta) compatibility scoring.
 * Total: 36 points. Traditionally ≥18 is acceptable, ≥24 is good.
 *
 * Reference: Parashari / BPHS, Muhurta Chintamani.
 * All rules are deterministic and source-traceable.
 */

import { getNakshatra } from './nakshatra.service';

// ── Lookup tables ──────────────────────────────────────────────────────────────

/** Varna (caste) for each Moon sign index 0-11 */
const VARNA: Record<number, string> = {
  0:'Kshatriya', 1:'Vaishya',   2:'Shudra',    3:'Brahmin',
  4:'Kshatriya', 5:'Vaishya',   6:'Shudra',    7:'Brahmin',
  8:'Kshatriya', 9:'Vaishya',   10:'Shudra',   11:'Brahmin',
};
const VARNA_RANK: Record<string,number> = { Brahmin:4, Kshatriya:3, Vaishya:2, Shudra:1 };

/** Vashya (who controls whom) for each sign (0-indexed) */
const VASHYA_GROUP: Record<number, number> = {
  0:1, 1:3, 2:5, 3:1, 4:1, 5:3, 6:1, 7:5, 8:5, 9:3, 10:5, 11:3,
};

/** Tara: nakshatra friendly cycle (birth star count mod 9) */
const TARA_GOOD = new Set([1, 3, 5, 7]);  // 1-indexed

/** Yoni (animal symbol) for each nakshatra 0-26 */
const YONI: string[] = [
  'Horse','Elephant','Sheep','Serpent','Dog','Cat','Rat','Cow','Buffalo',
  'Tiger','Hare','Buffalo','Tiger','Hare','Buffalo','Tiger','Deer','Dog',
  'Monkey','Mongoose','Lion','Monkey','Lion','Horse','Lion','Cow','Elephant',
];
const YONI_FRIENDS: Record<string, string[]> = {
  Horse:    ['Horse'],
  Elephant: ['Elephant'],
  Sheep:    ['Sheep'],
  Serpent:  ['Mongoose'],
  Dog:      ['Dog','Hare'],
  Cat:      ['Cat','Rat'],
  Rat:      ['Cat','Rat'],
  Cow:      ['Cow','Buffalo'],
  Buffalo:  ['Cow','Buffalo'],
  Tiger:    ['Tiger'],
  Hare:     ['Dog','Hare'],
  Deer:     ['Deer'],
  Monkey:   ['Monkey'],
  Mongoose: ['Serpent'],
  Lion:     ['Lion'],
};
const YONI_ENEMIES: Record<string, string> = {
  Horse:'Buffalo', Buffalo:'Horse',
  Elephant:'Lion',  Lion:'Elephant',
  Sheep:'Monkey',   Monkey:'Sheep',
  Serpent:'Mongoose', Mongoose:'Serpent',
  Dog:'Hare',       Hare:'Dog',
  Cat:'Rat',        Rat:'Cat',
  Cow:'Tiger',      Tiger:'Cow',
  Deer:'Dog',
};

/** Rashi lord for each sign */
const RASHI_LORD: string[] = [
  'Mars','Venus','Mercury','Moon','Sun','Mercury','Venus','Mars','Jupiter','Saturn','Saturn','Jupiter',
];

/** Planet friendship table (1=friend, 0=neutral, -1=enemy) */
const PLANET_FRIENDSHIP: Record<string, Record<string, number>> = {
  Sun:     { Sun:0, Moon:1,  Mars:1,  Mercury:-1, Jupiter:1,  Venus:-1, Saturn:-1 },
  Moon:    { Sun:1, Moon:0,  Mars:0,  Mercury:1,  Jupiter:0,  Venus:0,  Saturn:0  },
  Mars:    { Sun:1, Moon:1,  Mars:0,  Mercury:-1, Jupiter:1,  Venus:0,  Saturn:0  },
  Mercury: { Sun:0, Moon:0,  Mars:-1, Mercury:0,  Jupiter:0,  Venus:1,  Saturn:1  },
  Jupiter: { Sun:1, Moon:1,  Mars:1,  Mercury:-1, Jupiter:0,  Venus:-1, Saturn:0  },
  Venus:   { Sun:-1, Moon:0, Mars:0,  Mercury:1,  Jupiter:-1, Venus:0,  Saturn:1  },
  Saturn:  { Sun:-1, Moon:-1, Mars:-1, Mercury:1, Jupiter:-1, Venus:1,  Saturn:0  },
};

/** Gana for each nakshatra (0=Deva, 1=Manushya, 2=Rakshasa) */
const GANA: number[] = [
  0,2,0,0,2,2,0,0,2,2,2,0,0,1,0,1,0,2,2,1,0,0,1,2,1,0,0,
];

/** Nadi for each nakshatra (0=Aadi, 1=Madhya, 2=Antya) */
const NADI: number[] = [
  0,1,2,0,1,2,0,1,2,0,1,2,0,1,2,0,1,2,0,1,2,0,1,2,0,1,2,
];
const NADI_NAMES = ['Aadi','Madhya','Antya'];

// ── Kuta scorers ───────────────────────────────────────────────────────────────

function scoreVarna(boySign: number, girlSign: number): number {
  const bRank = VARNA_RANK[VARNA[boySign]!] ?? 1;
  const gRank = VARNA_RANK[VARNA[girlSign]!] ?? 1;
  return bRank >= gRank ? 1 : 0;
}

function scoreVashya(boySign: number, girlSign: number): number {
  const bg = VASHYA_GROUP[boySign];
  const gg = VASHYA_GROUP[girlSign];
  if (bg === gg) return 2;
  if (bg === 3 && gg === 1) return 1;
  return 0;
}

function scoreTara(boyNk: number, girlNk: number): number {
  const fromGirl = ((boyNk - girlNk + 27) % 27) + 1;  // 1-27
  const fromBoy  = ((girlNk - boyNk + 27) % 27) + 1;
  const mod1 = ((fromGirl - 1) % 9) + 1;
  const mod2 = ((fromBoy  - 1) % 9) + 1;
  const g1   = TARA_GOOD.has(mod1);
  const g2   = TARA_GOOD.has(mod2);
  if (g1 && g2)  return 3;
  if (g1 || g2)  return 1.5;
  return 0;
}

function scoreYoni(boyNk: number, girlNk: number): number {
  const by = YONI[boyNk]  ?? 'Horse';
  const gy = YONI[girlNk] ?? 'Horse';
  if (by === gy) return 4;
  if (YONI_FRIENDS[by]?.includes(gy)) return 3;
  if (YONI_ENEMIES[by] === gy || YONI_ENEMIES[gy] === by) return 0;
  return 2;  // neutral
}

function scoreGrahaMaitri(boySign: number, girlSign: number): number {
  const bl = RASHI_LORD[boySign]!;
  const gl = RASHI_LORD[girlSign]!;
  const f1 = PLANET_FRIENDSHIP[bl]?.[gl] ?? 0;
  const f2 = PLANET_FRIENDSHIP[gl]?.[bl] ?? 0;
  const sum = f1 + f2;
  if (sum === 2)  return 5;   // mutual friends
  if (sum === 1)  return 4;   // one friend, one neutral
  if (sum === 0)  return 3;   // both neutral
  if (sum === -1) return 2;   // one neutral, one enemy
  return 0;                   // mutual enemies or worse
}

function scoreGana(boyNk: number, girlNk: number): number {
  const b = GANA[boyNk] ?? 0;
  const g = GANA[girlNk] ?? 0;
  if (b === g) return 6;
  if (b === 0 && g === 1) return 5;  // Deva boy, Manushya girl
  if (b === 1 && g === 0) return 5;  // Manushya boy, Deva girl
  if (b === 1 && g === 2) return 0;  // Manushya boy, Rakshasa girl — incompatible
  if (b === 0 && g === 2) return 1;  // Deva-Rakshasa
  if (b === 2 && g === 0) return 0;  // Rakshasa boy, Deva girl — worst
  return 0;
}

function scoreBhakut(boySign: number, girlSign: number): number {
  // Count boy's sign from girl's sign (1-indexed)
  const diff1 = ((boySign - girlSign + 12) % 12) + 1;
  const diff2 = ((girlSign - boySign + 12) % 12) + 1;
  // Bad combinations: 2/12, 5/9, 6/8
  const bad = (a: number, b: number) =>
    (a===2&&b===12) || (a===12&&b===2) ||
    (a===5&&b===9)  || (a===9&&b===5)  ||
    (a===6&&b===8)  || (a===8&&b===6);
  return bad(diff1, diff2) ? 0 : 7;
}

function scoreNadi(boyNk: number, girlNk: number): number {
  const b = NADI[boyNk] ?? 0;
  const g = NADI[girlNk] ?? 0;
  return b === g ? 0 : 8;  // Same nadi = 0 (worst for progeny)
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface KutaScore {
  kuta:       string;
  maxPoints:  number;
  scored:     number;
  percentage: number;
  notes:      string;
}

export interface GunaMilanResult {
  person1: { moonSign: string; moonSignIndex: number; nakshatra: string; nakshatraIndex: number; nadi: string; gana: string };
  person2: { moonSign: string; moonSignIndex: number; nakshatra: string; nakshatraIndex: number; nadi: string; gana: string };
  kutas:   KutaScore[];
  totalScored:    number;
  totalPossible:  number;
  percentage:     number;
  verdict:        string;
  manglikStatus?: { person1: boolean; person2: boolean };
}

const ZODIAC_SIGNS = [
  'Aries','Taurus','Gemini','Cancer','Leo','Virgo',
  'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces',
];
const GANA_NAMES = ['Deva','Manushya','Rakshasa'];

function verdict(score: number): string {
  if (score >= 32) return 'Excellent';
  if (score >= 28) return 'Very Good';
  if (score >= 24) return 'Good';
  if (score >= 18) return 'Average (acceptable)';
  if (score >= 12) return 'Below Average';
  return 'Not Recommended';
}

/**
 * Compute full Ashtakuta Guna Milan.
 * @param person1MoonLon  Sidereal Moon longitude of person 1 (prospective groom by convention)
 * @param person2MoonLon  Sidereal Moon longitude of person 2 (prospective bride by convention)
 */
export function calcGunaMilan(person1MoonLon: number, person2MoonLon: number): GunaMilanResult {
  const nk1 = getNakshatra(person1MoonLon);
  const nk2 = getNakshatra(person2MoonLon);

  const sign1 = Math.floor(((person1MoonLon % 360) + 360) % 360 / 30);
  const sign2 = Math.floor(((person2MoonLon % 360) + 360) % 360 / 30);

  const s = {
    varna:       scoreVarna(sign1, sign2),
    vashya:      scoreVashya(sign1, sign2),
    tara:        scoreTara(nk1.index, nk2.index),
    yoni:        scoreYoni(nk1.index, nk2.index),
    grahaMaitri: scoreGrahaMaitri(sign1, sign2),
    gana:        scoreGana(nk1.index, nk2.index),
    bhakut:      scoreBhakut(sign1, sign2),
    nadi:        scoreNadi(nk1.index, nk2.index),
  };

  const maxPts = [1,2,3,4,5,6,7,8];
  const names  = ['Varna','Vashya','Tara','Yoni','Graha Maitri','Gana','Bhakut','Nadi'];
  const scores = [s.varna, s.vashya, s.tara, s.yoni, s.grahaMaitri, s.gana, s.bhakut, s.nadi];

  const total = scores.reduce((a, b) => a + b, 0);

  const kutas: KutaScore[] = names.map((name, i) => ({
    kuta:       name,
    maxPoints:  maxPts[i]!,
    scored:     scores[i]!,
    percentage: Math.round((scores[i]! / maxPts[i]!) * 100),
    notes:      kutaNotes(name, scores[i]!, sign1, sign2, nk1.index, nk2.index),
  }));

  return {
    person1: {
      moonSign:       ZODIAC_SIGNS[sign1] ?? 'Unknown',
      moonSignIndex:  sign1,
      nakshatra:      nk1.name,
      nakshatraIndex: nk1.index,
      nadi:           NADI_NAMES[NADI[nk1.index] ?? 0] ?? 'Aadi',
      gana:           GANA_NAMES[GANA[nk1.index] ?? 0] ?? 'Deva',
    },
    person2: {
      moonSign:       ZODIAC_SIGNS[sign2] ?? 'Unknown',
      moonSignIndex:  sign2,
      nakshatra:      nk2.name,
      nakshatraIndex: nk2.index,
      nadi:           NADI_NAMES[NADI[nk2.index] ?? 0] ?? 'Aadi',
      gana:           GANA_NAMES[GANA[nk2.index] ?? 0] ?? 'Deva',
    },
    kutas,
    totalScored:   total,
    totalPossible: 36,
    percentage:    Math.round((total / 36) * 100),
    verdict:       verdict(total),
  };
}

function kutaNotes(name: string, score: number, s1: number, s2: number, nk1: number, nk2: number): string {
  switch (name) {
    case 'Varna':       return `${VARNA[s1] ?? 'Unknown'} (P1) vs ${VARNA[s2] ?? 'Unknown'} (P2)`;
    case 'Tara':        return score === 0 ? 'Mutually unfavourable lunar stations' : score === 3 ? 'Mutually favourable' : 'Partially favourable';
    case 'Yoni':        return `${YONI[nk1] ?? 'Unknown'} (P1) vs ${YONI[nk2] ?? 'Unknown'} (P2)`;
    case 'Graha Maitri':return `${RASHI_LORD[s1] ?? '?'} (P1 lord) vs ${RASHI_LORD[s2] ?? '?'} (P2 lord)`;
    case 'Gana':        return `${GANA_NAMES[GANA[nk1]??0] ?? '?'} (P1) vs ${GANA_NAMES[GANA[nk2]??0] ?? '?'} (P2)`;
    case 'Nadi':        return score === 0 ? `Both ${NADI_NAMES[NADI[nk1]??0] ?? '?'} nadi — health/progeny concern` : `Different nadis (${NADI_NAMES[NADI[nk1]??0] ?? '?'} / ${NADI_NAMES[NADI[nk2]??0] ?? '?'})`;
    default:            return '';
  }
}

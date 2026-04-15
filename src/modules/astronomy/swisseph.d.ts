// Type declarations for `swisseph` npm package v0.5.x
// Real API verified from source: functions use swe_ prefix
declare module 'swisseph' {
  // ── Planet constants ──────────────────────────────────────────────────────
  const SE_SUN: number;
  const SE_MOON: number;
  const SE_MERCURY: number;
  const SE_VENUS: number;
  const SE_MARS: number;
  const SE_JUPITER: number;
  const SE_SATURN: number;
  const SE_URANUS: number;
  const SE_NEPTUNE: number;
  const SE_PLUTO: number;
  const SE_MEAN_NODE: number;
  const SE_TRUE_NODE: number;
  const SE_MEAN_APOG: number;
  const SE_CHIRON: number;
  const SE_PHOLUS: number;
  const SE_CERES: number;

  // ── Calendar flags ────────────────────────────────────────────────────────
  const SE_GREG_CAL: number;
  const SE_JUL_CAL: number;

  // ── Calculation flags ─────────────────────────────────────────────────────
  const SEFLG_JPLEPH: number;
  const SEFLG_SWIEPH: number;
  const SEFLG_MOSEPH: number;
  const SEFLG_SPEED: number;
  const SEFLG_SIDEREAL: number;
  const SEFLG_TOPOCTR: number;

  // ── Sidereal modes ────────────────────────────────────────────────────────
  const SE_SIDM_FAGAN_BRADLEY: number;
  const SE_SIDM_LAHIRI: number;
  const SE_SIDM_DELUCE: number;
  const SE_SIDM_RAMAN: number;
  const SE_SIDM_KRISHNAMURTI: number;
  const SE_SIDM_TRUE_CITRA: number;
  const SE_SIDM_USER: number;

  // ── Return types ──────────────────────────────────────────────────────────
  interface PlanetResult {
    longitude: number;
    latitude: number;
    distance: number;
    longitudeSpeed: number;
    latitudeSpeed: number;
    distanceSpeed: number;
    rflag?: number;
    error?: string;
  }

  interface HouseResult {
    house: number[];        // 1-indexed: house[1]..house[12]
    ascendant: number;
    mc: number;
    armc: number;
    vertex: number;
    equatorialAscendant?: number;
    coAscendantKoch?: number;
    coAscendantMunkasey?: number;
    polarAscendant?: number;
    error?: string;
  }

  // ── Functions (all prefixed with swe_) ────────────────────────────────────

  /** Set path to ephemeris data files (synchronous) */
  function swe_set_ephe_path(path: string): void;

  /** Close ephemeris (synchronous) */
  function swe_close(): void;

  /**
   * Calculate Julian Day number (synchronous).
   * gregflag: SE_GREG_CAL = 1
   */
  function swe_julday(
    year: number,
    month: number,
    day: number,
    hour: number,
    gregflag: number
  ): number;

  /**
   * Calculate planetary position (async callback).
   * callback receives PlanetResult.
   */
  function swe_calc_ut(
    tjd_ut: number,
    ipl: number,
    iflag: number,
    callback: (result: PlanetResult) => void
  ): void;

  /**
   * Calculate house cusps (async callback).
   * Signature: (jd, lat, lon, hsys, callback)  — NO flags parameter.
   * hsys: 'P'=Placidus, 'W'=Whole Sign, 'E'=Equal, 'K'=Koch
   */
  function swe_houses(
    tjd_ut: number,
    geolat: number,
    geolon: number,
    hsys: string,
    callback: (result: HouseResult) => void
  ): void;

  /** Set sidereal mode (synchronous) */
  function swe_set_sid_mode(sid_mode: number, t0: number, ayan_t0: number): void;

  /** Get ayanamsa for given Julian Day (synchronous) */
  function swe_get_ayanamsa_ut(tjd_ut: number): number;

  /** Get planet name by ID (synchronous) — returns {name: string} in v0.5.x */
  function swe_get_planet_name(ipl: number): { name: string };

  /** Reverse Julian Day to calendar date (synchronous) */
  function swe_revjul(
    julday: number,
    gregflag: number
  ): { year: number; month: number; day: number; hour: number };
}

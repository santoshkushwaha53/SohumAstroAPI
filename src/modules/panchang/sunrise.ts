/**
 * Sunrise / Sunset / Solar Noon calculator.
 *
 * Algorithm: NOAA Solar Calculator (Jean Meeus "Astronomical Algorithms", Ch. 25).
 * Accuracy: within 1–2 minutes for latitudes −60° to +60°.
 * Returns times as fractional UTC hours (0–24).
 *
 * Solar zenith angle at horizon: 90.833° (accounts for atmospheric refraction 0.833°
 * and standard solar radius 0.266°, yielding 90° + 0.5667° ≈ 90.833°).
 */

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

// ── Low-level solar position helpers ─────────────────────────────────────────

function geomMeanLongSun(T: number): number {
  return (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
}

function geomMeanAnomalySun(T: number): number {
  return 357.52911 + T * (35999.05029 - T * 0.0001537);
}

function eccentricityOrbit(T: number): number {
  return 0.016708634 - T * (0.000042037 + T * 0.0000001267);
}

function equationOfCenter(T: number): number {
  const Mrad = geomMeanAnomalySun(T) * D2R;
  return (
    Math.sin(Mrad)       * (1.914602 - T * (0.004817 + T * 0.000014)) +
    Math.sin(2 * Mrad)   * (0.019993 - T * 0.000101) +
    Math.sin(3 * Mrad)   *  0.000289
  );
}

function sunTrueLong(T: number): number {
  return geomMeanLongSun(T) + equationOfCenter(T);
}

function sunApparentLong(T: number): number {
  const omega = (125.04 - 1934.136 * T) * D2R;
  return sunTrueLong(T) - 0.00569 - 0.00478 * Math.sin(omega);
}

function meanObliquityEcliptic(T: number): number {
  return 23.0 + (26.0 + (21.448 - T * (46.8150 + T * (0.00059 - T * 0.001813))) / 60.0) / 60.0;
}

function obliquityCorrected(T: number): number {
  const omega = (125.04 - 1934.136 * T) * D2R;
  return meanObliquityEcliptic(T) + 0.00256 * Math.cos(omega);
}

function sunDeclination(T: number): number {
  const lambda = sunApparentLong(T) * D2R;
  const eps    = obliquityCorrected(T) * D2R;
  return Math.asin(Math.sin(eps) * Math.sin(lambda)) * R2D;
}

function equationOfTime(T: number): number {
  const eps  = obliquityCorrected(T) * D2R;
  const L0   = geomMeanLongSun(T) * D2R;
  const e    = eccentricityOrbit(T);
  const M    = geomMeanAnomalySun(T) * D2R;
  const y    = Math.tan(eps / 2) ** 2;
  const eqt  = y * Math.sin(2 * L0)
    - 2 * e * Math.sin(M)
    + 4 * e * y * Math.sin(M) * Math.cos(2 * L0)
    - 0.5 * y * y * Math.sin(4 * L0)
    - 1.25 * e * e * Math.sin(2 * M);
  return eqt * R2D * 4;  // convert to minutes
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SunTimes {
  /** Fractional UTC hours (0–24). null = no sunrise/sunset (polar). */
  sunriseUTC:  number | null;
  sunsetUTC:   number | null;
  solarNoonUTC: number;
  /** Duration of day in decimal hours */
  dayLength:   number | null;
}

/**
 * Compute sunrise, sunset, and solar noon for a given date and location.
 *
 * @param jd      Julian Day for the requested date (at midnight UTC, i.e. fractional .5 = noon)
 *                Tip: pass jd computed from swe_julday for the date at hour=0.
 * @param lat     Observer latitude in decimal degrees (N positive)
 * @param lon     Observer longitude in decimal degrees (E positive)
 */
export function calcSunTimes(jd: number, lat: number, lon: number): SunTimes {
  // Julian centuries from J2000.0
  const T = (jd - 2451545.0) / 36525.0;

  const eqTime = equationOfTime(T);           // minutes
  const decl   = sunDeclination(T);            // degrees

  // Solar noon in minutes from midnight UTC
  const solarNoonMinutes = 720 - 4 * lon - eqTime;   // 720 = noon in minutes
  const solarNoonUTC = solarNoonMinutes / 60;

  // Hour angle at sunrise (cosine formula)
  const latRad  = lat * D2R;
  const declRad = decl * D2R;
  const cosHA   = (Math.cos(90.833 * D2R) - Math.sin(latRad) * Math.sin(declRad))
                / (Math.cos(latRad) * Math.cos(declRad));

  if (cosHA < -1) {
    // Sun never sets (polar summer)
    return { sunriseUTC: null, sunsetUTC: null, solarNoonUTC, dayLength: null };
  }
  if (cosHA > 1) {
    // Sun never rises (polar winter)
    return { sunriseUTC: null, sunsetUTC: null, solarNoonUTC, dayLength: null };
  }

  const HA = Math.acos(cosHA) * R2D;  // degrees, always positive

  // Sunrise = solar noon − HA (in degrees → minutes at 4 min/degree)
  const sunriseMinutes = solarNoonMinutes - 4 * HA;
  const sunsetMinutes  = solarNoonMinutes + 4 * HA;

  const sunriseUTC  = sunriseMinutes / 60;
  const sunsetUTC   = sunsetMinutes  / 60;
  const dayLength   = (sunsetMinutes - sunriseMinutes) / 60;

  return { sunriseUTC, sunsetUTC, solarNoonUTC, dayLength };
}

/** Convert fractional UTC hours to "HH:MM:SS" string (wraps at 24h). */
export function hoursToTimeStr(h: number | null): string | null {
  if (h === null) return null;
  const total = Math.round(((h % 24) + 24) % 24 * 3600);
  const hh    = Math.floor(total / 3600);
  const mm    = Math.floor((total % 3600) / 60);
  const ss    = total % 60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

/** Convert fractional UTC hours to local time string given timezone offset hours. */
export function toLocalTimeStr(utcHours: number | null, tzOffsetHours: number): string | null {
  if (utcHours === null) return null;
  return hoursToTimeStr(utcHours + tzOffsetHours);
}

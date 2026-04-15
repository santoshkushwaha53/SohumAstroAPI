/** Geographic coordinate input */
export interface GeoLocation {
  latitude: number;   // decimal degrees, N positive
  longitude: number;  // decimal degrees, E positive
}

/** Parsed birth moment */
export interface BirthInput {
  date: string;       // YYYY-MM-DD
  time: string;       // HH:mm:ss
  timezone: string;   // e.g. "+05:30" or "UTC"
  latitude: number;
  longitude: number;
}

/** UTC datetime derived from BirthInput */
export interface UtcMoment {
  year: number;
  month: number;
  day: number;
  hour: number;       // decimal hour in UTC
  julianDay: number;
}

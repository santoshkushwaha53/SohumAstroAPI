# SohumAstroAPI — Complete API Reference

Base URL: `http://localhost:3000/api/v1`  
Auth header: `x-api-key: <your-key>` (all routes except `/health` and `/astro/meta`)

---

## Endpoint Index

| # | Method | Path | Auth | Description |
|---|--------|------|------|-------------|
| 1 | GET | `/health` | No | Service health check |
| 2 | GET | `/astro/meta` | No | List planets, house systems, ayanamsas |
| 3 | POST | `/astro/julian-day` | Yes | Convert date → Julian Day Number |
| 4 | POST | `/astro/planet-positions` | Yes | Planetary positions (tropical or sidereal) |
| 5 | POST | `/astro/houses` | Yes | House cusps for a date + location |
| 6 | POST | `/vedic/ayanamsa` | Yes | Ayanamsa (precession) value for a date |
| 7 | POST | `/vedic/birth-chart` | Yes | Full Vedic sidereal birth chart |
| 8 | POST | `/vedic/nakshatra` | Yes | Nakshatra from longitude or birth chart |
| 9 | POST | `/vedic/dasha/vimshottari` | Yes | Vimshottari Mahadasha periods |
| 10 | POST | `/vedic/navamsa` | Yes | D9 Navamsa divisional chart |
| 11 | POST | `/western/birth-chart` | Yes | Western tropical birth chart |
| 12 | POST | `/western/aspects` | Yes | Aspects between planets |
| 13 | POST | `/western/synastry` | Yes | Cross-aspects between two charts |
| 14 | POST | `/transits` | Yes | Transit aspects to natal chart |
| 15 | POST | `/reports/generate` | Yes | Queue async report (202) |
| 16 | GET | `/reports/:jobId` | Yes | Poll report job status |

---

## Common Request Fields

### BirthInput object (reused across all chart endpoints)

```json
{
  "date":      "YYYY-MM-DD",     // required
  "time":      "HH:mm:ss",       // default 12:00:00
  "timezone":  "±HH:MM|UTC|Z",   // default +00:00
  "latitude":  25.4358,          // decimal degrees, N positive
  "longitude": 81.8463           // decimal degrees, E positive
}
```

### Standard success envelope

```json
{
  "success": true,
  "data": { ... }
}
```

### Standard error envelope

```json
{
  "success": false,
  "error": "Human readable message",
  "details": { "fieldErrors": {} }   // present on validation errors
}
```

---

## 1 · GET /health

No authentication required.

**Sample response**

```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-06-15T12:00:00.000Z",
  "services": {
    "db":    "ok",
    "redis": "ok"
  },
  "version": "1.0.0"
}
```

---

## 2 · GET /astro/meta

No authentication required. Returns all supported enumerations.

**Sample response**

```json
{
  "success": true,
  "data": {
    "planets": ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto","Rahu"],
    "houseSystems": {
      "P": "Placidus",
      "W": "Whole Sign",
      "E": "Equal",
      "K": "Koch",
      "O": "Porphyry",
      "R": "Regiomontanus",
      "C": "Campanus"
    },
    "ayanamsas": {
      "LAHIRI":        "Lahiri (Indian national standard)",
      "RAMAN":         "B.V. Raman",
      "KRISHNAMURTI":  "Krishnamurti (KP system)",
      "FAGAN_BRADLEY": "Fagan/Bradley (Western sidereal)",
      "TRUE_CITRA":    "True Chitrapaksha"
    },
    "modes": ["tropical", "sidereal"]
  }
}
```

**curl**

```bash
curl http://localhost:3000/api/v1/astro/meta | jq .
```

---

## 3 · POST /astro/julian-day

Convert any calendar date/time/timezone to Julian Day Number.

**Request**

```json
{
  "date":     "1988-08-01",
  "time":     "12:00:00",
  "timezone": "+05:30"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "input":     { "date": "1988-08-01", "time": "12:00:00", "timezone": "+05:30" },
    "utc":       { "year": 1988, "month": 8, "day": 1, "hour": 6.5 },
    "julianDay": 2447374.770833,
    "julianDayUT": 2447374.770833,
    "note": "julianDay is Julian Day Number in Universal Time (UT1 ≈ UTC)"
  }
}
```

**curl**

```bash
curl -s -X POST http://localhost:3000/api/v1/astro/julian-day \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{"date":"1988-08-01","time":"12:00:00","timezone":"+05:30"}' | jq .
```

---

## 4 · POST /astro/planet-positions

Calculate positions for one or all planets at a given date/time.  
Works in both tropical and sidereal (with ayanamsa) modes.

**Request**

```json
{
  "date":     "1988-08-01",
  "time":     "12:00:00",
  "timezone": "+05:30",
  "mode":     "sidereal",
  "ayanamsa": "LAHIRI",
  "planets":  ["Sun", "Moon", "Mars", "Jupiter", "Saturn"]
}
```

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `date` | string | Yes | — | YYYY-MM-DD |
| `time` | string | No | `12:00:00` | HH:mm or HH:mm:ss |
| `timezone` | string | No | `+00:00` | ±HH:MM / UTC / Z |
| `mode` | string | No | `tropical` | `tropical` \| `sidereal` |
| `ayanamsa` | string | No | `LAHIRI` | Used only when `mode=sidereal` |
| `planets` | string[] | No | all 11 | Subset of planet names |

**Response**

```json
{
  "success": true,
  "data": {
    "input":     { "date": "1988-08-01", "mode": "sidereal", "ayanamsa": "LAHIRI" },
    "julianDay": 2447374.770833,
    "utc":       { "year": 1988, "month": 8, "day": 1, "hour": 6.5 },
    "mode":      "sidereal",
    "ayanamsa":  { "name": "LAHIRI", "value": 23.6976 },
    "planets": [
      {
        "planet":       "Sun",
        "longitude":    105.5242,
        "latitude":     0.0002,
        "distance":     1.0147,
        "speed":        0.9564,
        "isRetrograde": false,
        "sign":         "Cancer",
        "signIndex":    3,
        "degreeInSign": 15.5242
      },
      {
        "planet":       "Moon",
        "longitude":    329.3455,
        "latitude":    -3.1,
        "distance":     0.00257,
        "speed":        14.7331,
        "isRetrograde": false,
        "sign":         "Aquarius",
        "signIndex":    10,
        "degreeInSign": 29.3455
      }
    ]
  }
}
```

**curl**

```bash
curl -s -X POST http://localhost:3000/api/v1/astro/planet-positions \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{
    "date": "1988-08-01",
    "time": "12:00:00",
    "timezone": "+05:30",
    "mode": "sidereal",
    "ayanamsa": "LAHIRI"
  }' | jq .
```

---

## 5 · POST /astro/houses

Calculate all 12 house cusps plus ascendant, MC, and vertex for a date + geographic location.

**Request**

```json
{
  "date":        "1988-08-01",
  "time":        "12:00:00",
  "timezone":    "+05:30",
  "latitude":    25.4358,
  "longitude":   81.8463,
  "houseSystem": "P",
  "mode":        "tropical",
  "ayanamsa":    "LAHIRI"
}
```

| Field | Values |
|-------|--------|
| `houseSystem` | `P` Placidus · `W` Whole Sign · `E` Equal · `K` Koch · `O` Porphyry · `R` Regiomontanus · `C` Campanus |
| `mode` | `tropical` \| `sidereal` |

**Response**

```json
{
  "success": true,
  "data": {
    "julianDay": 2447374.770833,
    "mode": "tropical",
    "ayanamsa": null,
    "houses": {
      "system":    "P",
      "ascendant": 215.2778,
      "mc":        127.0341,
      "vertex":    324.19,
      "cusps": [
        0,
        215.2778,
        244.387,
        275.034,
        307.034,
        339.144,
        9.031,
        35.278,
        64.387,
        95.034,
        127.034,
        159.144,
        189.031
      ]
    }
  }
}
```

> `cusps[1]`–`cusps[12]` = House 1–12 cusp longitudes. `cusps[0]` is always 0 (unused).

**curl**

```bash
curl -s -X POST http://localhost:3000/api/v1/astro/houses \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{
    "date":"1988-08-01","time":"12:00:00","timezone":"+05:30",
    "latitude":25.4358,"longitude":81.8463,
    "houseSystem":"W","mode":"sidereal","ayanamsa":"LAHIRI"
  }' | jq .
```

---

## 6 · POST /vedic/ayanamsa

Get the ayanamsa (precession offset) value in degrees for any date.

**Request**

```json
{
  "date":     "1988-08-01",
  "time":     "12:00:00",
  "timezone": "+05:30",
  "ayanamsa": "LAHIRI"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "date": "1988-08-01",
    "julianDay": 2447374.770833,
    "ayanamsa": {
      "name":  "LAHIRI",
      "value": 23.697600,
      "unit":  "degrees",
      "note":  "Precession correction to convert tropical → sidereal longitude"
    }
  }
}
```

**curl**

```bash
curl -s -X POST http://localhost:3000/api/v1/vedic/ayanamsa \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{"date":"1988-08-01","ayanamsa":"LAHIRI"}' | jq .
```

---

## 7 · POST /vedic/birth-chart

Full Vedic birth chart: all planets, Whole Sign houses, ascendant, Moon nakshatra, and ayanamsa.

**Request**

```json
{
  "date":        "1988-08-01",
  "time":        "12:00:00",
  "timezone":    "+05:30",
  "latitude":    25.4358,
  "longitude":   81.8463,
  "ayanamsa":    "LAHIRI",
  "houseSystem": "W"
}
```

**Response (abbreviated)**

```json
{
  "success": true,
  "data": {
    "input": { "date": "1988-08-01", "latitude": 25.4358, "longitude": 81.8463 },
    "julianDay":   2447374.770833,
    "ayanamsa":    23.6976,
    "ayanamsaName": "LAHIRI",
    "chart": {
      "julianDay": 2447374.770833,
      "mode":      "sidereal",
      "ayanamsa":  23.6976,
      "planets": [
        { "planet": "Sun",  "longitude": 105.5242, "sign": "Cancer",   "degreeInSign": 15.52, "isRetrograde": false },
        { "planet": "Moon", "longitude": 329.3455, "sign": "Aquarius", "degreeInSign": 29.35, "isRetrograde": false },
        { "planet": "Mercury","longitude":103.4075,"sign":"Cancer",    "degreeInSign": 13.41, "isRetrograde": false },
        { "planet": "Venus","longitude":  61.9004, "sign": "Gemini",   "degreeInSign":  1.90, "isRetrograde": false },
        { "planet": "Mars", "longitude": 343.5502, "sign": "Pisces",   "degreeInSign": 13.55, "isRetrograde": false },
        { "planet": "Jupiter","longitude":37.9650, "sign": "Taurus",   "degreeInSign":  7.97, "isRetrograde": false },
        { "planet": "Saturn","longitude":242.8949, "sign": "Sagittarius","degreeInSign":2.89, "isRetrograde": true  },
        { "planet": "Rahu", "longitude": 322.1778, "sign": "Aquarius", "degreeInSign": 22.18, "isRetrograde": true  }
      ],
      "houses": {
        "system":    "W",
        "ascendant": 191.5802,
        "mc":        103.3365,
        "cusps":     [0, 186.30, 216.30, 246.30, 276.30, 306.30, 336.30, 6.30, 36.30, 66.30, 96.30, 126.30, 156.30]
      }
    },
    "moonNakshatra": {
      "name":  "Purva Bhadrapada",
      "index": 24,
      "pada":  3,
      "lord":  "Jupiter",
      "degreesInNakshatra": 9.35
    },
    "ascendantNakshatra": {
      "name":  "Swati",
      "index": 14,
      "pada":  2,
      "lord":  "Rahu"
    }
  }
}
```

**curl**

```bash
curl -s -X POST http://localhost:3000/api/v1/vedic/birth-chart \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{
    "date":"1988-08-01","time":"12:00:00","timezone":"+05:30",
    "latitude":25.4358,"longitude":81.8463,
    "ayanamsa":"LAHIRI","houseSystem":"W"
  }' | jq .
```

---

## 8 · POST /vedic/nakshatra

Two modes:

### Mode A — from sidereal longitude

```json
{ "mode": "longitude", "longitude": 329.35 }
```

### Mode B — from birth chart planet

```json
{
  "mode":      "birth",
  "date":      "1988-08-01",
  "time":      "12:00:00",
  "timezone":  "+05:30",
  "latitude":  25.4358,
  "longitude": 81.8463,
  "planet":    "Moon",
  "ayanamsa":  "LAHIRI"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "planet":    "Moon",
    "longitude": 329.3455,
    "sign":      "Aquarius",
    "nakshatra": {
      "name":  "Purva Bhadrapada",
      "index": 24,
      "pada":  3,
      "lord":  "Jupiter",
      "degreesInNakshatra": 9.3455
    }
  }
}
```

**Nakshatra Reference (all 27)**

| # | Name | Lord | Span (sidereal) |
|---|------|------|----------------|
| 1 | Ashwini | Ketu | 0°–13°20' |
| 2 | Bharani | Venus | 13°20'–26°40' |
| 3 | Krittika | Sun | 26°40'–40° |
| 4 | Rohini | Moon | 40°–53°20' |
| 5 | Mrigashira | Mars | 53°20'–66°40' |
| 6 | Ardra | Rahu | 66°40'–80° |
| 7 | Punarvasu | Jupiter | 80°–93°20' |
| 8 | Pushya | Saturn | 93°20'–106°40' |
| 9 | Ashlesha | Mercury | 106°40'–120° |
| 10 | Magha | Ketu | 120°–133°20' |
| 11 | Purva Phalguni | Venus | 133°20'–146°40' |
| 12 | Uttara Phalguni | Sun | 146°40'–160° |
| 13 | Hasta | Moon | 160°–173°20' |
| 14 | Chitra | Mars | 173°20'–186°40' |
| 15 | Swati | Rahu | 186°40'–200° |
| 16 | Vishakha | Jupiter | 200°–213°20' |
| 17 | Anuradha | Saturn | 213°20'–226°40' |
| 18 | Jyeshtha | Mercury | 226°40'–240° |
| 19 | Mula | Ketu | 240°–253°20' |
| 20 | Purva Ashadha | Venus | 253°20'–266°40' |
| 21 | Uttara Ashadha | Sun | 266°40'–280° |
| 22 | Shravana | Moon | 280°–293°20' |
| 23 | Dhanishtha | Mars | 293°20'–306°40' |
| 24 | Shatabhisha | Rahu | 306°40'–320° |
| 25 | Purva Bhadrapada | Jupiter | 320°–333°20' |
| 26 | Uttara Bhadrapada | Saturn | 333°20'–346°40' |
| 27 | Revati | Mercury | 346°40'–360° |

**curl**

```bash
# Mode A
curl -s -X POST http://localhost:3000/api/v1/vedic/nakshatra \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{"mode":"longitude","longitude":329.35}' | jq .

# Mode B
curl -s -X POST http://localhost:3000/api/v1/vedic/nakshatra \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{"mode":"birth","date":"1988-08-01","time":"12:00:00","timezone":"+05:30","latitude":25.4358,"longitude":81.8463,"planet":"Moon","ayanamsa":"LAHIRI"}' | jq .
```

---

## 9 · POST /vedic/dasha/vimshottari

Vimshottari Mahadasha periods derived from Moon's nakshatra.  
Total cycle = 120 years (Ketu 7 + Venus 20 + Sun 6 + Moon 10 + Mars 7 + Rahu 18 + Jupiter 16 + Saturn 19 + Mercury 17).

**Request**

```json
{
  "date":       "1988-08-01",
  "time":       "12:00:00",
  "timezone":   "+05:30",
  "latitude":   25.4358,
  "longitude":  81.8463,
  "ayanamsa":   "LAHIRI",
  "yearsAhead": 100
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "moonPosition":  { "longitude": 329.3455, "sign": "Aquarius", "degree": 29.35 },
    "ayanamsa":      { "name": "LAHIRI", "value": 23.6976 },
    "moonNakshatra": "Purva Bhadrapada",
    "nakshatraLord": "Jupiter",
    "mahadashas": [
      { "planet": "Jupiter", "years": 4.79,  "start": "1988-08-01", "end": "1993-05-15" },
      { "planet": "Saturn",  "years": 19.00, "start": "1993-05-15", "end": "2012-05-14" },
      { "planet": "Mercury", "years": 17.00, "start": "2012-05-14", "end": "2029-05-15" },
      { "planet": "Ketu",    "years": 7.00,  "start": "2029-05-15", "end": "2036-05-14" },
      { "planet": "Venus",   "years": 20.00, "start": "2036-05-14", "end": "2056-05-14" },
      { "planet": "Sun",     "years": 6.00,  "start": "2056-05-14", "end": "2062-05-15" },
      { "planet": "Moon",    "years": 10.00, "start": "2062-05-15", "end": "2072-05-14" },
      { "planet": "Mars",    "years": 7.00,  "start": "2072-05-14", "end": "2079-05-15" },
      { "planet": "Rahu",    "years": 18.00, "start": "2079-05-15", "end": "2097-05-15" }
    ]
  }
}
```

**curl**

```bash
curl -s -X POST http://localhost:3000/api/v1/vedic/dasha/vimshottari \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{
    "date":"1988-08-01","time":"12:00:00","timezone":"+05:30",
    "latitude":25.4358,"longitude":81.8463,"yearsAhead":50
  }' | jq .
```

---

## 10 · POST /vedic/navamsa

D9 Navamsa chart — each sign is split into 9 parts (3°20' each); the navamsa sign is derived from the pada position.

**Request**

```json
{
  "date": "1988-08-01", "time": "12:00:00", "timezone": "+05:30",
  "latitude": 25.4358, "longitude": 81.8463, "ayanamsa": "LAHIRI"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "ayanamsa": { "name": "LAHIRI", "value": 23.6976 },
    "natalPlanets": [ ... ],
    "navamsaPlanets": [
      { "planet": "Sun",     "natalSign": "Cancer",      "natalLongitude": 105.52, "navamsaSign": "Scorpio",     "navamsaSignIndex": 7 },
      { "planet": "Moon",    "natalSign": "Aquarius",    "natalLongitude": 329.35, "navamsaSign": "Gemini",      "navamsaSignIndex": 2 },
      { "planet": "Mercury", "natalSign": "Cancer",      "natalLongitude": 103.41, "navamsaSign": "Scorpio",     "navamsaSignIndex": 7 },
      { "planet": "Venus",   "natalSign": "Gemini",      "natalLongitude":  61.90, "navamsaSign": "Libra",       "navamsaSignIndex": 6 },
      { "planet": "Mars",    "natalSign": "Pisces",      "natalLongitude": 343.55, "navamsaSign": "Scorpio",     "navamsaSignIndex": 7 },
      { "planet": "Jupiter", "natalSign": "Taurus",      "natalLongitude":  37.97, "navamsaSign": "Pisces",      "navamsaSignIndex": 11 },
      { "planet": "Saturn",  "natalSign": "Sagittarius", "natalLongitude": 242.89, "navamsaSign": "Aries",       "navamsaSignIndex": 0  }
    ]
  }
}
```

---

## 11 · POST /western/birth-chart

Full Western tropical birth chart with Placidus houses and all aspects.

**Request**

```json
{
  "date": "1988-08-01", "time": "12:00:00", "timezone": "+05:30",
  "latitude": 25.4358, "longitude": 81.8463,
  "houseSystem": "P"
}
```

**Response (abbreviated)**

```json
{
  "success": true,
  "data": {
    "chart": {
      "mode": "tropical",
      "planets": [
        { "planet": "Sun",     "longitude": 129.2218, "sign": "Leo",          "degreeInSign": 9.22,  "isRetrograde": false },
        { "planet": "Moon",    "longitude": 353.0431, "sign": "Pisces",       "degreeInSign": 23.04, "isRetrograde": false },
        { "planet": "Mercury", "longitude": 127.1051, "sign": "Leo",          "degreeInSign": 7.11,  "isRetrograde": false },
        { "planet": "Venus",   "longitude":  85.5980, "sign": "Gemini",       "degreeInSign": 25.60, "isRetrograde": false },
        { "planet": "Mars",    "longitude":   7.2478, "sign": "Aries",        "degreeInSign": 7.25,  "isRetrograde": false },
        { "planet": "Jupiter", "longitude":  61.6626, "sign": "Gemini",       "degreeInSign": 1.66,  "isRetrograde": false },
        { "planet": "Saturn",  "longitude": 266.5925, "sign": "Sagittarius",  "degreeInSign": 26.59, "isRetrograde": true  },
        { "planet": "Neptune", "longitude": 278.0050, "sign": "Capricorn",    "degreeInSign": 8.00,  "isRetrograde": true  },
        { "planet": "Pluto",   "longitude": 219.8013, "sign": "Scorpio",      "degreeInSign": 9.80,  "isRetrograde": false }
      ],
      "houses": {
        "system": "P", "ascendant": 215.2778, "mc": 127.0341,
        "cusps": [0, 215.28, 244.39, 275.03, 307.03, 339.14, 9.03, 35.28, 64.39, 95.03, 127.03, 159.14, 189.03]
      }
    },
    "aspects": [
      { "planet1": "Mercury", "planet2": "Mars",    "aspectName": "Trine",       "angle": 120, "orb": 0.14, "isApplying": false },
      { "planet1": "Sun",     "planet2": "Pluto",   "aspectName": "Square",      "angle": 90,  "orb": 0.58, "isApplying": false },
      { "planet1": "Saturn",  "planet2": "Uranus",  "aspectName": "Conjunction", "angle": 0,   "orb": 0.95, "isApplying": false },
      { "planet1": "Venus",   "planet2": "Saturn",  "aspectName": "Opposition",  "angle": 180, "orb": 0.99, "isApplying": false },
      { "planet1": "Sun",     "planet2": "Mercury", "aspectName": "Conjunction", "angle": 0,   "orb": 2.12, "isApplying": false }
    ]
  }
}
```

---

## 12 · POST /western/aspects

Calculate aspects for a date/time (no location required — purely longitude based).  
Optionally pass custom orb overrides.

**Request**

```json
{
  "date":     "1988-08-01",
  "time":     "12:00:00",
  "timezone": "+05:30",
  "planets":  ["Sun", "Moon", "Mars", "Saturn"],
  "orbs": {
    "Conjunction": 10,
    "Trine":        6,
    "Square":       8,
    "Opposition":   8
  }
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "julianDay": 2447374.770833,
    "totalAspects": 3,
    "aspects": [
      { "planet1": "Sun",  "planet2": "Mars",   "aspectName": "Trine",   "angle": 120, "orb": 1.97 },
      { "planet1": "Moon", "planet2": "Saturn", "aspectName": "Square",  "angle": 90,  "orb": 3.55 },
      { "planet1": "Sun",  "planet2": "Saturn", "aspectName": "Square",  "angle": 90,  "orb": 2.43 }
    ]
  }
}
```

**Aspect Definitions**

| Aspect | Angle | Default Orb |
|--------|-------|------------|
| Conjunction | 0° | 8° |
| Sextile | 60° | 6° |
| Square | 90° | 8° |
| Trine | 120° | 8° |
| Opposition | 180° | 8° |
| Quincunx | 150° | 3° |
| Semi-sextile | 30° | 2° |
| Semi-square | 45° | 2° |
| Sesquiquadrate | 135° | 2° |

**curl**

```bash
curl -s -X POST http://localhost:3000/api/v1/western/aspects \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{
    "date":"1988-08-01","time":"12:00:00","timezone":"+05:30",
    "orbs":{"Conjunction":10,"Opposition":10}
  }' | jq .
```

---

## 13 · POST /western/synastry

Cross-aspects between two natal charts (compatibility analysis).  
Planet names are prefixed `P1:` and `P2:` in the response.

**Request**

```json
{
  "person1": {
    "date": "1988-08-01", "time": "12:00:00", "timezone": "+05:30",
    "latitude": 25.4358, "longitude": 81.8463, "label": "Person A"
  },
  "person2": {
    "date": "1992-03-22", "time": "08:00:00", "timezone": "+05:30",
    "latitude": 19.0760, "longitude": 72.8777, "label": "Person B"
  }
}
```

**Response (abbreviated)**

```json
{
  "success": true,
  "data": {
    "person1": "Person A",
    "person2": "Person B",
    "crossAspects": [
      { "planet1": "P1:Sun", "planet2": "P2:Moon",    "aspectName": "Trine",   "angle": 120, "orb": 1.2 },
      { "planet1": "P1:Mars","planet2": "P2:Venus",   "aspectName": "Square",  "angle": 90,  "orb": 2.4 },
      { "planet1": "P1:Venus","planet2":"P2:Jupiter",  "aspectName": "Sextile", "angle": 60,  "orb": 3.1 }
    ],
    "person1Planets": [ ... ],
    "person2Planets": [ ... ]
  }
}
```

**curl**

```bash
curl -s -X POST http://localhost:3000/api/v1/western/synastry \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{
    "person1":{"date":"1988-08-01","time":"12:00:00","timezone":"+05:30","latitude":25.4358,"longitude":81.8463,"label":"Alice"},
    "person2":{"date":"1992-03-22","time":"08:00:00","timezone":"+05:30","latitude":19.0760,"longitude":72.8777,"label":"Bob"}
  }' | jq .
```

---

## 14 · POST /transits

Compares the current sky (or any target date) against a natal chart.  
Transit aspects prefixed `T:` (transit) vs `N:` (natal).

**Request**

```json
{
  "natal": {
    "date": "1988-08-01", "time": "12:00:00", "timezone": "+05:30",
    "latitude": 25.4358, "longitude": 81.8463
  },
  "transitDate":     "2024-06-15",
  "transitTime":     "12:00:00",
  "transitTimezone": "+00:00"
}
```

**Response (abbreviated)**

```json
{
  "success": true,
  "data": {
    "transitDate": "2024-06-15",
    "natalPlanets": [ ... ],
    "transitPlanets": [ ... ],
    "transitAspects": [
      { "planet1": "T:Saturn", "planet2": "N:Sun",  "aspectName": "Square",   "angle": 90,  "orb": 0.3 },
      { "planet1": "T:Jupiter","planet2": "N:Moon",  "aspectName": "Trine",    "angle": 120, "orb": 1.8 },
      { "planet1": "T:Pluto",  "planet2": "N:Venus", "aspectName": "Sextile",  "angle": 60,  "orb": 2.1 }
    ],
    "totalAspects": 24
  }
}
```

**curl**

```bash
curl -s -X POST http://localhost:3000/api/v1/transits \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{
    "natal":{"date":"1988-08-01","time":"12:00:00","timezone":"+05:30","latitude":25.4358,"longitude":81.8463},
    "transitDate":"2024-06-15","transitTime":"12:00:00","transitTimezone":"+00:00"
  }' | jq .
```

---

## 15 · POST /reports/generate

Enqueue an async report. Returns immediately with a `jobId` (HTTP 202).  
Requires Redis + BullMQ worker running.

**Request**

```json
{
  "reportType": "vedic-birth-chart",
  "userId":     "user_abc123",
  "natal": {
    "date": "1988-08-01", "time": "12:00:00", "timezone": "+05:30",
    "latitude": 25.4358, "longitude": 81.8463
  },
  "options": {
    "ayanamsa":    "LAHIRI",
    "houseSystem": "W",
    "yearsAhead":  100
  }
}
```

| `reportType` | When `natal2` needed | When `transitDate` needed |
|---|---|---|
| `vedic-birth-chart` | No | No |
| `western-birth-chart` | No | No |
| `vimshottari-dasha` | No | No |
| `navamsa` | No | No |
| `synastry` | Yes | No |
| `transit-report` | No | Yes |

**Synastry request**

```json
{
  "reportType": "synastry",
  "userId": "user_abc123",
  "natal":  { "date":"1988-08-01","time":"12:00:00","timezone":"+05:30","latitude":25.43,"longitude":81.84 },
  "natal2": { "date":"1992-03-22","time":"08:00:00","timezone":"+05:30","latitude":19.07,"longitude":72.87 }
}
```

**Response (202)**

```json
{
  "success": true,
  "data": {
    "jobId":      "1",
    "status":     "queued",
    "reportType": "vedic-birth-chart",
    "queuedAt":   "2024-06-15T12:00:00.000Z",
    "statusUrl":  "/api/v1/reports/1",
    "message":    "Report generation queued. Poll statusUrl for completion."
  }
}
```

**curl**

```bash
curl -s -X POST http://localhost:3000/api/v1/reports/generate \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-master-key-change-me" \
  -d '{
    "reportType":"vedic-birth-chart","userId":"user_001",
    "natal":{"date":"1988-08-01","time":"12:00:00","timezone":"+05:30","latitude":25.4358,"longitude":81.8463}
  }' | jq .
```

---

## 16 · GET /reports/:jobId

Poll status and retrieve the result of a queued report.

**Response — queued**

```json
{
  "success": true,
  "data": {
    "jobId":       "1",
    "status":      "active",
    "progress":    40,
    "queuedAt":    "2024-06-15T12:00:00.000Z",
    "startedAt":   "2024-06-15T12:00:01.000Z",
    "completedAt": null,
    "result":      null,
    "error":       null
  }
}
```

**Response — completed**

```json
{
  "success": true,
  "data": {
    "jobId":       "1",
    "status":      "completed",
    "progress":    100,
    "queuedAt":    "2024-06-15T12:00:00.000Z",
    "startedAt":   "2024-06-15T12:00:01.000Z",
    "completedAt": "2024-06-15T12:00:03.000Z",
    "result": {
      "reportType":  "vedic-birth-chart",
      "userId":      "user_001",
      "generatedAt": "2024-06-15T12:00:03.000Z",
      "status":      "completed"
    },
    "error": null
  }
}
```

**curl**

```bash
curl -s http://localhost:3000/api/v1/reports/1 \
  -H "x-api-key: dev-master-key-change-me" | jq .
```

---

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Validation error (check `details.fieldErrors`) |
| 401 | Missing or invalid `x-api-key` |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Service degraded (DB or Redis down) |

---

## Rate Limits

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| All routes | 100 req | 60 s |
| Astro compute endpoints | 50 req | 60 s |

Headers returned: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`

---

## Caching

All compute endpoints use Redis cache-aside with these TTLs:

| Endpoint | TTL |
|----------|-----|
| Planet positions | 1 hour |
| Houses | 1 hour |
| Vedic birth chart | 1 hour |
| Navamsa | 1 hour |
| Nakshatra | 1 hour |
| Dasha | 24 hours |
| Transits | 30 min |
| Reports | Not cached (BullMQ) |

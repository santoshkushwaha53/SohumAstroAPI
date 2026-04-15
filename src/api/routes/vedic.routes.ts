import { Router } from 'express';
import {
  getAyanamsa,
  getVedicBirthChart,
  getNakshatraHandler,
  getVimshottariDasha,
  getNavamsa,
  getVargas,
  getCompatibility,
  getYogas,
  getHoroscope,
  getKundali,
  exportKundaliExcel,
} from '../controllers/vedic.controller';
import { apiKeyAuth } from '../middlewares/auth.middleware';
import { astroRateLimit } from '../middlewares/rate-limit.middleware';

const router = Router();

/**
 * @openapi
 * /vedic/ayanamsa:
 *   post:
 *     tags: [Vedic]
 *     summary: Get ayanamsa (precession offset) value for a given date
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date:     { type: string, example: "1988-08-01" }
 *               time:     { type: string, example: "12:00:00" }
 *               timezone: { type: string, example: "+05:30" }
 *               ayanamsa: { type: string, enum: [LAHIRI, RAMAN, KRISHNAMURTI, FAGAN_BRADLEY, TRUE_CITRA], example: "LAHIRI" }
 *     responses:
 *       200:
 *         description: Ayanamsa value in degrees for the given date
 */
router.post('/ayanamsa', apiKeyAuth, getAyanamsa);

/**
 * @openapi
 * /vedic/birth-chart:
 *   post:
 *     tags: [Vedic]
 *     summary: Full Vedic sidereal birth chart (planets, houses, nakshatra, ascendant)
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/BirthInput'
 *               - type: object
 *                 properties:
 *                   ayanamsa:    { type: string, example: "LAHIRI" }
 *                   houseSystem: { type: string, enum: [W, P, E, K], example: "W" }
 *     responses:
 *       200:
 *         description: Complete Vedic birth chart
 */
router.post('/birth-chart', apiKeyAuth, astroRateLimit, getVedicBirthChart);

/**
 * @openapi
 * /vedic/nakshatra:
 *   post:
 *     tags: [Vedic]
 *     summary: Calculate nakshatra from a sidereal longitude or from a birth chart planet
 *     description: |
 *       Two modes:
 *       - **longitude**: directly supply a sidereal longitude (0–360°)
 *       - **birth**: supply birth data + planet name; the sidereal longitude is computed
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           examples:
 *             byLongitude:
 *               summary: From longitude
 *               value: { mode: "longitude", longitude: 329.35 }
 *             byBirth:
 *               summary: From birth data
 *               value:
 *                 mode: birth
 *                 date: "1988-08-01"
 *                 time: "12:00:00"
 *                 timezone: "+05:30"
 *                 latitude: 25.4358
 *                 longitude: 81.8463
 *                 planet: Moon
 *                 ayanamsa: LAHIRI
 *     responses:
 *       200:
 *         description: Nakshatra name, index (1-27), pada (1-4), and lord
 */
router.post('/nakshatra', apiKeyAuth, astroRateLimit, getNakshatraHandler);

/**
 * @openapi
 * /vedic/dasha/vimshottari:
 *   post:
 *     tags: [Vedic]
 *     summary: Calculate Vimshottari Mahadasha periods from birth
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/BirthInput'
 *               - type: object
 *                 properties:
 *                   ayanamsa:   { type: string, example: "LAHIRI" }
 *                   yearsAhead: { type: integer, example: 100 }
 *     responses:
 *       200:
 *         description: Mahadasha periods with start/end dates
 */
router.post('/dasha/vimshottari', apiKeyAuth, astroRateLimit, getVimshottariDasha);

/**
 * @openapi
 * /vedic/navamsa:
 *   post:
 *     tags: [Vedic]
 *     summary: Calculate D9 Navamsa divisional chart
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/BirthInput'
 *               - type: object
 *                 properties:
 *                   ayanamsa: { type: string, example: "LAHIRI" }
 *     responses:
 *       200:
 *         description: Navamsa sign for each planet alongside natal position
 */
router.post('/navamsa', apiKeyAuth, astroRateLimit, getNavamsa);

/**
 * @openapi
 * /vedic/vargas:
 *   post:
 *     tags: [Vedic]
 *     summary: Compute divisional (varga) charts D1–D60
 *     description: Returns planet sign placements in the requested divisional charts (default D1–D12).
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/BirthInput'
 *               - type: object
 *                 properties:
 *                   ayanamsa: { type: string, example: "LAHIRI" }
 *                   vargas:   { type: array, items: { type: string }, example: ["D1","D9","D10"] }
 *     responses:
 *       200:
 *         description: Varga chart planet placements
 */
router.post('/vargas', apiKeyAuth, astroRateLimit, getVargas);

/**
 * @openapi
 * /vedic/compatibility:
 *   post:
 *     tags: [Vedic]
 *     summary: Guna Milan (Ashtakuta) compatibility score between two persons
 *     description: Computes all 8 kutas (Varna through Nadi) from Moon nakshatra positions. Total out of 36.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [person1, person2]
 *             properties:
 *               person1:  { $ref: '#/components/schemas/BirthInput' }
 *               person2:  { $ref: '#/components/schemas/BirthInput' }
 *               ayanamsa: { type: string, example: "LAHIRI" }
 *     responses:
 *       200:
 *         description: Guna Milan result with per-kuta scores and verdict
 */
router.post('/compatibility', apiKeyAuth, astroRateLimit, getCompatibility);

/**
 * @openapi
 * /vedic/yogas:
 *   post:
 *     tags: [Vedic]
 *     summary: Detect Vedic yogas and doshas in a birth chart
 *     description: |
 *       Checks: Manglik Dosha, Kaal Sarpa Dosha, Pancha Mahapurusha yogas
 *       (Hamsa/Malavya/Ruchaka/Bhadra/Shasha), Gaja Kesari, Budhaditya.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/BirthInput'
 *               - type: object
 *                 properties:
 *                   ayanamsa:    { type: string, example: "LAHIRI" }
 *                   houseSystem: { type: string, enum: [W,P,E,K], example: "W" }
 *     responses:
 *       200:
 *         description: Yoga and Dosha detection results
 */
router.post('/yogas', apiKeyAuth, astroRateLimit, getYogas);

/**
 * @openapi
 * /vedic/horoscope:
 *   post:
 *     tags: [Vedic]
 *     summary: Transit horoscope — daily / tomorrow / weekly / monthly / yearly
 *     description: |
 *       Returns transit planet data vs natal chart for the requested period.
 *       Each row includes Moon nakshatra, tithi, all planet positions with natal-house,
 *       sign ingresses, retrograde stations, and tight natal aspects (≤1.5°).
 *       Daily/weekly includes choghadiya auspicious slots.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/BirthInput'
 *               - type: object
 *                 properties:
 *                   ayanamsa:   { type: string, example: "LAHIRI" }
 *                   period:     { type: string, enum: [daily,tomorrow,weekly,monthly,yearly], default: daily }
 *                   startDate:  { type: string, example: "2026-04-15" }
 *     responses:
 *       200:
 *         description: Transit horoscope raw data
 */
router.post('/horoscope', apiKeyAuth, astroRateLimit, getHoroscope);

/**
 * @openapi
 * /vedic/kundali:
 *   post:
 *     tags: [Vedic]
 *     summary: Full Kundali report — all 10 calculation layers in one call
 *     description: |
 *       Returns birth chart, dasha (3 levels), D1–D12 divisionals, yogas/doshas,
 *       birth-moment panchang, 30-day transit calendar, and 12-month transit events.
 *       Optional partner data for Guna Milan compatibility.
 *       Use this as the single document for AI interpretation layers.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/BirthInput'
 *               - type: object
 *                 properties:
 *                   ayanamsa:               { type: string, example: "LAHIRI" }
 *                   houseSystem:            { type: string, enum: [W,P,E,K], example: "W" }
 *                   includePratyantardasha: { type: boolean, default: false }
 *                   partner:               { $ref: '#/components/schemas/BirthInput' }
 *     responses:
 *       200:
 *         description: Complete kundali raw data bundle
 */
router.post('/kundali', apiKeyAuth, astroRateLimit, getKundali);

/**
 * @openapi
 * /vedic/kundali/export/excel:
 *   post:
 *     tags: [Vedic]
 *     summary: Download Kundali as Excel workbook (.xlsx)
 *     description: |
 *       Same input as /vedic/kundali. Returns a 6-sheet Excel workbook:
 *       Birth Chart, Dasha Timeline, Divisional Charts, Yogas & Doshas,
 *       Transit Calendar (30d), Yearly Transit Summary.
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BirthInput'
 *     responses:
 *       200:
 *         description: Excel file download
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.post('/kundali/export/excel', apiKeyAuth, astroRateLimit, exportKundaliExcel);

export default router;

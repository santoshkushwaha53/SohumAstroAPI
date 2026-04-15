import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock native addon and infra before importing app
vi.mock('swisseph', () => ({
  SE_SUN: 0, SE_MOON: 1, SE_MERCURY: 2, SE_VENUS: 3, SE_MARS: 4,
  SE_JUPITER: 5, SE_SATURN: 6, SE_URANUS: 7, SE_NEPTUNE: 8, SE_PLUTO: 9,
  SE_MEAN_NODE: 10, SE_TRUE_NODE: 11, SE_MEAN_APOG: 12,
  SE_CHIRON: 15, SE_PHOLUS: 16, SE_CERES: 17,
  SE_GREG_CAL: 1, SEFLG_MOSEPH: 4, SEFLG_SWIEPH: 2, SEFLG_SPEED: 256,
  SEFLG_SIDEREAL: 65536, SEFLG_JPLEPH: 1, SEFLG_TOPOCTR: 32768,
  SE_SIDM_LAHIRI: 1, SE_SIDM_RAMAN: 3,
  SE_SIDM_KRISHNAMURTI: 5, SE_SIDM_FAGAN_BRADLEY: 0, SE_SIDM_TRUE_CITRA: 27,
  SE_SIDM_DELUCE: 2, SE_SIDM_USER: 255,
  swe_set_ephe_path: vi.fn(),
  swe_julday: () => 2451545,
  swe_close: vi.fn(),
  swe_set_sid_mode: vi.fn(),
  swe_get_ayanamsa_ut: vi.fn().mockReturnValue(23.6),
  swe_get_planet_name: vi.fn().mockReturnValue({ name: 'Sun' }),
  swe_calc_ut: vi.fn(),
  swe_houses: vi.fn(),
}));

vi.mock('../src/db/prisma.client', () => ({
  prisma: { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) },
}));

vi.mock('../src/cache/redis.client', () => ({
  redisClient: { ping: vi.fn().mockResolvedValue('PONG'), get: vi.fn(), setex: vi.fn() },
  getOrSet: vi.fn().mockImplementation(async (_k: string, _t: number, fn: () => unknown) => fn()),
}));

import { createApp } from '../src/app';

const app = createApp();

describe('GET /api/v1/health', () => {
  it('returns 200 with healthy status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.services).toBeDefined();
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

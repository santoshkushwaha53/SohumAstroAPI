import { Router } from 'express';
import healthRouter   from './health.routes';
import astroRouter    from './astro.routes';
import vedicRouter    from './vedic.routes';
import westernRouter  from './western.routes';
import transitRouter  from './transit.routes';
import reportsRouter  from './reports.routes';
import panchangRouter from './panchang.routes';

const router = Router();

router.use('/health',   healthRouter);
router.use('/astro',    astroRouter);
router.use('/vedic',    vedicRouter);
router.use('/western',  westernRouter);
router.use('/transits', transitRouter);
router.use('/reports',  reportsRouter);
router.use('/panchang', panchangRouter);

export default router;

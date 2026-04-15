import type { Job } from 'bullmq';
import { logger } from '../../config/logger';
import { calcKundali } from '../../modules/vedic/kundali.service';
import { calcVedicBirthChart } from '../../modules/vedic/birth-chart.service';
import { calcVimshottari } from '../../modules/vedic/dasha.service';
import { calcWesternBirthChart } from '../../modules/western/birth-chart.service';
import { calcSynastry } from '../../modules/western/synastry.service';
import { generateKundaliExcel } from '../../modules/export/excel.service';
import type { AyanamsaName } from '../../modules/astronomy/types';
import type { BirthInput } from '../../modules/shared/types';

export interface ReportJobPayload {
  userId:           string;
  reportType:       'vedic-birth-chart' | 'western-birth-chart' | 'vimshottari-dasha' | 'navamsa' | 'synastry' | 'transit-report';
  natal:            BirthInput;
  natal2?:          BirthInput;
  transitDate?:     string;
  transitTimezone?: string;
  options?: {
    ayanamsa?:    AyanamsaName;
    houseSystem?: string;
    yearsAhead?:  number;
  };
}

export async function reportProcessor(job: Job): Promise<Record<string, unknown>> {
  const payload = job.data as ReportJobPayload;
  const { reportType, natal, options } = payload;
  const ayanamsa   = options?.ayanamsa    ?? 'LAHIRI';
  const houseSystem = options?.houseSystem ?? 'W';

  logger.info({ jobId: job.id, userId: payload.userId, type: reportType }, 'Generating report');

  await job.updateProgress(5);

  let result: Record<string, unknown>;

  switch (reportType) {

    case 'vedic-birth-chart': {
      await job.updateProgress(20);
      const chart = await calcVedicBirthChart(natal, ayanamsa, houseSystem);
      await job.updateProgress(80);
      result = {
        reportType,
        julianDay:    chart.julianDay,
        ayanamsa:     { name: ayanamsa, value: chart.ayanamsa },
        chart:        chart.chart,
        moonNakshatra: chart.moonNakshatra,
        ascendantNakshatra: chart.ascendantNakshatra,
      };
      break;
    }

    case 'vimshottari-dasha': {
      await job.updateProgress(20);
      const chart = await calcVedicBirthChart(natal, ayanamsa);
      const moon  = chart.chart.planets.find((p) => p.planet === 'Moon');
      if (!moon) throw new Error('Moon not found');
      await job.updateProgress(50);
      const dasha = calcVimshottari(moon.longitude, new Date(`${natal.date}T${natal.time ?? '12:00:00'}`), options?.yearsAhead ?? 100);
      await job.updateProgress(80);
      result = { reportType, ayanamsa: { name: ayanamsa, value: chart.ayanamsa }, ...dasha };
      break;
    }

    case 'navamsa': {
      await job.updateProgress(20);
      // Full kundali for navamsa context
      const kundali = await calcKundali({ natal, ayanamsa, houseSystem, transitDate: payload.transitDate });
      await job.updateProgress(80);
      result = { reportType, navamsa: kundali.divisionalCharts.find((v) => v.varga === 'D9')?.planets ?? [] };
      break;
    }

    case 'western-birth-chart': {
      await job.updateProgress(20);
      const chart = await calcWesternBirthChart(natal, houseSystem);
      await job.updateProgress(80);
      result = { reportType, ...chart };
      break;
    }

    case 'synastry': {
      if (!payload.natal2) throw new Error('natal2 required for synastry');
      await job.updateProgress(20);
      await job.updateProgress(60);
      const synastry = await calcSynastry(natal, payload.natal2!);
      await job.updateProgress(80);
      result = { reportType, synastry };
      break;
    }

    case 'transit-report': {
      await job.updateProgress(10);
      const kundali = await calcKundali({
        natal,
        ayanamsa,
        houseSystem,
        transitDate: payload.transitDate,
        transitTimezone: payload.transitTimezone,
      });
      await job.updateProgress(75);

      // Generate Excel workbook and encode as base64 for storage
      const wb        = await generateKundaliExcel(kundali as unknown as Record<string, unknown>, `Transit_${natal.date}`);
      const buffer    = await wb.xlsx.writeBuffer();
      const base64    = Buffer.from(buffer).toString('base64');
      await job.updateProgress(90);

      result = {
        reportType,
        kundali,
        excelBase64: base64,
        excelFilename: `Kundali_${natal.date}.xlsx`,
      };
      break;
    }

    default:
      throw new Error(`Unknown reportType: ${reportType as string}`);
  }

  await job.updateProgress(100);

  return {
    ...result,
    userId:      payload.userId,
    generatedAt: new Date().toISOString(),
    status:      'completed',
  };
}

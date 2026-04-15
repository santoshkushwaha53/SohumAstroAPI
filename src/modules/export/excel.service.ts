/**
 * Excel report generator using exceljs.
 *
 * Produces a multi-sheet workbook for a Vedic birth chart:
 *   Sheet 1: Birth Chart (planets, houses)
 *   Sheet 2: Dasha Timeline (maha + antardasha)
 *   Sheet 3: Divisional Charts (D1/D9/D10)
 *   Sheet 4: Yogas & Doshas
 *   Sheet 5: Transit Calendar (monthly, 30 days)
 *   Sheet 6: Auspicious Times (weekly choghadiya)
 */

import ExcelJS from 'exceljs';

// ── Shared styles ─────────────────────────────────────────────────────────────

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FF1F3864' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
const SUBHEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FFD6E4BC' },
};
const ALT_FILL: ExcelJS.FillPattern = {
  type: 'pattern', pattern: 'solid',
  fgColor: { argb: 'FFF5F5F5' },
};
const GOOD_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
const BAD_FILL:  ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE5CD' } };

function styleHeader(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill   = HEADER_FILL;
    cell.font   = HEADER_FONT;
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF888888' } } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  row.height = 18;
}

function autoWidths(sheet: ExcelJS.Worksheet, minWidth = 10, maxWidth = 40): void {
  sheet.columns.forEach((col) => {
    if (!col.values) return;
    let max = minWidth;
    col.values.forEach((v) => {
      if (v) max = Math.min(maxWidth, Math.max(max, String(v).length + 2));
    });
    col.width = max;
  });
}

// ── Sheet builders ────────────────────────────────────────────────────────────

function addBirthChartSheet(wb: ExcelJS.Workbook, data: Record<string, unknown>): void {
  const ws = wb.addWorksheet('Birth Chart');

  // Meta block
  const meta = (data['meta'] as Record<string, unknown>) ?? {};
  ws.addRow(['Generated', String(meta['generatedAt'] ?? '')]);
  ws.addRow(['Ayanamsa', String((meta['ayanamsa'] as Record<string, unknown>)?.['name'] ?? '')]);
  ws.addRow(['House System', String(meta['houseSystem'] ?? '')]);
  ws.addRow([]);

  // Ascendant block
  const bc = (data['birthChart'] as Record<string, unknown>) ?? {};
  ws.addRow(['Ascendant', `${bc['ascendantSign']} (${Number(bc['ascendant']).toFixed(2)}°)`]);
  ws.addRow(['MC', `${Number(bc['mc']).toFixed(2)}°`]);
  ws.addRow(['Moon Nakshatra', String((bc['moonNakshatra'] as Record<string, unknown>)?.['name'] ?? '')]);
  ws.addRow([]);

  // Planet table
  const hRow = ws.addRow(['Planet','Sign','House','Degree','DMS','Retrograde','Longitude']);
  styleHeader(hRow);

  const planets = (bc['planets'] as unknown[]) ?? [];
  planets.forEach((p, i) => {
    const pl = p as Record<string, unknown>;
    const r  = ws.addRow([
      String(pl['planet'] ?? ''),
      String(pl['sign'] ?? ''),
      String(pl['houseNumber'] ?? ''),
      Number(Number(pl['degreeInSign']).toFixed(2)),
      String((pl['dms'] as Record<string, unknown>)?.['formatted'] ?? ''),
      pl['isRetrograde'] ? 'R' : '',
      Number(Number(pl['longitude']).toFixed(4)),
    ]);
    if (i % 2 === 0) r.eachCell((c) => { c.fill = ALT_FILL; });
    if (pl['isRetrograde']) r.getCell(6).font = { color: { argb: 'FFCC0000' }, bold: true };
  });

  autoWidths(ws);
}

function addDashaSheet(wb: ExcelJS.Workbook, data: Record<string, unknown>): void {
  const ws     = wb.addWorksheet('Dasha Timeline');
  const dasha  = (data['dasha'] as Record<string, unknown>) ?? {};
  const bal    = (dasha['dashaBalance'] as Record<string, unknown>) ?? {};

  ws.addRow(['Moon Nakshatra', String(dasha['moonNakshatra'] ?? '')]);
  ws.addRow(['Nakshatra Lord', String(dasha['nakshatraLord'] ?? '')]);
  ws.addRow(['Balance Planet', String(bal['planet'] ?? ''), 'Remaining', `${bal['remainingYears']} yrs`]);
  ws.addRow([]);

  const hRow = ws.addRow(['Mahadasha','Start','End','Duration(yrs)','Antardasha','AD Start','AD End','AD Duration(yrs)']);
  styleHeader(hRow);

  const dashas = (dasha['dashas'] as unknown[]) ?? [];
  dashas.forEach((d) => {
    const md = d as Record<string, unknown>;
    const antardashas = (md['antardashas'] as unknown[]) ?? [];
    if (antardashas.length === 0) {
      ws.addRow([md['planet'], md['start'], md['end'], md['durationYears'], '', '', '', '']);
    } else {
      antardashas.forEach((a, j) => {
        const ad = a as Record<string, unknown>;
        const r  = ws.addRow([
          j === 0 ? md['planet'] : '',
          j === 0 ? md['start']  : '',
          j === 0 ? md['end']    : '',
          j === 0 ? md['durationYears'] : '',
          ad['planet'], ad['start'], ad['end'], ad['durationYears'],
        ]);
        if (j === 0) {
          r.getCell(1).font = { bold: true };
          r.eachCell((c, ci) => { if (ci <= 4) c.fill = SUBHEADER_FILL; });
        }
      });
    }
  });

  autoWidths(ws);
}

function addVargasSheet(wb: ExcelJS.Workbook, data: Record<string, unknown>): void {
  const ws     = wb.addWorksheet('Divisional Charts');
  const vargas = (data['divisionalCharts'] as unknown[]) ?? [];

  const hRow = ws.addRow(['Varga','Name','Planet','Natal Sign','Varga Sign','Division Index']);
  styleHeader(hRow);

  vargas.forEach((vc) => {
    const v  = vc as Record<string, unknown>;
    const ps = (v['planets'] as unknown[]) ?? [];
    ps.forEach((p, i) => {
      const pl = p as Record<string, unknown>;
      const r  = ws.addRow([
        String(v['varga'] ?? ''),
        String(v['name'] ?? ''),
        String(pl['planet'] ?? ''),
        String(pl['natalSign'] ?? ''),
        String(pl['vargaSign'] ?? ''),
        Number(pl['divisionIndex'] ?? 0),
      ]);
      if (i % 2 === 0) r.eachCell((c) => { c.fill = ALT_FILL; });
    });
  });

  autoWidths(ws);
}

function addYogasSheet(wb: ExcelJS.Workbook, data: Record<string, unknown>): void {
  const ws    = wb.addWorksheet('Yogas & Doshas');
  const yogas = (data['yogasDoshas'] as Record<string, unknown>) ?? {};

  const hRow = ws.addRow(['Check','Present','Planets','House / Sign','Notes']);
  styleHeader(hRow);

  const entries: unknown[] = [
    yogas['manglikDosha'],
    yogas['kaalSarpaDosha'],
    yogas['gajaKesariYoga'],
    yogas['budhadityaYoga'],
    ...((yogas['panchamahapurusha'] as unknown[]) ?? []),
  ];

  entries.forEach((e) => {
    if (!e) return;
    const y  = e as Record<string, unknown>;
    const r  = ws.addRow([
      String(y['name'] ?? ''),
      y['present'] ? 'YES' : 'No',
      Array.isArray(y['planets']) ? (y['planets'] as string[]).join(', ') : '',
      String(y['houseOrSign'] ?? ''),
      String(y['notes'] ?? ''),
    ]);
    const presentCell = r.getCell(2);
    if (y['present']) {
      presentCell.fill = GOOD_FILL;
      presentCell.font = { bold: true, color: { argb: 'FF1A5E1A' } };
    } else {
      presentCell.fill = BAD_FILL;
    }
  });

  autoWidths(ws);
}

function addTransitSheet(wb: ExcelJS.Workbook, data: Record<string, unknown>): void {
  const ws = wb.addWorksheet('Transit Calendar (30d)');
  const th = (data['transitHoroscope'] as Record<string, unknown>) ?? {};
  const monthly = (th['monthly'] as unknown[]) ?? [];

  const hRow = ws.addRow(['Date','Weekday','Moon Nakshatra','Moon Sign','Tithi','Events']);
  styleHeader(hRow);

  monthly.forEach((row, i) => {
    const r  = row as Record<string, unknown>;
    const evts = ((r['events'] as unknown[]) ?? [])
      .map((e) => (e as Record<string, unknown>)['description'])
      .join('; ');
    const row2 = ws.addRow([
      String(r['date'] ?? ''), String(r['weekday'] ?? ''),
      String(r['moonNakshatra'] ?? ''), String(r['moonSign'] ?? ''),
      String(r['tithi'] ?? ''), evts,
    ]);
    if (i % 2 === 0) row2.eachCell((c) => { c.fill = ALT_FILL; });
  });

  autoWidths(ws);
}

function addAuspiciousTimesSheet(wb: ExcelJS.Workbook, data: Record<string, unknown>): void {
  const ws = wb.addWorksheet('Auspicious Times (7d)');
  const th = (data['transitHoroscope'] as Record<string, unknown>) ?? {};
  // Yearly data won't have daily slots - weekly won't either (different shape)
  // We'll note this sheet uses monthly rows that have no slots
  ws.addRow(['Note', 'For detailed hourly auspicious slots (Choghadiya/Hora), call POST /panchang/range']);
  ws.addRow([]);

  const hRow = ws.addRow(['Month','Slow Planet','Sign','Retrograde','Events']);
  styleHeader(hRow);

  const yearly = (th['yearly'] as unknown[]) ?? [];
  yearly.forEach((m, i) => {
    const mo   = m as Record<string, unknown>;
    const slow = (mo['slowPlanets'] as unknown[]) ?? [];
    const evts = ((mo['events'] as unknown[]) ?? [])
      .map((e) => (e as Record<string, unknown>)['description'])
      .join('; ');
    slow.forEach((sp, j) => {
      const s = sp as Record<string, unknown>;
      const r = ws.addRow([
        j === 0 ? String(mo['month'] ?? '') : '',
        String(s['planet'] ?? ''), String(s['sign'] ?? ''),
        s['isRetrograde'] ? 'R' : '',
        j === 0 ? evts : '',
      ]);
      if (i % 2 === 0) r.eachCell((c) => { c.fill = ALT_FILL; });
    });
  });

  autoWidths(ws);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate a complete Kundali Excel workbook.
 *
 * @param kundaliData  Full result object from calcKundali()
 * @param natalInput   Name/place label for workbook title
 * @returns ExcelJS.Workbook ready for streaming
 */
export async function generateKundaliExcel(
  kundaliData: Record<string, unknown>,
  label: string = 'Kundali Report'
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator   = 'SohumAstroAPI';
  wb.created   = new Date();
  wb.title     = label;

  addBirthChartSheet(wb, kundaliData);
  addDashaSheet(wb, kundaliData);
  addVargasSheet(wb, kundaliData);
  addYogasSheet(wb, kundaliData);
  addTransitSheet(wb, kundaliData);
  addAuspiciousTimesSheet(wb, kundaliData);

  return wb;
}

/**
 * Generate a panchang range Excel workbook.
 */
export async function generatePanchangExcel(
  rows: unknown[],
  dateRange: string
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SohumAstroAPI';
  wb.created = new Date();
  wb.title   = `Panchang ${dateRange}`;

  const ws   = wb.addWorksheet('Panchang');
  const hRow = ws.addRow([
    'Date','Weekday','Tithi','Paksha','Nakshatra','Yoga','Karana',
    'Sunrise (local)','Sunset (local)','Day Length',
    'Rahu Kaal Start','Rahu Kaal End',
    'Choghadiya (Excellent slots)',
  ]);
  styleHeader(hRow);

  rows.forEach((row, i) => {
    const r  = row as Record<string, unknown>;
    const tithi   = (r['tithi']   as Record<string, unknown>) ?? {};
    const naksh   = (r['nakshatra'] as Record<string, unknown>) ?? {};
    const yoga    = (r['yoga']    as Record<string, unknown>) ?? {};
    const karana  = (r['karana']  as Record<string, unknown>) ?? {};
    const rahu    = (r['rahuKaal'] as Record<string, unknown>) ?? {};
    const sunrise = (r['sunrise'] as Record<string, unknown>) ?? {};
    const sunset  = (r['sunset']  as Record<string, unknown>) ?? {};
    const choghs  = ((r['choghadiyas'] as unknown[]) ?? [])
      .filter((c) => ['A','S','L'].includes(String((c as Record<string, unknown>)['code'])))
      .map((c) => {
        const cs = c as Record<string, unknown>;
        return `${cs['name']} ${cs['startLocal']}–${cs['endLocal']}`;
      }).join('; ');

    const exRow = ws.addRow([
      String(r['date'] ?? ''),
      String((r['weekday'] as Record<string, unknown>)?.['name'] ?? ''),
      String(tithi['name'] ?? ''),
      String(tithi['paksha'] ?? ''),
      String(naksh['name'] ?? ''),
      String(yoga['name'] ?? ''),
      String(karana['name'] ?? ''),
      String(sunrise['local'] ?? ''),
      String(sunset['local'] ?? ''),
      String(r['dayLength'] ?? ''),
      String(rahu['startLocal'] ?? ''),
      String(rahu['endLocal'] ?? ''),
      choghs,
    ]);
    if (i % 2 === 0) exRow.eachCell((c) => { c.fill = ALT_FILL; });
  });

  autoWidths(ws);
  return wb;
}

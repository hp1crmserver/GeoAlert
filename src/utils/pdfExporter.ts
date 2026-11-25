import { jsPDF } from 'jspdf';
import type { SeismicEvent } from '../types/seismic';
import {
  SEVERITY_CONFIG,
  classifyDepthLabel,
  formatCoords,
  formatLocalTime,
  formatUtcTime,
  getMercalliInfo,
} from './seismicHelpers';

function drawGeoAlertIconPdf(doc: jsPDF, cx: number, cy: number, r: number): void {
  // Globe circle
  doc.setDrawColor(56, 189, 248);
  doc.setLineWidth(0.55);
  doc.circle(cx, cy, r, 'S');
  doc.setLineWidth(0.35);
  doc.ellipse(cx, cy, r * 0.45, r, 'S');

  // Seismic waveform pulse
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.65);
  const pts: Array<[number, number]> = [
    [cx - r * 0.85, cy],
    [cx - r * 0.45, cy],
    [cx - r * 0.25, cy - r * 0.45],
    [cx - r * 0.05, cy + r * 0.55],
    [cx + r * 0.15, cy - r * 0.6],
    [cx + r * 0.35, cy + r * 0.3],
    [cx + r * 0.5, cy],
    [cx + r * 0.85, cy],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    doc.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
  }
}

export function exportEventPdf(event: SeismicEvent, cardImageDataUrl?: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;

  // Header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 34, 'F');

  drawGeoAlertIconPdf(doc, margin + 5.5, 13.5, 5.5);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('GeoAlert — Boletín Técnico Sísmico', margin + 14, 15.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Emitido por: ${event.agencyName} (${event.agency})  |  Estado: ${event.status}`,
    margin,
    25.5
  );

  // Severity banner
  const sev = SEVERITY_CONFIG[event.severity];
  const sevRgb =
    event.severity === 'Crítico'
      ? [220, 38, 38]
      : event.severity === 'Alto'
      ? [217, 119, 6]
      : event.severity === 'Moderado'
      ? [2, 132, 199]
      : [5, 150, 105];

  doc.setFillColor(sevRgb[0], sevRgb[1], sevRgb[2]);
  doc.roundedRect(margin, 42, pageW - margin * 2, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    `${event.bulletinType.toUpperCase()}  |  NIVEL DE SEVERIDAD: ${sev.label.toUpperCase()}  |  MAGNITUD ${event.magnitude.toFixed(1)} ${event.magType}`,
    margin + 4,
    51
  );

  // Event location headline
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(event.place, pageW - margin * 2);
  doc.text(titleLines, margin, 68);

  let cursorY = 68 + titleLines.length * 6.5 + 4;

  const mmi = getMercalliInfo(event);
  // Parameter table
  const rows: Array<[string, string]> = [
    ['Identificador del Evento', event.id],
    ['Agencia Emisora', `${event.agencyName} (${event.agency})`],
    ['País / Zona', event.country],
    ['Magnitud', `${event.magnitude.toFixed(1)} ${event.magType}`],
    [
      'Escala Mercalli (MMI)',
      `MMI ${mmi.roman} — ${mmi.label} (${mmi.isInstrumental ? 'Instrumental' : 'Estimada'})`,
    ],
    ['Profundidad Focal', `${event.depthKm.toFixed(1)} km (${classifyDepthLabel(event.depthKm)})`],
    ['Coordenadas del Epicentro', `${formatCoords(event.lat, event.lon)} (${event.lat.toFixed(4)}, ${event.lon.toFixed(4)})`],
    ['Fecha y Hora (UTC)', formatUtcTime(event.timestamp)],
    ['Fecha y Hora (Local)', formatLocalTime(event.timestamp)],
    ['Aviso de Tsunami', event.tsunamiWarning ? 'SÍ — Aviso de tsunami activo' : 'No reportado'],
    ['Evaluación de Riesgo', `${sev.label}: ${sev.description}`],
  ];

  if (event.feltReports) {
    rows.push(['Reportes Ciudadanos (Sentido)', `${event.feltReports} reportes`]);
  }

  doc.setFontSize(9.5);
  rows.forEach(([key, val], idx) => {
    const rowY = cursorY + idx * 8.5;
    if (idx % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, rowY - 5.5, pageW - margin * 2, 8.5, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(key, margin + 2, rowY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(val).slice(0, 72), margin + 62, rowY);
  });

  cursorY += rows.length * 8.5 + 8;

  // Embed 4:5 generated card image if provided
  if (cardImageDataUrl && cursorY < 210) {
    const availH = 278 - cursorY;
    const imgH = Math.min(availH, 105);
    const imgW = imgH * 0.8; // 4:5 ratio
    const imgX = (pageW - imgW) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('Tarjeta Sísmica Oficial (Formato 4:5):', margin, cursorY);
    doc.addImage(cardImageDataUrl, 'PNG', imgX, cursorY + 4, imgW, imgH);
  }

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generado por GeoAlert el ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`,
    margin,
    288
  );

  doc.save(`boletin-geoalert-${event.agency}-${event.magnitude.toFixed(1)}.pdf`);
}

export function exportHistoryPdf(
  events: SeismicEvent[],
  filterMeta: {
    startDate: string;
    endDate: string;
    regionLabel: string;
    agency: string;
    severity: string;
    minMag: number;
  }
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  const drawHeader = (pageNum: number) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 24, 'F');
    drawGeoAlertIconPdf(doc, margin + 4.5, 10.5, 4.5);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('GeoAlert — Reporte Histórico de Actividad Sísmica', margin + 11.5, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Período: ${filterMeta.startDate} a ${filterMeta.endDate}  |  Región: ${filterMeta.regionLabel}  |  Pág. ${pageNum}`,
      margin,
      19.5
    );
  };

  drawHeader(1);

  // KPI summary row
  const maxMag = events.reduce((m, e) => Math.max(m, e.magnitude), 0);
  const critCount = events.filter((e) => e.severity === 'Crítico').length;
  const highCount = events.filter((e) => e.severity === 'Alto').length;
  const modCount = events.filter((e) => e.severity === 'Moderado').length;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(
    `Resumen: ${events.length} eventos  |  Mag. Máx: ${
      events.length ? maxMag.toFixed(1) : '—'
    }  |  Críticos: ${critCount}  |  Altos: ${highCount}  |  Moderados: ${modCount}`,
    margin,
    34
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Filtros activos — Agencia: ${filterMeta.agency}  ·  Severidad: ${filterMeta.severity}  ·  Magnitud mínima: ${filterMeta.minMag.toFixed(1)}`,
    margin,
    40
  );

  // Table header
  let y = 49;
  const drawTableHeader = (posY: number) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, posY - 5, pageW - margin * 2, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text('FECHA / HORA UTC', margin + 1, posY);
    doc.text('AGENCIA', margin + 35, posY);
    doc.text('MAG', margin + 54, posY);
    doc.text('PROF', margin + 67, posY);
    doc.text('SEVERIDAD', margin + 81, posY);
    doc.text('UBICACIÓN / EPICENTRO', margin + 104, posY);
  };

  drawTableHeader(y);
  y += 7;

  let pageNum = 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);

  events.slice(0, 200).forEach((ev, idx) => {
    if (y > pageH - 18) {
      doc.addPage();
      pageNum += 1;
      drawHeader(pageNum);
      y = 35;
      drawTableHeader(y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 4.5, pageW - margin * 2, 6.5, 'F');
    }

    doc.setTextColor(51, 65, 85);
    doc.text(formatUtcTime(ev.timestamp).replace(' UTC', ''), margin + 1, y);
    doc.text(ev.agency, margin + 35, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(ev.magnitude.toFixed(1), margin + 54, y);
    doc.setFont('helvetica', 'normal');

    doc.setTextColor(51, 65, 85);
    doc.text(`${ev.depthKm.toFixed(0)}km`, margin + 67, y);
    doc.text(ev.severity, margin + 81, y);
    doc.text(ev.place.slice(0, 46), margin + 104, y);

    y += 6.5;
  });

  doc.save(`reporte-historico-sismos-${filterMeta.startDate}.pdf`);
}

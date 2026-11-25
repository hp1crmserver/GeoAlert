import type { EsriLayerId, SeismicEvent, SeverityLevel } from '../types/seismic';
import {
  ESRI_LAYERS,
  SEVERITY_CONFIG,
  classifyDepthLabel,
  formatCoords,
  formatLocalTime,
  formatUtcTime,
  getMercalliInfo,
} from './seismicHelpers';

export type CardStyleMode = 'dark' | 'light' | 'alert';

interface TileLoadResult {
  img: HTMLImageElement;
  dx: number;
  dy: number;
}

function latLonToTileFloat(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const latRad = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = ((lon + 180) / 360) * n;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

function loadTileImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => reject(new Error('Tile timeout')), 3500);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Tile error'));
    };
    img.src = url;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines && words.length > 0) {
    const joined = lines.join(' ');
    if (joined.length < text.length) {
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…';
    }
  }
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawGeoAlertIconCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  globeStroke = '#0EA5E9'
) {
  const r = size / 2;
  const cx = x + r;
  const cy = y + r;
  ctx.save();

  // Outer globe circle
  ctx.strokeStyle = globeStroke;
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
  ctx.stroke();

  // Meridian ellipse
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = Math.max(1.4, size * 0.055);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.42, r * 0.86, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Seismic waveform pulse across globe
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = Math.max(2.2, size * 0.09);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.12, cy);
  ctx.lineTo(x + size * 0.29, cy);
  ctx.lineTo(x + size * 0.37, y + size * 0.3);
  ctx.lineTo(x + size * 0.47, y + size * 0.72);
  ctx.lineTo(x + size * 0.57, y + size * 0.22);
  ctx.lineTo(x + size * 0.67, y + size * 0.6);
  ctx.lineTo(x + size * 0.73, cy);
  ctx.lineTo(x + size * 0.88, cy);
  ctx.stroke();

  ctx.restore();
}

export async function generateEventCard45(
  event: SeismicEvent,
  options?: {
    style?: CardStyleMode;
    esriLayer?: EsriLayerId;
    customNote?: string;
  }
): Promise<string> {
  const style = options?.style || 'dark';
  const esriLayerId = options?.esriLayer || (style === 'light' ? 'topo' : 'imagery');
  const layerCfg = ESRI_LAYERS[esriLayerId] || ESRI_LAYERS.imagery;

  const W = 1080;
  const H = 1350; // Exact 4:5 ratio
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');

  const isLight = style === 'light';
  const isAlertStyle = style === 'alert';
  const sev = SEVERITY_CONFIG[event.severity];

  const palette = isLight
    ? {
        bg: '#F8FAFC',
        panel: '#FFFFFF',
        border: '#E2E8F0',
        textPrimary: '#0F172A',
        textSecondary: '#475569',
        textMuted: '#64748B',
        accent: sev.colorHex,
      }
    : isAlertStyle
    ? {
        bg: '#14090B',
        panel: '#1F0E12',
        border: '#4C1D24',
        textPrimary: '#FFF1F2',
        textSecondary: '#FDA4AF',
        textMuted: '#FECDD3',
        accent: '#EF4444',
      }
    : {
        bg: '#070B12',
        panel: '#0F172A',
        border: '#1E293B',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        textMuted: '#64748B',
        accent: sev.ringHex,
      };

  // Fill background
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);

  // Map viewport region at top
  const mapX = 48;
  const mapY = 48;
  const mapW = W - 96;
  const mapH = 540;
  const mapCenterX = mapX + mapW / 2;
  const mapCenterY = mapY + mapH / 2;

  ctx.save();
  drawRoundedRect(ctx, mapX, mapY, mapW, mapH, 20);
  ctx.clip();

  // Fallback dark/light ocean grid before tiles
  ctx.fillStyle = isLight ? '#E2E8F0' : '#0B1324';
  ctx.fillRect(mapX, mapY, mapW, mapH);

  // Draw Esri tile mosaic centered on event coordinates
  const zoom = event.magnitude >= 6 ? 5 : 6;
  const maxTile = Math.pow(2, zoom);
  const { x: tileXf, y: tileYf } = latLonToTileFloat(event.lat, event.lon, zoom);
  const centerTileX = Math.floor(tileXf);
  const centerTileY = Math.floor(tileYf);
  const offsetX = (tileXf - centerTileX) * 256;
  const offsetY = (tileYf - centerTileY) * 256;

  const tilePromises: Promise<TileLoadResult | null>[] = [];
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const tx = ((centerTileX + dx) % maxTile + maxTile) % maxTile;
      const ty = centerTileY + dy;
      if (ty < 0 || ty >= maxTile) continue;
      const tileUrl = layerCfg.url
        .replace('{z}', String(zoom))
        .replace('{x}', String(tx))
        .replace('{y}', String(ty));
      tilePromises.push(
        loadTileImage(tileUrl)
          .then((img) => ({ img, dx, dy }))
          .catch(() => null)
      );
    }
  }

  const loadedTiles = await Promise.all(tilePromises);
  for (const t of loadedTiles) {
    if (!t) continue;
    const px = mapCenterX - offsetX + t.dx * 256;
    const py = mapCenterY - offsetY + t.dy * 256;
    ctx.drawImage(t.img, px, py, 256, 256);
  }

  // Subtle coordinate graticule lines
  ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  for (let gx = mapX + 120; gx < mapX + mapW; gx += 120) {
    ctx.beginPath();
    ctx.moveTo(gx, mapY);
    ctx.lineTo(gx, mapY + mapH);
    ctx.stroke();
  }
  for (let gy = mapY + 108; gy < mapY + mapH; gy += 108) {
    ctx.beginPath();
    ctx.moveTo(mapX, gy);
    ctx.lineTo(mapX + mapW, gy);
    ctx.stroke();
  }

  // Concentric seismic wave rings around epicenter
  const ringRadii = [44, 96, 156, 224];
  ringRadii.forEach((r, i) => {
    ctx.beginPath();
    ctx.arc(mapCenterX, mapCenterY, r, 0, Math.PI * 2);
    ctx.strokeStyle = sev.ringHex;
    ctx.globalAlpha = 0.72 - i * 0.16;
    ctx.lineWidth = i === 0 ? 3 : 2;
    if (i >= 2) ctx.setLineDash([8, 6]);
    else ctx.setLineDash([]);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Epicenter core marker
  ctx.beginPath();
  ctx.arc(mapCenterX, mapCenterY, 18, 0, Math.PI * 2);
  ctx.fillStyle = sev.colorHex;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();

  // Crosshair ticks
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mapCenterX - 36, mapCenterY);
  ctx.lineTo(mapCenterX - 22, mapCenterY);
  ctx.moveTo(mapCenterX + 22, mapCenterY);
  ctx.lineTo(mapCenterX + 36, mapCenterY);
  ctx.moveTo(mapCenterX, mapCenterY - 36);
  ctx.lineTo(mapCenterX, mapCenterY - 22);
  ctx.moveTo(mapCenterX, mapCenterY + 22);
  ctx.lineTo(mapCenterX, mapCenterY + 36);
  ctx.stroke();

  // Bottom scrim inside map for coordinates & Esri attribution
  const scrim = ctx.createLinearGradient(0, mapY + mapH - 130, 0, mapY + mapH);
  scrim.addColorStop(0, 'rgba(7, 11, 18, 0)');
  scrim.addColorStop(1, 'rgba(7, 11, 18, 0.88)');
  ctx.fillStyle = scrim;
  ctx.fillRect(mapX, mapY + mapH - 130, mapW, 130);

  // Top-left Agency tag inside map
  ctx.fillStyle = 'rgba(7, 11, 18, 0.82)';
  drawRoundedRect(ctx, mapX + 20, mapY + 20, 320, 44, 8);
  ctx.fill();
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText(`${event.agency} · ${event.status}`, mapX + 36, mapY + 48);

  // Bottom-left epicenter coordinate overlay
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '500 20px "JetBrains Mono", monospace';
  ctx.fillText(`EPICENTRO  ${formatCoords(event.lat, event.lon)}`, mapX + 24, mapY + mapH - 24);

  // Bottom-right layer label
  ctx.fillStyle = '#94A3B8';
  ctx.font = '400 16px "IBM Plex Sans", sans-serif';
  const layerLabel = `${layerCfg.label}`;
  const lw = ctx.measureText(layerLabel).width;
  ctx.fillText(layerLabel, mapX + mapW - lw - 24, mapY + mapH - 24);

  ctx.restore();

  // Map outer hairline border
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, mapX, mapY, mapW, mapH, 20);
  ctx.stroke();

  // Bulletin classification & severity header row
  const mmi = getMercalliInfo(event);
  const headerY = mapY + mapH + 56;
  ctx.fillStyle = sev.colorHex;
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `${sev.glyph}  ${event.bulletinType.toUpperCase()}  ·  NIVEL ${event.severity.toUpperCase()}`,
    48,
    headerY
  );

  const mmiBadgeText = `MERCALLI ${mmi.roman} · ${mmi.label.toUpperCase()}`;
  ctx.fillStyle = mmi.colorHex;
  ctx.font = '700 20px "JetBrains Mono", monospace';
  const mmiW = ctx.measureText(mmiBadgeText).width;
  ctx.fillText(mmiBadgeText, W - 48 - mmiW, headerY);

  // Magnitude & Place main block
  const magBoxY = headerY + 28;
  const magBoxW = 240;
  const magBoxH = 178;

  ctx.fillStyle = palette.panel;
  drawRoundedRect(ctx, 48, magBoxY, magBoxW, magBoxH, 16);
  ctx.fill();
  ctx.strokeStyle = sev.colorHex;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = palette.textSecondary;
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText(`MAGNITUD ${event.magType.toUpperCase()}`, 72, magBoxY + 38);

  ctx.fillStyle = palette.textPrimary;
  ctx.font = '700 84px "JetBrains Mono", monospace';
  ctx.fillText(event.magnitude.toFixed(1), 68, magBoxY + 136);

  // Place & Country next to Magnitude block
  const titleX = 48 + magBoxW + 32;
  const titleMaxW = W - titleX - 48;
  ctx.fillStyle = palette.textSecondary;
  ctx.font = '600 21px "IBM Plex Sans", sans-serif';
  ctx.fillText(event.country.toUpperCase(), titleX, magBoxY + 32);

  ctx.fillStyle = palette.textPrimary;
  ctx.font = '700 36px "Plus Jakarta Sans", sans-serif';
  const placeLines = wrapText(ctx, event.place, titleMaxW, 3);
  placeLines.forEach((line, i) => {
    ctx.fillText(line, titleX, magBoxY + 80 + i * 44);
  });

  // 4-cell structured telemetry grid
  const gridY = magBoxY + magBoxH + 34;
  const cellW = (W - 96 - 24) / 2;
  const cellH = 126;

  const cells = [
    {
      label: 'PROFUNDIDAD FOCAL',
      value: `${event.depthKm.toFixed(1)} km`,
      sub: classifyDepthLabel(event.depthKm),
    },
    {
      label: 'COORDENADAS GEOGRÁFICAS',
      value: formatCoords(event.lat, event.lon),
      sub: `Lat ${event.lat.toFixed(4)} / Lon ${event.lon.toFixed(4)}`,
    },
    {
      label: 'FECHA Y HORA LOCAL',
      value: formatLocalTime(event.timestamp),
      sub: 'Hora local del dispositivo',
    },
    {
      label: 'TIEMPO UNIVERSAL (UTC)',
      value: formatUtcTime(event.timestamp).replace(' UTC', ''),
      sub: 'Estándar FDSN UTC',
    },
  ];

  cells.forEach((c, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const cx = 48 + col * (cellW + 24);
    const cy = gridY + row * (cellH + 20);

    ctx.fillStyle = palette.panel;
    drawRoundedRect(ctx, cx, cy, cellW, cellH, 14);
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = palette.textMuted;
    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillText(c.label, cx + 24, cy + 34);

    ctx.fillStyle = palette.textPrimary;
    ctx.font = '700 28px "JetBrains Mono", monospace';
    ctx.fillText(c.value, cx + 24, cy + 76);

    ctx.fillStyle = palette.textSecondary;
    ctx.font = '400 17px "IBM Plex Sans", sans-serif';
    ctx.fillText(c.sub, cx + 24, cy + 106);
  });

  // Tsunami & Source Footer strip
  const footerBoxY = gridY + 2 * (cellH + 20) + 12;
  ctx.fillStyle = event.tsunamiWarning
    ? 'rgba(220, 38, 38, 0.16)'
    : palette.panel;
  drawRoundedRect(ctx, 48, footerBoxY, W - 96, 86, 14);
  ctx.fill();
  ctx.strokeStyle = event.tsunamiWarning ? '#DC2626' : palette.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = event.tsunamiWarning ? '#EF4444' : palette.textPrimary;
  ctx.font = '600 20px "IBM Plex Sans", sans-serif';
  const tsunamiText = event.tsunamiWarning
    ? '▲ AVISO DE TSUNAMI ACTIVO — Siga instrucciones de autoridades locales'
    : 'Sin aviso de tsunami activo en el boletín actual';
  ctx.fillText(tsunamiText, 72, footerBoxY + 36);

  ctx.fillStyle = palette.textSecondary;
  ctx.font = '400 17px "IBM Plex Sans", sans-serif';
  const noteOrAgency = options?.customNote?.trim()
    ? options.customNote.trim()
    : `Fuente oficial: ${event.agencyName}`;
  ctx.fillText(noteOrAgency.slice(0, 74), 72, footerBoxY + 66);

  // Bottom signature line with thematic GeoAlert icon
  drawGeoAlertIconCanvas(ctx, 48, H - 56, 28, '#0EA5E9');
  ctx.fillStyle = palette.textMuted;
  ctx.font = '700 19px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('GeoAlert · Monitoreo Sísmico Global', 86, H - 36);

  const ratioTag = 'FORMATO 4:5 · 1080×1350';
  ctx.font = '500 16px "JetBrains Mono", monospace';
  const rw = ctx.measureText(ratioTag).width;
  ctx.fillText(ratioTag, W - rw - 48, H - 36);

  return canvas.toDataURL('image/png');
}

export function generateHistorySummaryCard45(
  events: SeismicEvent[],
  filterSummary: string,
  style: 'dark' | 'light' = 'dark'
): string {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');

  const isLight = style === 'light';
  const bg = isLight ? '#F8FAFC' : '#070B12';
  const panel = isLight ? '#FFFFFF' : '#0F172A';
  const border = isLight ? '#E2E8F0' : '#1E293B';
  const textPrimary = isLight ? '#0F172A' : '#F8FAFC';
  const textSecondary = isLight ? '#475569' : '#94A3B8';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = '#0EA5E9';
  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.fillText('REPORTE HISTÓRICO DE ACTIVIDAD SÍSMICA', 56, 76);

  ctx.fillStyle = textPrimary;
  ctx.font = '700 44px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Resumen de Boletines Registrados', 56, 132);

  ctx.fillStyle = textSecondary;
  ctx.font = '400 20px "IBM Plex Sans", sans-serif';
  ctx.fillText(filterSummary.slice(0, 82), 56, 172);

  // KPI strip
  const maxMag = events.reduce((m, e) => Math.max(m, e.magnitude), 0);
  const criticalCount = events.filter(
    (e) => e.severity === 'Crítico' || e.severity === 'Alto'
  ).length;
  const agenciesActive = new Set(events.map((e) => e.agency)).size;

  const kpis = [
    { label: 'EVENTOS', val: String(events.length) },
    { label: 'MAG. MÁXIMA', val: events.length ? `M ${maxMag.toFixed(1)}` : '—' },
    { label: 'ALTO / CRÍTICO', val: String(criticalCount) },
    { label: 'AGENCIAS', val: String(agenciesActive) },
  ];

  const kpiW = (W - 112 - 48) / 4;
  kpis.forEach((k, i) => {
    const kx = 56 + i * (kpiW + 16);
    const ky = 212;
    ctx.fillStyle = panel;
    drawRoundedRect(ctx, kx, ky, kpiW, 132, 14);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = textSecondary;
    ctx.font = '600 15px "JetBrains Mono", monospace';
    ctx.fillText(k.label, kx + 20, ky + 38);

    ctx.fillStyle = textPrimary;
    ctx.font = '700 42px "JetBrains Mono", monospace';
    ctx.fillText(k.val, kx + 20, ky + 98);
  });

  // Severity distribution bar section
  const distY = 382;
  ctx.fillStyle = panel;
  drawRoundedRect(ctx, 56, distY, W - 112, 220, 16);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.stroke();

  ctx.fillStyle = textPrimary;
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Distribución por Nivel de Severidad', 84, distY + 42);

  const levels: SeverityLevel[] = ['Crítico', 'Alto', 'Moderado', 'Bajo'];
  levels.forEach((lvl, idx) => {
    const count = events.filter((e) => e.severity === lvl).length;
    const pct = events.length ? (count / events.length) * 100 : 0;
    const ry = distY + 76 + idx * 34;
    const cfg = SEVERITY_CONFIG[lvl];

    ctx.fillStyle = textPrimary;
    ctx.font = '600 18px "IBM Plex Sans", sans-serif';
    ctx.fillText(`${cfg.glyph} ${lvl}`, 84, ry + 14);

    // Track
    ctx.fillStyle = isLight ? '#E2E8F0' : '#1E293B';
    drawRoundedRect(ctx, 250, ry, 590, 16, 8);
    ctx.fill();

    // Fill
    if (pct > 0) {
      ctx.fillStyle = cfg.colorHex;
      drawRoundedRect(ctx, 250, ry, Math.max(12, (590 * pct) / 100), 16, 8);
      ctx.fill();
    }

    ctx.fillStyle = textSecondary;
    ctx.font = '600 17px "JetBrains Mono", monospace';
    ctx.fillText(`${count} (${pct.toFixed(0)}%)`, 860, ry + 14);
  });

  // Top 8 significant events list
  const listY = 638;
  ctx.fillStyle = panel;
  drawRoundedRect(ctx, 56, listY, W - 112, 620, 16);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.stroke();

  ctx.fillStyle = textPrimary;
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Eventos Destacados del Período', 84, listY + 44);

  const topEvents = [...events]
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, 8);

  topEvents.forEach((ev, idx) => {
    const ey = listY + 84 + idx * 64;
    const cfg = SEVERITY_CONFIG[ev.severity];

    if (idx > 0) {
      ctx.strokeStyle = border;
      ctx.beginPath();
      ctx.moveTo(84, ey - 16);
      ctx.lineTo(W - 84, ey - 16);
      ctx.stroke();
    }

    ctx.fillStyle = cfg.colorHex;
    ctx.font = '700 24px "JetBrains Mono", monospace';
    ctx.fillText(`M ${ev.magnitude.toFixed(1)}`, 84, ey + 18);

    ctx.fillStyle = textPrimary;
    ctx.font = '600 19px "IBM Plex Sans", sans-serif';
    ctx.fillText(ev.place.slice(0, 46), 196, ey + 10);

    ctx.fillStyle = textSecondary;
    ctx.font = '400 15px "JetBrains Mono", monospace';
    ctx.fillText(
      `${ev.agency} · ${ev.depthKm.toFixed(0)} km · ${formatUtcTime(ev.timestamp)}`,
      196,
      ey + 34
    );

    ctx.fillStyle = cfg.colorHex;
    ctx.font = '600 16px "IBM Plex Sans", sans-serif';
    const sevText = `${cfg.glyph} ${ev.severity}`;
    const sw = ctx.measureText(sevText).width;
    ctx.fillText(sevText, W - 84 - sw, ey + 18);
  });

  // Footer with thematic GeoAlert icon
  drawGeoAlertIconCanvas(ctx, 56, H - 56, 28, '#0EA5E9');
  ctx.fillStyle = textSecondary;
  ctx.font = '700 19px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('GeoAlert · Exportación Histórica 4:5', 94, H - 36);

  return canvas.toDataURL('image/png');
}

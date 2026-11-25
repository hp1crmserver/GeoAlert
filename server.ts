import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
  AgencyId,
  AgencyStatus,
  BulletinType,
  RegionKey,
  SeismicEvent,
  SeverityLevel,
} from './src/types/seismic.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const USER_AGENT = 'GeoAlert/1.0 (+https://geoalert.local)';

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&uuml;/gi, 'ü')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyRegion(lat: number, lon: number, place: string): Exclude<RegionKey, 'all'> {
  const lower = place.toLowerCase();
  if (
    (lat >= 5.0 && lat <= 11.8 && lon >= -86.5 && lon <= -76.5) ||
    lower.includes('panama') ||
    lower.includes('panamá') ||
    lower.includes('chiriqu') ||
    lower.includes('darién') ||
    lower.includes('tonosí') ||
    lower.includes('armuelles') ||
    lower.includes('costa rica')
  ) {
    return 'panama';
  }
  if (lat >= -58 && lat <= 18 && lon >= -93 && lon <= -34) {
    return 'latam';
  }
  if (lat > 14 && lat <= 75 && lon >= -170 && lon <= -50) {
    return 'north_america';
  }
  if (lat >= 28 && lat <= 72 && lon >= -30 && lon <= 45) {
    return 'europe';
  }
  if (lat <= -5 && ((lon >= 110 && lon <= 180) || (lon >= -180 && lon <= -150))) {
    return 'oceania';
  }
  return 'asia_pacific';
}

function inferCountry(place: string, agency: AgencyId): string {
  const lower = place.toLowerCase();
  if (lower.includes('panam') || agency === 'IGC-UPA') return 'Panamá';
  if (lower.includes('costa rica')) return 'Costa Rica';
  if (lower.includes('colombia') || agency === 'SGC') return 'Colombia';
  if (lower.includes('chile') || agency === 'CSN') return 'Chile';
  if (
    lower.includes('mexico') ||
    lower.includes('méxico') ||
    lower.includes('oax') ||
    lower.includes('chis') ||
    lower.includes('gro') ||
    lower.includes('mich') ||
    lower.includes('jal') ||
    lower.includes('bc') ||
    agency === 'SSN'
  ) {
    return 'México';
  }
  if (lower.includes('canada') || lower.includes('canadá') || agency === 'NRCan') return 'Canadá';
  if (lower.includes('japan') || lower.includes('japón') || agency === 'JMA') return 'Japón';
  if (lower.includes('italy') || lower.includes('italia') || agency === 'INGV') return 'Italia';
  if (lower.includes('new zealand') || lower.includes('nueva zelanda') || agency === 'GeoNet') {
    return 'Nueva Zelanda';
  }
  if (lower.includes('spain') || lower.includes('españa') || agency === 'IGN') return 'España';
  if (lower.includes('indonesia') || agency === 'BMKG') return 'Indonesia';
  if (lower.includes('alaska') || lower.includes('california') || lower.includes('hawaii') || lower.includes('nevada')) {
    return 'EE. UU.';
  }
  const parts = place.split(',');
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  return 'Internacional';
}

function classifySeverityAndBulletin(
  mag: number,
  depthKm: number,
  tsunamiWarning: boolean,
  alertColor?: string | null,
  mmi?: number | null
): { severity: SeverityLevel; bulletinType: BulletinType } {
  const shallowBoost = depthKm <= 25 && mag >= 5.2 ? 0.3 : 0;
  const effectiveMag = mag + shallowBoost;

  if (
    tsunamiWarning ||
    alertColor === 'red' ||
    effectiveMag >= 6.4 ||
    (mmi !== null && mmi !== undefined && mmi >= 7)
  ) {
    return { severity: 'Crítico', bulletinType: 'Alerta' };
  }
  if (
    alertColor === 'orange' ||
    alertColor === 'yellow' ||
    effectiveMag >= 5.2 ||
    (mmi !== null && mmi !== undefined && mmi >= 5)
  ) {
    return { severity: 'Alto', bulletinType: 'Aviso' };
  }
  if (effectiveMag >= 3.8 || (mmi !== null && mmi !== undefined && mmi >= 3.5)) {
    return { severity: 'Moderado', bulletinType: 'Boletín' };
  }
  return { severity: 'Bajo', bulletinType: 'Notificación' };
}

async function fetchWithTimeout(url: string, timeoutMs = 5500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json, application/xml, text/xml, text/plain, text/html',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function parsePanamaLocalToIso(dateStr: string, timeStr: string): string {
  // dateStr: YYYY-MM-DD, timeStr: e.g. 12:35:58PM
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})(AM|PM)$/i);
  if (!m) return new Date().toISOString();
  let hour = Number(m[1]);
  const min = Number(m[2]);
  const sec = Number(m[3]);
  const ampm = m[4].toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  const pad = (n: number) => String(n).padStart(2, '0');
  // Panama is UTC-5 year-round
  const iso = `${dateStr}T${pad(hour)}:${pad(min)}:${pad(sec)}-05:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

async function fetchIgcPanama(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout('https://sismosgeociencias.up.ac.pa/', 6500);
  if (!res.ok) throw new Error(`IGC-UPA HTTP ${res.status}`);
  const html = await res.text();
  const rows = html.match(/<tr>\s*<td>[\s\S]*?<\/tr>/gi) || [];
  const events: SeismicEvent[] = [];

  for (const row of rows.slice(0, 45)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (cells.length < 8) continue;
    const statusRaw = decodeHtmlEntities(cells[0]).toUpperCase();
    const dateStr = decodeHtmlEntities(cells[1]);
    const timeStr = decodeHtmlEntities(cells[2]);
    const lat = Number.parseFloat(decodeHtmlEntities(cells[3]));
    const lon = Number.parseFloat(decodeHtmlEntities(cells[4]));
    const depthKm = Number.parseFloat(decodeHtmlEntities(cells[5]).replace(/[^\d.-]/g, '')) || 10;
    const mag = Number.parseFloat(decodeHtmlEntities(cells[6]));
    const place = decodeHtmlEntities(cells[7]);
    const hrefMatch = cells[8]?.match(/href="([^"]+)"/i);

    if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(mag)) continue;
    const timestamp = parsePanamaLocalToIso(dateStr, timeStr);
    const { severity, bulletinType } = classifySeverityAndBulletin(mag, depthKm, false);
    const status: SeismicEvent['status'] =
      statusRaw.includes('REVISADO') ? 'REVISADO' : 'PRELIMINAR';

    events.push({
      id: `igc-${dateStr}-${timeStr}-${lat.toFixed(3)}-${lon.toFixed(3)}`,
      agency: 'IGC-UPA',
      agencyName: 'Instituto de Geociencias (Universidad de Panamá)',
      contributor: 'IGC-UPA',
      place: place || 'Región de Panamá',
      country: place.toLowerCase().includes('costa rica') ? 'Panamá / Costa Rica' : 'Panamá',
      regionKey: 'panama',
      magnitude: Number(mag.toFixed(1)),
      magType: 'Ml',
      depthKm: Number(depthKm.toFixed(1)),
      lat,
      lon,
      timestamp,
      status,
      bulletinType,
      severity,
      tsunamiWarning: false,
      sourceUrl: hrefMatch
        ? `https://sismosgeociencias.up.ac.pa/${hrefMatch[1]}`
        : 'https://sismosgeociencias.up.ac.pa/',
    });
  }
  return events;
}

async function fetchUsgs(url?: string): Promise<SeismicEvent[]> {
  const endpoint =
    url || 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=80';
  const res = await fetchWithTimeout(endpoint, 6500);
  if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);
  const data = (await res.json()) as { features?: any[] };
  const features = data.features || [];

  return features
    .filter((f) => f.geometry?.coordinates && typeof f.properties?.mag === 'number')
    .map((f) => {
      const [lon, lat, depth] = f.geometry.coordinates as [number, number, number];
      const p = f.properties;
      const mag = Number(p.mag);
      const depthKm = Number.isFinite(depth) ? Math.max(0, Number(depth)) : 10;
      const place = String(p.place || 'Ubicación no especificada');
      const tsunamiWarning = p.tsunami === 1;
      const { severity, bulletinType } = classifySeverityAndBulletin(
        mag,
        depthKm,
        tsunamiWarning,
        p.alert,
        p.mmi
      );
      const status: SeismicEvent['status'] =
        p.status === 'reviewed' ? 'REVISADO' : 'AUTOMÁTICO';

      return {
        id: `usgs-${f.id}`,
        agency: 'USGS',
        agencyName: 'United States Geological Survey',
        contributor: String(p.net || 'us').toUpperCase(),
        place,
        country: inferCountry(place, 'USGS'),
        regionKey: classifyRegion(lat, lon, place),
        magnitude: Number(mag.toFixed(1)),
        magType: String(p.magType || 'Mw'),
        depthKm: Number(depthKm.toFixed(1)),
        lat,
        lon,
        timestamp: new Date(p.time).toISOString(),
        status,
        bulletinType,
        severity,
        tsunamiWarning,
        mmi: typeof p.mmi === 'number' ? Number(p.mmi.toFixed(1)) : null,
        alertColor: p.alert || null,
        feltReports: typeof p.felt === 'number' ? p.felt : null,
        sourceUrl: p.url || 'https://earthquake.usgs.gov/',
      };
    });
}

async function fetchEmsc(url?: string): Promise<SeismicEvent[]> {
  const endpoint =
    url || 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=80';
  const res = await fetchWithTimeout(endpoint, 6500);
  if (!res.ok) throw new Error(`EMSC HTTP ${res.status}`);
  const data = (await res.json()) as { features?: any[] };
  const features = data.features || [];

  return features
    .filter((f) => f.geometry?.coordinates && typeof f.properties?.mag === 'number')
    .map((f) => {
      const [lon, lat, depthRaw] = f.geometry.coordinates as [number, number, number];
      const p = f.properties;
      const mag = Number(p.mag);
      const depthKm = Math.abs(Number(p.depth ?? depthRaw ?? 10));
      const place = String(p.flynn_region || 'Región Euro-Mediterránea / Global');
      const auth = String(p.auth || 'EMSC').toUpperCase();
      const { severity, bulletinType } = classifySeverityAndBulletin(mag, depthKm, false);

      return {
        id: `emsc-${f.id || p.source_id || p.unid}`,
        agency: 'EMSC',
        agencyName: 'European-Mediterranean Seismological Centre',
        contributor: auth,
        place,
        country: inferCountry(place, 'EMSC'),
        regionKey: classifyRegion(lat, lon, place),
        magnitude: Number(mag.toFixed(1)),
        magType: String(p.magtype || 'Mw'),
        depthKm: Number(depthKm.toFixed(1)),
        lat,
        lon,
        timestamp: new Date(p.time).toISOString(),
        status: 'REVISADO',
        bulletinType,
        severity,
        tsunamiWarning: false,
        sourceUrl: p.unid
          ? `https://www.seismicportal.eu/eventdetails.html?unid=${p.unid}`
          : 'https://www.seismicportal.eu/',
      };
    });
}

async function fetchSsnMexico(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout('http://www.ssn.unam.mx/rss/ultimos-sismos.xml', 6000);
  if (!res.ok) throw new Error(`SSN HTTP ${res.status}`);
  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  const events: SeismicEvent[] = [];

  for (const item of items.slice(0, 35)) {
    const title = decodeHtmlEntities(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '');
    const desc = decodeHtmlEntities(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '');
    const link = decodeHtmlEntities(
      item.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '') || ''
    );
    const lat = Number.parseFloat(item.match(/<geo:lat>([\s\S]*?)<\/geo:lat>/i)?.[1] || '');
    const lon = Number.parseFloat(item.match(/<geo:long>([\s\S]*?)<\/geo:long>/i)?.[1] || '');

    const magMatch = title.match(/^([\d.]+)\s*,\s*(.+)$/);
    const mag = magMatch ? Number.parseFloat(magMatch[1]) : NaN;
    const place = magMatch ? magMatch[2].trim() : title;
    const depthMatch = desc.match(/Profundidad:\s*([\d.]+)\s*km/i);
    const depthKm = depthMatch ? Number.parseFloat(depthMatch[1]) : 15;
    const dateMatch = desc.match(/Fecha:\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/i);

    if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(mag)) continue;

    const timestamp = dateMatch
      ? new Date(`${dateMatch[1]}T${dateMatch[2]}-06:00`).toISOString()
      : new Date().toISOString();
    const { severity, bulletinType } = classifySeverityAndBulletin(mag, depthKm, false);

    events.push({
      id: `ssn-${dateMatch?.[1] || ''}-${dateMatch?.[2] || ''}-${lat.toFixed(2)}-${lon.toFixed(2)}`,
      agency: 'SSN',
      agencyName: 'Servicio Sismológico Nacional (UNAM, México)',
      contributor: 'SSN-UNAM',
      place,
      country: 'México',
      regionKey: 'latam',
      magnitude: Number(mag.toFixed(1)),
      magType: 'M',
      depthKm: Number(depthKm.toFixed(1)),
      lat,
      lon,
      timestamp,
      status: 'REVISADO',
      bulletinType,
      severity,
      tsunamiWarning: false,
      sourceUrl: link || 'http://www.ssn.unam.mx/',
    });
  }
  return events;
}

async function fetchNrcanCanada(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout(
    'https://earthquakescanada.nrcan.gc.ca/fdsnws/event/1/query?format=text&limit=35',
    6000
  );
  if (!res.ok) throw new Error(`NRCan HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  const events: SeismicEvent[] = [];

  for (const line of lines) {
    const cols = line.split('|');
    if (cols.length < 8) continue;
    const [eventId, time, latStr, lonStr, depthStr, magType, magStr, place] = cols;
    const lat = Number.parseFloat(latStr);
    const lon = Number.parseFloat(lonStr);
    const depthKm = Number.parseFloat(depthStr) || 10;
    const mag = Number.parseFloat(magStr);
    if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(mag)) continue;

    const { severity, bulletinType } = classifySeverityAndBulletin(mag, depthKm, false);
    events.push({
      id: `nrcan-${eventId.trim()}`,
      agency: 'NRCan',
      agencyName: 'Natural Resources Canada (Earthquakes Canada)',
      contributor: 'NRCan',
      place: place.trim(),
      country: 'Canadá',
      regionKey: 'north_america',
      magnitude: Number(mag.toFixed(1)),
      magType: magType.trim() || 'ML',
      depthKm: Number(depthKm.toFixed(1)),
      lat,
      lon,
      timestamp: new Date(time.trim()).toISOString(),
      status: 'REVISADO',
      bulletinType,
      severity,
      tsunamiWarning: false,
      sourceUrl: `https://www.earthquakescanada.nrcan.gc.ca/stndon/NEDB-BNDS/bulletin-en.php`,
    });
  }
  return events;
}

async function fetchJmaJapan(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout(
    'https://api.p2pquake.net/v2/history?codes=551&limit=30',
    6000
  );
  if (!res.ok) throw new Error(`JMA HTTP ${res.status}`);
  const list = (await res.json()) as any[];
  const events: SeismicEvent[] = [];

  for (const item of list) {
    const eq = item.earthquake;
    const hypo = eq?.hypocenter;
    if (!hypo || typeof hypo.latitude !== 'number' || typeof hypo.longitude !== 'number') continue;
    if (hypo.latitude < -90 || hypo.longitude < -180 || hypo.magnitude < 0) continue;

    const mag = Number(hypo.magnitude);
    const depthKm = Number(hypo.depth >= 0 ? hypo.depth : 10);
    // JMA time format: "2026/11/25 07:20:00" in JST (UTC+9)
    const timeStr = String(eq.time || '').replace(/\//g, '-').replace(' ', 'T') + '+09:00';
    const d = new Date(timeStr);
    const timestamp = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    const domTsunami = String(eq.domesticTsunami || 'None');
    const tsunamiWarning =
      domTsunami !== 'None' && domTsunami !== 'Unknown' && domTsunami !== 'Checking';
    const maxScale = typeof eq.maxScale === 'number' ? eq.maxScale : -1;
    const approxMmi = maxScale >= 10 ? Math.min(10, Math.round(maxScale / 7)) : null;
    const { severity, bulletinType } = classifySeverityAndBulletin(
      mag,
      depthKm,
      tsunamiWarning,
      null,
      approxMmi
    );

    events.push({
      id: `jma-${item.id || timestamp}-${hypo.latitude}`,
      agency: 'JMA',
      agencyName: 'Japan Meteorological Agency (JMA)',
      contributor: 'JMA / P2PQuake',
      place: `${hypo.name || 'Japón'} (JMA)`,
      country: 'Japón',
      regionKey: 'asia_pacific',
      magnitude: Number(mag.toFixed(1)),
      magType: 'Mj',
      depthKm: Number(depthKm.toFixed(1)),
      lat: hypo.latitude,
      lon: hypo.longitude,
      timestamp,
      status: 'REVISADO',
      bulletinType,
      severity,
      tsunamiWarning,
      mmi: approxMmi,
      sourceUrl: 'https://www.jma.go.jp/bosai/map.html#contents=earthquake_map',
    });
  }
  return events;
}

async function fetchIngvItaly(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout(
    'https://webservices.ingv.it/fdsnws/event/1/query?format=text&limit=35',
    6000
  );
  if (!res.ok) throw new Error(`INGV HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  const events: SeismicEvent[] = [];

  for (const line of lines) {
    const cols = line.split('|');
    if (cols.length < 13) continue;
    const eventId = cols[0].trim();
    const time = cols[1].trim();
    const lat = Number.parseFloat(cols[2]);
    const lon = Number.parseFloat(cols[3]);
    const depthKm = Number.parseFloat(cols[4]) || 10;
    const magType = cols[9].trim() || 'ML';
    const mag = Number.parseFloat(cols[10]);
    const place = cols[12].trim();
    if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(mag)) continue;

    const { severity, bulletinType } = classifySeverityAndBulletin(mag, depthKm, false);
    events.push({
      id: `ingv-${eventId}`,
      agency: 'INGV',
      agencyName: 'Istituto Nazionale di Geofisica e Vulcanologia',
      contributor: cols[7]?.trim() || 'INGV',
      place,
      country: 'Italia',
      regionKey: 'europe',
      magnitude: Number(mag.toFixed(1)),
      magType,
      depthKm: Number(depthKm.toFixed(1)),
      lat,
      lon,
      timestamp: new Date(time.endsWith('Z') ? time : `${time}Z`).toISOString(),
      status: 'REVISADO',
      bulletinType,
      severity,
      tsunamiWarning: false,
      sourceUrl: `https://terremoti.ingv.it/event/${eventId}`,
    });
  }
  return events;
}

async function fetchGeoNetNz(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout('https://api.geonet.org.nz/quake?MMI=1', 6000);
  if (!res.ok) throw new Error(`GeoNet HTTP ${res.status}`);
  const data = (await res.json()) as { features?: any[] };
  const features = (data.features || []).slice(0, 35);

  return features
    .filter((f) => f.geometry?.coordinates && typeof f.properties?.magnitude === 'number')
    .map((f) => {
      const [lon, lat] = f.geometry.coordinates as [number, number];
      const p = f.properties;
      const mag = Number(p.magnitude);
      const depthKm = Number(p.depth ?? 10);
      const mmi = typeof p.mmi === 'number' && p.mmi > 0 ? p.mmi : null;
      const { severity, bulletinType } = classifySeverityAndBulletin(mag, depthKm, false, null, mmi);

      return {
        id: `geonet-${p.publicID}`,
        agency: 'GeoNet',
        agencyName: 'GeoNet / GNS Science (Nueva Zelanda)',
        contributor: 'GeoNet',
        place: String(p.locality || 'Nueva Zelanda'),
        country: 'Nueva Zelanda',
        regionKey: 'oceania',
        magnitude: Number(mag.toFixed(1)),
        magType: 'ML',
        depthKm: Number(depthKm.toFixed(1)),
        lat,
        lon,
        timestamp: new Date(p.time).toISOString(),
        status: p.quality === 'best' ? 'REVISADO' : 'PRELIMINAR',
        bulletinType,
        severity,
        tsunamiWarning: false,
        mmi,
        sourceUrl: `https://www.geonet.org.nz/earthquake/${p.publicID}`,
      };
    });
}

async function fetchIgnSpain(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout('https://www.ign.es/ign/RssTools/sismologia.xml', 6000);
  if (!res.ok) throw new Error(`IGN HTTP ${res.status}`);
  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  const events: SeismicEvent[] = [];

  for (const item of items.slice(0, 30)) {
    const desc = decodeHtmlEntities(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '');
    const link = decodeHtmlEntities(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '');
    const lat = Number.parseFloat(item.match(/<geo:lat>([\s\S]*?)<\/geo:lat>/i)?.[1] || '');
    const lon = Number.parseFloat(item.match(/<geo:long>([\s\S]*?)<\/geo:long>/i)?.[1] || '');

    const m = desc.match(/magnitud\s+([\d.]+)\s+en\s+(.+?)\s+en\s+la\s+fecha\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/i);
    if (!m || Number.isNaN(lat) || Number.isNaN(lon)) continue;
    const mag = Number.parseFloat(m[1]);
    const place = m[2].trim();
    const iso = `${m[5]}-${m[4]}-${m[3]}T${m[6].padStart(2, '0')}:${m[7]}:${m[8]}+01:00`;
    const { severity, bulletinType } = classifySeverityAndBulletin(mag, 10, false);

    events.push({
      id: `ign-${m[5]}${m[4]}${m[3]}-${m[6]}${m[7]}${m[8]}-${lat.toFixed(2)}`,
      agency: 'IGN',
      agencyName: 'Instituto Geográfico Nacional (España)',
      contributor: 'IGN',
      place,
      country: 'España',
      regionKey: 'europe',
      magnitude: Number(mag.toFixed(1)),
      magType: 'mbLg',
      depthKm: 10,
      lat,
      lon,
      timestamp: new Date(iso).toISOString(),
      status: 'REVISADO',
      bulletinType,
      severity,
      tsunamiWarning: false,
      sourceUrl: link || 'https://www.ign.es/web/ign/portal/sis-catalogo-terremotos',
    });
  }
  return events;
}

async function fetchBmkgIndonesia(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', 6000);
  if (!res.ok) throw new Error(`BMKG HTTP ${res.status}`);
  const data = (await res.json()) as { Infogempa?: { gempa?: any[] } };
  const list = data.Infogempa?.gempa || [];
  const events: SeismicEvent[] = [];

  for (const g of list.slice(0, 25)) {
    const [latStr, lonStr] = String(g.Coordinates || '').split(',');
    const lat = Number.parseFloat(latStr);
    const lon = Number.parseFloat(lonStr);
    const mag = Number.parseFloat(g.Magnitude);
    const depthKm = Number.parseFloat(String(g.Kedalaman || '10').replace(/[^\d.]/g, '')) || 10;
    if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(mag)) continue;

    const potensi = String(g.Potensi || '').toLowerCase();
    const tsunamiWarning = potensi.includes('tsunami') && !potensi.includes('tidak berpotensi');
    const { severity, bulletinType } = classifySeverityAndBulletin(mag, depthKm, tsunamiWarning);

    events.push({
      id: `bmkg-${g.DateTime}-${lat.toFixed(2)}-${lon.toFixed(2)}`,
      agency: 'BMKG',
      agencyName: 'BMKG (Indonesia)',
      contributor: 'BMKG-TEWS',
      place: String(g.Wilayah || 'Indonesia'),
      country: 'Indonesia',
      regionKey: 'asia_pacific',
      magnitude: Number(mag.toFixed(1)),
      magType: 'M',
      depthKm: Number(depthKm.toFixed(1)),
      lat,
      lon,
      timestamp: new Date(g.DateTime).toISOString(),
      status: 'REVISADO',
      bulletinType,
      severity,
      tsunamiWarning,
      sourceUrl: 'https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg',
    });
  }
  return events;
}

const CHILE_CITY_COORDS: Record<string, [number, number]> = {
  arica: [-18.478, -70.312],
  putre: [-18.196, -69.559],
  iquique: [-20.23, -70.135],
  pica: [-20.489, -69.329],
  camina: [-19.313, -69.426],
  'camiña': [-19.313, -69.426],
  quillagua: [-21.658, -69.535],
  tocopilla: [-22.092, -70.197],
  calama: [-22.456, -68.929],
  ollague: [-21.224, -68.254],
  'ollagüe': [-21.224, -68.254],
  socaire: [-23.592, -67.887],
  antofagasta: [-23.65, -70.4],
  taltal: [-25.408, -70.485],
  chanaral: [-26.348, -70.622],
  'chañaral': [-26.348, -70.622],
  copiapo: [-27.366, -70.332],
  'copiapó': [-27.366, -70.332],
  vallenar: [-28.576, -70.759],
  'la serena': [-29.902, -71.252],
  coquimbo: [-29.953, -71.339],
  ovalle: [-30.601, -71.2],
  illapel: [-31.633, -71.167],
  valparaiso: [-33.047, -71.612],
  'valparaíso': [-33.047, -71.612],
  'vina del mar': [-33.015, -71.55],
  santiago: [-33.448, -70.669],
  rancagua: [-34.17, -70.744],
  pichilemu: [-34.385, -72.005],
  curico: [-34.985, -71.239],
  talca: [-35.426, -71.655],
  chillan: [-36.606, -72.103],
  concepcion: [-36.827, -73.049],
  'concepción': [-36.827, -73.049],
  lebu: [-37.608, -73.653],
  temuco: [-38.735, -72.59],
  valdivia: [-39.819, -73.245],
  osorno: [-40.573, -73.133],
  'puerto montt': [-41.469, -72.942],
  castro: [-42.482, -73.764],
  coyhaique: [-45.575, -72.066],
  'punta arenas': [-53.163, -70.917],
};

function resolveChileLocation(ref: string): [number, number] {
  const lower = ref.toLowerCase();
  for (const [city, coords] of Object.entries(CHILE_CITY_COORDS)) {
    if (lower.includes(city)) {
      // Apply subtle deterministic offset based on direction words
      const kmMatch = lower.match(/(\d+)\s*km/);
      const km = kmMatch ? Math.min(180, Number(kmMatch[1])) : 25;
      const deg = km / 111;
      let dLat = 0;
      let dLon = 0;
      if (lower.includes(' al n ') || lower.includes(' al ne ') || lower.includes(' al no ') || lower.includes('norte')) dLat += deg * 0.7;
      if (lower.includes(' al s ') || lower.includes(' al se ') || lower.includes(' al so ') || lower.includes('sur')) dLat -= deg * 0.7;
      if (lower.includes(' al e ') || lower.includes(' al ne ') || lower.includes(' al se ') || lower.includes('este')) dLon += deg * 0.7;
      if (lower.includes(' al o ') || lower.includes(' al no ') || lower.includes(' al so ') || lower.includes('oeste')) dLon -= deg * 0.7;
      return [Number((coords[0] + dLat).toFixed(3)), Number((coords[1] + dLon).toFixed(3))];
    }
  }
  return [-33.448, -70.669];
}

async function fetchCsnChile(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout('https://api.gael.cloud/general/public/sismos', 6000);
  if (!res.ok) throw new Error(`CSN HTTP ${res.status}`);
  const list = (await res.json()) as any[];
  const events: SeismicEvent[] = [];

  for (const item of list.slice(0, 20)) {
    const mag = Number.parseFloat(item.Magnitud);
    const depthKm = Number.parseFloat(item.Profundidad) || 30;
    const place = String(item.RefGeografica || 'Chile');
    if (Number.isNaN(mag)) continue;
    const [lat, lon] = resolveChileLocation(place);
    // Chile local time ~ UTC-3 (summer)
    const timestampStr = String(item.Fecha || '').replace(' ', 'T') + '-03:00';
    const d = new Date(timestampStr);
    const timestamp = Number.isNaN(d.getTime())
      ? new Date(item.FechaUpdate || Date.now()).toISOString()
      : d.toISOString();
    const { severity, bulletinType } = classifySeverityAndBulletin(mag, depthKm, false);

    events.push({
      id: `csn-${item.Fecha}-${mag}-${place.slice(0, 12)}`.replace(/\s+/g, '_'),
      agency: 'CSN',
      agencyName: 'Centro Sismológico Nacional (Universidad de Chile)',
      contributor: 'CSN-UCHILE',
      place,
      country: 'Chile',
      regionKey: 'latam',
      magnitude: Number(mag.toFixed(1)),
      magType: 'Ml',
      depthKm: Number(depthKm.toFixed(1)),
      lat,
      lon,
      timestamp,
      status: 'REVISADO',
      bulletinType,
      severity,
      tsunamiWarning: false,
      sourceUrl: 'https://www.sismologia.cl/',
    });
  }
  return events;
}

async function fetchSgcColombiaRegional(): Promise<SeismicEvent[]> {
  // Query EMSC & USGS specifically for Colombia / Northern Andes box (-4.5..13.5 lat, -82..-66 lon)
  const [emscRes, usgsRes] = await Promise.allSettled([
    fetchEmsc(
      'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minlat=-4.5&maxlat=13.5&minlon=-82&maxlon=-66&limit=20'
    ),
    fetchUsgs(
      'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=-4.5&maxlatitude=13.5&minlongitude=-82&maxlongitude=-66&limit=20'
    ),
  ]);

  const combined: SeismicEvent[] = [];
  if (emscRes.status === 'fulfilled') combined.push(...emscRes.value);
  if (usgsRes.status === 'fulfilled') combined.push(...usgsRes.value);

  const sgcMap = new Map<string, SeismicEvent>();
  for (const ev of combined) {
    const isCol =
      ev.place.toLowerCase().includes('colombia') ||
      (ev.lat >= -2 && ev.lat <= 12.5 && ev.lon >= -79.5 && ev.lon <= -67);
    if (!isCol) continue;
    const sgcEv: SeismicEvent = {
      ...ev,
      id: `sgc-${ev.id}`,
      agency: 'SGC' as AgencyId,
      agencyName: 'Servicio Geológico Colombiano (Red Sismológica)',
      contributor: ev.contributor ? `SGC / ${ev.contributor}` : 'SGC-RSNC',
      country: 'Colombia',
      regionKey: 'latam',
      sourceUrl: 'https://www.sgc.gov.co/sismos',
    };
    if (!sgcMap.has(sgcEv.id)) {
      sgcMap.set(sgcEv.id, sgcEv);
    }
  }
  return [...sgcMap.values()];
}

let cacheData: { response: { events: SeismicEvent[]; agencies: AgencyStatus[]; updatedAt: string }; ts: number } | null =
  null;
const CACHE_TTL_MS = 40_000;

const AGENCY_DIRECTORY: Array<Omit<AgencyStatus, 'status' | 'eventCount' | 'lastEventAt'>> = [
  {
    id: 'IGC-UPA',
    name: 'Instituto de Geociencias de la Universidad de Panamá',
    shortName: 'IGC-UPA',
    country: 'Panamá',
    coverage: 'Panamá y Frontera Costa Rica / Darién',
    sourceUrl: 'https://sismosgeociencias.up.ac.pa/',
    notes: 'Red sismológica nacional oficial de Panamá (7 días en vivo).',
  },
  {
    id: 'USGS',
    name: 'United States Geological Survey',
    shortName: 'USGS',
    country: 'EE. UU. / Global',
    coverage: 'Cobertura Sísmica Global y Alertas PAGER/Tsunami',
    sourceUrl: 'https://earthquake.usgs.gov/',
    notes: 'Catálogo global en tiempo real, MMI y nivel de alerta PAGER.',
  },
  {
    id: 'EMSC',
    name: 'European-Mediterranean Seismological Centre',
    shortName: 'EMSC',
    country: 'Europa / Global',
    coverage: 'Europa, Mediterráneo y Red Mundial FDSN',
    sourceUrl: 'https://www.seismicportal.eu/',
    notes: 'Centro euro-mediterráneo de respuesta rápida y reportes ciudadanos.',
  },
  {
    id: 'SSN',
    name: 'Servicio Sismológico Nacional (UNAM)',
    shortName: 'SSN México',
    country: 'México',
    coverage: 'República Mexicana y Pacífico Mexicano',
    sourceUrl: 'http://www.ssn.unam.mx/',
    notes: 'Boletines oficiales de la UNAM en México.',
  },
  {
    id: 'SGC',
    name: 'Servicio Geológico Colombiano',
    shortName: 'SGC Colombia',
    country: 'Colombia',
    coverage: 'Andes del Norte, Caribe y Pacífico Colombiano',
    sourceUrl: 'https://www.sgc.gov.co/sismos',
    notes: 'Monitoreo regional de Colombia (Nido de Bucaramanga y costa Pacífica).',
  },
  {
    id: 'CSN',
    name: 'Centro Sismológico Nacional (U. de Chile)',
    shortName: 'CSN Chile',
    country: 'Chile',
    coverage: 'Zona de Subducción Chilena (Arica a Magallanes)',
    sourceUrl: 'https://www.sismologia.cl/',
    notes: 'Red sismológica nacional de Chile.',
  },
  {
    id: 'NRCan',
    name: 'Natural Resources Canada',
    shortName: 'NRCan Canadá',
    country: 'Canadá',
    coverage: 'Canadá, Cascadia y Ártico',
    sourceUrl: 'https://www.earthquakescanada.nrcan.gc.ca/',
    notes: 'Servicio sísmico federal canadiense (FDSN).',
  },
  {
    id: 'JMA',
    name: 'Japan Meteorological Agency',
    shortName: 'JMA Japón',
    country: 'Japón',
    coverage: 'Archipiélago Japonés y Fosa de Japón',
    sourceUrl: 'https://www.jma.go.jp/',
    notes: 'Alertas sísmicas de Japón, escala Shindo y avisos de tsunami.',
  },
  {
    id: 'INGV',
    name: 'Istituto Nazionale di Geofisica e Vulcanologia',
    shortName: 'INGV Italia',
    country: 'Italia',
    coverage: 'Península Itálica, Etna y Mediterráneo Central',
    sourceUrl: 'https://terremoti.ingv.it/',
    notes: 'Monitoreo sismológico y volcánico italiano.',
  },
  {
    id: 'GeoNet',
    name: 'GeoNet / GNS Science',
    shortName: 'GeoNet NZ',
    country: 'Nueva Zelanda',
    coverage: 'Nueva Zelanda y Fosa de Kermadec',
    sourceUrl: 'https://www.geonet.org.nz/',
    notes: 'Red de amenazas geológicas de Nueva Zelanda.',
  },
  {
    id: 'IGN',
    name: 'Instituto Geográfico Nacional',
    shortName: 'IGN España',
    country: 'España',
    coverage: 'Península Ibérica, Canarias y Mar de Alborán',
    sourceUrl: 'https://www.ign.es/',
    notes: 'Red Sísmica Nacional de España.',
  },
  {
    id: 'BMKG',
    name: 'BMKG Indonesia',
    shortName: 'BMKG',
    country: 'Indonesia',
    coverage: 'Archipiélago Indonesio y Océano Índico',
    sourceUrl: 'https://www.bmkg.go.id/',
    notes: 'Sistema de alerta temprana sísmica y de tsunami (InaTEWS).',
  },
];

async function collectAllFeeds() {
  const now = Date.now();
  if (cacheData && now - cacheData.ts < CACHE_TTL_MS) {
    return cacheData.response;
  }

  const tasks: Array<{ id: AgencyId; promise: Promise<SeismicEvent[]> }> = [
    { id: 'IGC-UPA', promise: fetchIgcPanama() },
    { id: 'USGS', promise: fetchUsgs() },
    { id: 'EMSC', promise: fetchEmsc() },
    { id: 'SSN', promise: fetchSsnMexico() },
    { id: 'SGC', promise: fetchSgcColombiaRegional() },
    { id: 'CSN', promise: fetchCsnChile() },
    { id: 'NRCan', promise: fetchNrcanCanada() },
    { id: 'JMA', promise: fetchJmaJapan() },
    { id: 'INGV', promise: fetchIngvItaly() },
    { id: 'GeoNet', promise: fetchGeoNetNz() },
    { id: 'IGN', promise: fetchIgnSpain() },
    { id: 'BMKG', promise: fetchBmkgIndonesia() },
  ];

  const settled = await Promise.allSettled(tasks.map((t) => t.promise));
  const dedupedEvents = new Map<string, SeismicEvent>();
  const agencyHealth = new Map<AgencyId, { ok: boolean; events: SeismicEvent[] }>();

  settled.forEach((result, idx) => {
    const agencyId = tasks[idx].id;
    if (result.status === 'fulfilled') {
      const uniqueAgencyEvents = new Map<string, SeismicEvent>();
      for (const ev of result.value) {
        if (!uniqueAgencyEvents.has(ev.id)) {
          uniqueAgencyEvents.set(ev.id, ev);
        }
        if (!dedupedEvents.has(ev.id)) {
          dedupedEvents.set(ev.id, ev);
        }
      }
      const list = [...uniqueAgencyEvents.values()];
      agencyHealth.set(agencyId, { ok: true, events: list });
    } else {
      agencyHealth.set(agencyId, { ok: false, events: [] });
    }
  });

  const allEvents = [...dedupedEvents.values()];
  // Sort newest first
  allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const agencies: AgencyStatus[] = AGENCY_DIRECTORY.map((meta) => {
    const h = agencyHealth.get(meta.id);
    const evs = h?.events || [];
    const sorted = [...evs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return {
      ...meta,
      status: h?.ok && evs.length > 0 ? 'online' : 'degraded',
      eventCount: evs.length,
      lastEventAt: sorted[0]?.timestamp || null,
    };
  });

  const response = {
    events: allEvents,
    agencies,
    updatedAt: new Date().toISOString(),
  };

  cacheData = { response, ts: Date.now() };
  return response;
}

const REGION_BOUNDS: Record<Exclude<RegionKey, 'all'>, { minLat: number; maxLat: number; minLon: number; maxLon: number }> = {
  panama: { minLat: 5.0, maxLat: 11.8, minLon: -86.5, maxLon: -76.5 },
  latam: { minLat: -58, maxLat: 22, minLon: -115, maxLon: -34 },
  north_america: { minLat: 14, maxLat: 75, minLon: -170, maxLon: -50 },
  europe: { minLat: 28, maxLat: 72, minLon: -30, maxLon: 45 },
  asia_pacific: { minLat: -15, maxLat: 65, minLon: 65, maxLon: 180 },
  oceania: { minLat: -55, maxLat: 0, minLon: 110, maxLon: 180 },
};

async function startServer() {
  const app = express();

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/quakes', async (_req, res) => {
    try {
      const data = await collectAllFeeds();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'No se pudieron obtener los boletines sísmicos.' });
    }
  });

  app.get('/api/quakes/history', async (req, res) => {
    try {
      const startParam = String(req.query.start || '');
      const endParam = String(req.query.end || '');
      const minMag = Math.max(0, Number.parseFloat(String(req.query.minMag || '0')) || 0);
      const maxMag = Math.min(10, Number.parseFloat(String(req.query.maxMag || '10')) || 10);
      const region = String(req.query.region || 'all') as RegionKey;
      const agency = String(req.query.agency || 'all');
      const severity = String(req.query.severity || 'all');
      const searchQ = String(req.query.q || '').trim().toLowerCase();

      const now = new Date();
      const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startDate = startParam ? new Date(`${startParam}T00:00:00Z`) : defaultStart;
      const endDate = endParam ? new Date(`${endParam}T23:59:59Z`) : now;

      const startIso = Number.isNaN(startDate.getTime())
        ? defaultStart.toISOString()
        : startDate.toISOString();
      const endIso = Number.isNaN(endDate.getTime()) ? now.toISOString() : endDate.toISOString();

      let bboxQueryUsgs = '';
      let bboxQueryEmsc = '';
      if (region !== 'all' && REGION_BOUNDS[region]) {
        const b = REGION_BOUNDS[region];
        bboxQueryUsgs = `&minlatitude=${b.minLat}&maxlatitude=${b.maxLat}&minlongitude=${b.minLon}&maxlongitude=${b.maxLon}`;
        bboxQueryEmsc = `&minlat=${b.minLat}&maxlat=${b.maxLat}&minlon=${b.minLon}&maxlon=${b.maxLon}`;
      }

      const usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${encodeURIComponent(
        startIso
      )}&endtime=${encodeURIComponent(endIso)}&minmagnitude=${minMag}${bboxQueryUsgs}&limit=250`;

      const emscUrl = `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&start=${encodeURIComponent(
        startIso
      )}&end=${encodeURIComponent(endIso)}&minmag=${minMag}${bboxQueryEmsc}&limit=200`;

      const [liveData, histUsgs, histEmsc] = await Promise.allSettled([
        collectAllFeeds(),
        fetchUsgs(usgsUrl),
        fetchEmsc(emscUrl),
      ]);

      const merged = new Map<string, SeismicEvent>();
      if (liveData.status === 'fulfilled') {
        for (const ev of liveData.value.events) merged.set(ev.id, ev);
      }
      if (histUsgs.status === 'fulfilled') {
        for (const ev of histUsgs.value) merged.set(ev.id, ev);
      }
      if (histEmsc.status === 'fulfilled') {
        for (const ev of histEmsc.value) merged.set(ev.id, ev);
      }

      const startMs = new Date(startIso).getTime();
      const endMs = new Date(endIso).getTime();

      const filtered = [...merged.values()]
        .filter((ev) => {
          const ts = new Date(ev.timestamp).getTime();
          if (ts < startMs || ts > endMs) return false;
          if (ev.magnitude < minMag || ev.magnitude > maxMag) return false;
          if (region !== 'all' && ev.regionKey !== region) return false;
          if (agency !== 'all' && ev.agency !== agency) return false;
          if (severity !== 'all' && ev.severity !== severity) return false;
          if (searchQ) {
            const hay = `${ev.place} ${ev.country} ${ev.agency} ${ev.agencyName}`.toLowerCase();
            if (!hay.includes(searchQ)) return false;
          }
          return true;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 450);

      res.json({
        events: filtered,
        total: filtered.length,
        range: { start: startIso, end: endIso },
      });
    } catch (err) {
      res.status(500).json({ error: 'Error consultando el historial sísmico.' });
    }
  });

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'Endpoint de API no encontrado.' });
  });

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.npm_lifecycle_event === 'start';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const indexHtmlPath = path.join(distPath, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
      console.warn(
        'Advertencia: dist/index.html no encontrado. Ejecuta "npm run build" antes de iniciar en producción.'
      );
    }
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      if (fs.existsSync(indexHtmlPath)) {
        res.sendFile(indexHtmlPath);
      } else {
        res.status(503).send('Aplicación aún no compilada. Ejecuta npm run build.');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `GeoAlert server listening on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`
    );
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();

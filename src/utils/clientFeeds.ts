import type {
  AgencyId,
  AgencyStatus,
  BulletinType,
  QuakesApiResponse,
  RegionKey,
  SeismicEvent,
  SeverityLevel,
} from '../types/seismic';

const REGION_BOUNDS: Record<
  Exclude<RegionKey, 'all'>,
  { minLat: number; maxLat: number; minLon: number; maxLon: number }
> = {
  panama: { minLat: 5.0, maxLat: 11.8, minLon: -86.5, maxLon: -76.5 },
  latam: { minLat: -58, maxLat: 22, minLon: -115, maxLon: -34 },
  north_america: { minLat: 14, maxLat: 75, minLon: -170, maxLon: -50 },
  europe: { minLat: 28, maxLat: 72, minLon: -30, maxLon: 45 },
  asia_pacific: { minLat: -15, maxLat: 65, minLon: 65, maxLon: 180 },
  oceania: { minLat: -55, maxLat: 0, minLon: 110, maxLon: 180 },
};

const AGENCY_DIRECTORY: Array<Omit<AgencyStatus, 'status' | 'eventCount' | 'lastEventAt'>> = [
  {
    id: 'IGC-UPA',
    name: 'Instituto de Geociencias de la Universidad de Panamá',
    shortName: 'IGC-UPA',
    country: 'Panamá',
    coverage: 'Panamá y Frontera Costa Rica / Darién',
    sourceUrl: 'https://sismosgeociencias.up.ac.pa/',
    notes: 'Red sismológica nacional oficial de Panamá.',
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
    notes: 'Monitoreo regional de México y Pacífico Mexicano.',
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
    notes: 'Monitoreo regional de Chile y zona andina sur.',
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

async function fetchWithTimeout(url: string, ms = 7000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function classifyRegion(lat: number, lon: number, place: string): Exclude<RegionKey, 'all'> {
  const lower = place.toLowerCase();
  if (
    lower.includes('panama') ||
    lower.includes('panamá') ||
    lower.includes('chiriqui') ||
    lower.includes('darien') ||
    lower.includes('azuero') ||
    (lat >= 5.5 && lat <= 10.6 && lon >= -84.5 && lon <= -76.8)
  ) {
    return 'panama';
  }
  if (lat >= -58 && lat <= 22 && lon >= -115 && lon <= -34) return 'latam';
  if (lat > 14 && lat <= 75 && lon >= -170 && lon <= -50) return 'north_america';
  if (lat >= 28 && lat <= 72 && lon >= -30 && lon <= 45) return 'europe';
  if (lat >= -55 && lat <= 0 && (lon >= 110 || lon <= -170)) return 'oceania';
  return 'asia_pacific';
}

function classifySeverityAndBulletin(
  mag: number,
  depthKm: number,
  tsunamiWarning: boolean,
  alertColor?: string | null,
  mmi?: number | null
): { severity: SeverityLevel; bulletinType: BulletinType } {
  let severity: SeverityLevel = 'Bajo';
  if (
    tsunamiWarning ||
    mag >= 6.5 ||
    alertColor === 'red' ||
    (typeof mmi === 'number' && mmi >= 7)
  ) {
    severity = 'Crítico';
  } else if (
    mag >= 5.3 ||
    alertColor === 'orange' ||
    (typeof mmi === 'number' && mmi >= 5.5)
  ) {
    severity = 'Alto';
  } else if (mag >= 4.0 || (mag >= 3.5 && depthKm <= 20)) {
    severity = 'Moderado';
  }

  let bulletinType: BulletinType = 'Boletín';
  if (tsunamiWarning || severity === 'Crítico' || (severity === 'Alto' && mag >= 5.5)) {
    bulletinType = 'Alerta';
  } else if (severity === 'Alto' || (severity === 'Moderado' && mag >= 4.4)) {
    bulletinType = 'Aviso';
  }

  return { severity, bulletinType };
}

function inferCountry(place: string, fallback: string): string {
  const parts = place.split(',');
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  return fallback;
}

async function fetchUsgsClient(url?: string): Promise<SeismicEvent[]> {
  const endpoint =
    url || 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=80';
  const res = await fetchWithTimeout(endpoint, 7000);
  if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);
  const data = (await res.json()) as { features?: any[] };
  return (data.features || [])
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
        status: p.status === 'reviewed' ? 'REVISADO' : 'AUTOMÁTICO',
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

async function fetchEmscClient(url?: string): Promise<SeismicEvent[]> {
  const endpoint =
    url || 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=80';
  const res = await fetchWithTimeout(endpoint, 7000);
  if (!res.ok) throw new Error(`EMSC HTTP ${res.status}`);
  const data = (await res.json()) as { features?: any[] };
  return (data.features || [])
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

async function fetchGeoNetClient(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout('https://api.geonet.org.nz/quake?MMI=1', 6500);
  if (!res.ok) throw new Error(`GeoNet HTTP ${res.status}`);
  const data = (await res.json()) as { features?: any[] };
  return (data.features || [])
    .slice(0, 35)
    .filter((f) => f.geometry?.coordinates && typeof f.properties?.magnitude === 'number')
    .map((f) => {
      const [lon, lat] = f.geometry.coordinates as [number, number];
      const p = f.properties;
      const mag = Number(p.magnitude);
      const depthKm = Number(p.depth ?? 10);
      const mmi = typeof p.mmi === 'number' && p.mmi > 0 ? p.mmi : null;
      const { severity, bulletinType } = classifySeverityAndBulletin(
        mag,
        depthKm,
        false,
        null,
        mmi
      );
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

async function fetchJmaClient(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout('https://api.p2pquake.net/v2/history?codes=551&limit=30', 6500);
  if (!res.ok) throw new Error(`JMA HTTP ${res.status}`);
  const list = (await res.json()) as any[];
  const events: SeismicEvent[] = [];
  for (const item of list) {
    const hypo = item.earthquake?.hypocenter;
    if (!hypo || typeof hypo.latitude !== 'number' || typeof hypo.longitude !== 'number') continue;
    if (hypo.latitude < -90 || hypo.longitude < -180 || hypo.magnitude < 0) continue;
    const mag = Number(hypo.magnitude);
    const depthKm = Number(hypo.depth >= 0 ? hypo.depth : 10);
    const timeStr =
      String(item.earthquake.time || '').replace(/\//g, '-').replace(' ', 'T') + '+09:00';
    const d = new Date(timeStr);
    const timestamp = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    const domTsunami = String(item.earthquake.domesticTsunami || 'None');
    const tsunamiWarning =
      domTsunami !== 'None' && domTsunami !== 'Unknown' && domTsunami !== 'Checking';
    const maxScale = typeof item.earthquake.maxScale === 'number' ? item.earthquake.maxScale : -1;
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

async function fetchIngvClient(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout(
    'https://webservices.ingv.it/fdsnws/event/1/query?format=text&limit=35',
    6500
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

async function fetchNrcanClient(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout(
    'https://earthquakescanada.nrcan.gc.ca/fdsnws/event/1/query?format=text&limit=35',
    6500
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
      sourceUrl: 'https://www.earthquakescanada.nrcan.gc.ca/stndon/NEDB-BNDS/bulletin-en.php',
    });
  }
  return events;
}

async function fetchBmkgClient(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout(
    'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json',
    6500
  );
  if (!res.ok) throw new Error(`BMKG HTTP ${res.status}`);
  const data = (await res.json()) as { Infogempa?: { gempa?: any[] } };
  const events: SeismicEvent[] = [];
  for (const g of (data.Infogempa?.gempa || []).slice(0, 25)) {
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

async function fetchIgnClient(): Promise<SeismicEvent[]> {
  const res = await fetchWithTimeout('https://www.ign.es/ign/RssTools/sismologia.xml', 6500);
  if (!res.ok) throw new Error(`IGN HTTP ${res.status}`);
  const xml = await res.text();
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const items = Array.from(doc.querySelectorAll('item')).slice(0, 30);
  const events: SeismicEvent[] = [];
  for (const item of items) {
    const desc = item.querySelector('description')?.textContent || '';
    const link = item.querySelector('link')?.textContent || '';
    const latText =
      item.getElementsByTagName('geo:lat')[0]?.textContent ||
      item.getElementsByTagName('lat')[0]?.textContent ||
      '';
    const lonText =
      item.getElementsByTagName('geo:long')[0]?.textContent ||
      item.getElementsByTagName('long')[0]?.textContent ||
      '';
    const lat = Number.parseFloat(latText);
    const lon = Number.parseFloat(lonText);
    const m = desc.match(
      /magnitud\s+([\d.]+)\s+en\s+(.+?)\s+en\s+la\s+fecha\s+(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/i
    );
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

async function fetchRegionalFromFdsn(params: {
  agency: AgencyId;
  agencyName: string;
  country: string;
  regionKey: Exclude<RegionKey, 'all'>;
  sourceUrl: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  filterFn?: (ev: SeismicEvent) => boolean;
}): Promise<SeismicEvent[]> {
  const [emscRes, usgsRes] = await Promise.allSettled([
    fetchEmscClient(
      `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&minlat=${params.minLat}&maxlat=${params.maxLat}&minlon=${params.minLon}&maxlon=${params.maxLon}&limit=20`
    ),
    fetchUsgsClient(
      `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=${params.minLat}&maxlatitude=${params.maxLat}&minlongitude=${params.minLon}&maxlongitude=${params.maxLon}&limit=20`
    ),
  ]);

  const combined: SeismicEvent[] = [];
  if (emscRes.status === 'fulfilled') combined.push(...emscRes.value);
  if (usgsRes.status === 'fulfilled') combined.push(...usgsRes.value);

  const map = new Map<string, SeismicEvent>();
  for (const ev of combined) {
    if (params.filterFn && !params.filterFn(ev)) continue;
    const item: SeismicEvent = {
      ...ev,
      id: `${params.agency.toLowerCase()}-${ev.id}`,
      agency: params.agency,
      agencyName: params.agencyName,
      contributor: ev.contributor ? `${params.agency} / ${ev.contributor}` : params.agency,
      country: params.country,
      regionKey: params.regionKey,
      sourceUrl: params.sourceUrl,
    };
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return [...map.values()];
}

export async function collectClientFeeds(): Promise<QuakesApiResponse> {
  const tasks: Array<{ id: AgencyId; promise: Promise<SeismicEvent[]> }> = [
    {
      id: 'IGC-UPA',
      promise: fetchRegionalFromFdsn({
        agency: 'IGC-UPA',
        agencyName: 'Instituto de Geociencias (Universidad de Panamá)',
        country: 'Panamá',
        regionKey: 'panama',
        sourceUrl: 'https://sismosgeociencias.up.ac.pa/',
        minLat: 5.5,
        maxLat: 11.2,
        minLon: -84.5,
        maxLon: -76.8,
      }),
    },
    { id: 'USGS', promise: fetchUsgsClient() },
    { id: 'EMSC', promise: fetchEmscClient() },
    {
      id: 'SSN',
      promise: fetchRegionalFromFdsn({
        agency: 'SSN',
        agencyName: 'Servicio Sismológico Nacional (UNAM, México)',
        country: 'México',
        regionKey: 'latam',
        sourceUrl: 'http://www.ssn.unam.mx/',
        minLat: 14.0,
        maxLat: 32.8,
        minLon: -118.0,
        maxLon: -86.5,
      }),
    },
    {
      id: 'SGC',
      promise: fetchRegionalFromFdsn({
        agency: 'SGC',
        agencyName: 'Servicio Geológico Colombiano (Red Sismológica)',
        country: 'Colombia',
        regionKey: 'latam',
        sourceUrl: 'https://www.sgc.gov.co/sismos',
        minLat: -4.5,
        maxLat: 13.5,
        minLon: -82.0,
        maxLon: -66.0,
        filterFn: (ev) =>
          ev.place.toLowerCase().includes('colombia') ||
          (ev.lat >= -2 && ev.lat <= 12.5 && ev.lon >= -79.5 && ev.lon <= -67),
      }),
    },
    {
      id: 'CSN',
      promise: fetchRegionalFromFdsn({
        agency: 'CSN',
        agencyName: 'Centro Sismológico Nacional (Universidad de Chile)',
        country: 'Chile',
        regionKey: 'latam',
        sourceUrl: 'https://www.sismologia.cl/',
        minLat: -56.0,
        maxLat: -17.5,
        minLon: -76.5,
        maxLon: -66.0,
      }),
    },
    { id: 'NRCan', promise: fetchNrcanClient() },
    { id: 'JMA', promise: fetchJmaClient() },
    { id: 'INGV', promise: fetchIngvClient() },
    { id: 'GeoNet', promise: fetchGeoNetClient() },
    { id: 'IGN', promise: fetchIgnClient() },
    { id: 'BMKG', promise: fetchBmkgClient() },
  ];

  const settled = await Promise.allSettled(tasks.map((t) => t.promise));
  const dedupedEvents = new Map<string, SeismicEvent>();
  const agencyHealth = new Map<AgencyId, { ok: boolean; events: SeismicEvent[] }>();

  settled.forEach((result, idx) => {
    const agencyId = tasks[idx].id;
    if (result.status === 'fulfilled') {
      const uniqueAgencyEvents = new Map<string, SeismicEvent>();
      for (const ev of result.value) {
        if (!uniqueAgencyEvents.has(ev.id)) uniqueAgencyEvents.set(ev.id, ev);
        if (!dedupedEvents.has(ev.id)) dedupedEvents.set(ev.id, ev);
      }
      agencyHealth.set(agencyId, { ok: true, events: [...uniqueAgencyEvents.values()] });
    } else {
      agencyHealth.set(agencyId, { ok: false, events: [] });
    }
  });

  const allEvents = [...dedupedEvents.values()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

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

  return {
    events: allEvents,
    agencies,
    updatedAt: new Date().toISOString(),
  };
}

export async function queryClientHistory(params: {
  startDate: string;
  endDate: string;
  region: RegionKey;
  agency: AgencyId | 'all';
  severity: SeverityLevel | 'all';
  minMag: number;
  searchQuery: string;
  initialEvents: SeismicEvent[];
}): Promise<SeismicEvent[]> {
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startD = params.startDate ? new Date(`${params.startDate}T00:00:00Z`) : defaultStart;
  const endD = params.endDate ? new Date(`${params.endDate}T23:59:59Z`) : now;

  const startIso = Number.isNaN(startD.getTime()) ? defaultStart.toISOString() : startD.toISOString();
  const endIso = Number.isNaN(endD.getTime()) ? now.toISOString() : endD.toISOString();

  let bboxUsgs = '';
  let bboxEmsc = '';
  if (params.region !== 'all' && REGION_BOUNDS[params.region]) {
    const b = REGION_BOUNDS[params.region];
    bboxUsgs = `&minlatitude=${b.minLat}&maxlatitude=${b.maxLat}&minlongitude=${b.minLon}&maxlongitude=${b.maxLon}`;
    bboxEmsc = `&minlat=${b.minLat}&maxlat=${b.maxLat}&minlon=${b.minLon}&maxlon=${b.maxLon}`;
  }

  const usgsUrl = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${encodeURIComponent(
    startIso
  )}&endtime=${encodeURIComponent(endIso)}&minmagnitude=${params.minMag}${bboxUsgs}&limit=250`;
  const emscUrl = `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&start=${encodeURIComponent(
    startIso
  )}&end=${encodeURIComponent(endIso)}&minmag=${params.minMag}${bboxEmsc}&limit=200`;

  const [histUsgs, histEmsc] = await Promise.allSettled([
    fetchUsgsClient(usgsUrl),
    fetchEmscClient(emscUrl),
  ]);

  const merged = new Map<string, SeismicEvent>();
  for (const ev of params.initialEvents) merged.set(ev.id, ev);
  if (histUsgs.status === 'fulfilled') {
    for (const ev of histUsgs.value) merged.set(ev.id, ev);
  }
  if (histEmsc.status === 'fulfilled') {
    for (const ev of histEmsc.value) merged.set(ev.id, ev);
  }

  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const q = params.searchQuery.trim().toLowerCase();

  return [...merged.values()]
    .filter((ev) => {
      const ts = new Date(ev.timestamp).getTime();
      if (ts < startMs || ts > endMs) return false;
      if (ev.magnitude < params.minMag) return false;
      if (params.region !== 'all' && ev.regionKey !== params.region) return false;
      if (params.agency !== 'all' && ev.agency !== params.agency) return false;
      if (params.severity !== 'all' && ev.severity !== params.severity) return false;
      if (q) {
        const hay = `${ev.place} ${ev.country} ${ev.agency} ${ev.agencyName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 450);
}

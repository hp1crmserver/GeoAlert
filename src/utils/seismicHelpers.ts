import type {
  AgencyId,
  BulletinType,
  EsriLayerId,
  RegionKey,
  SeverityLevel,
} from '../types/seismic';

export interface EsriLayerConfig {
  id: EsriLayerId;
  label: string;
  url: string;
  labelsUrl?: string;
  attribution: string;
  isDark: boolean;
}

export const ESRI_LAYERS: Record<EsriLayerId, EsriLayerConfig> = {
  dark_gray: {
    id: 'dark_gray',
    label: 'Esri Gris Oscuro',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labelsUrl:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    isDark: true,
  },
  light_gray: {
    id: 'light_gray',
    label: 'Esri Gris Claro',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labelsUrl:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    isDark: false,
  },
  imagery: {
    id: 'imagery',
    label: 'Esri Satelital',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelsUrl:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    isDark: true,
  },
  topo: {
    id: 'topo',
    label: 'Esri Topográfico',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, USGS, NOAA',
    isDark: false,
  },
  ocean: {
    id: 'ocean',
    label: 'Esri Batimetría Oceánica',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    labelsUrl:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU',
    isDark: false,
  },
  streets: {
    id: 'streets',
    label: 'Esri Calles y Vialidad',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, USGS',
    isDark: false,
  },
  natgeo: {
    id: 'natgeo',
    label: 'Esri National Geographic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; National Geographic, Esri, Garmin',
    isDark: false,
  },
};

export const SEVERITY_CONFIG: Record<
  SeverityLevel,
  {
    label: string;
    glyph: string;
    colorHex: string;
    ringHex: string;
    textClass: string;
    surfaceClass: string;
    description: string;
  }
> = {
  Crítico: {
    label: 'Crítico',
    glyph: '▲',
    colorHex: '#DC2626',
    ringHex: '#EF4444',
    textClass: 'text-red-600 dark:text-red-400',
    surfaceClass:
      'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30',
    description: 'Evento mayor o con potencial de tsunami / daños severos.',
  },
  Alto: {
    label: 'Alto',
    glyph: '◆',
    colorHex: '#D97706',
    ringHex: '#F59E0B',
    textClass: 'text-amber-600 dark:text-amber-400',
    surfaceClass:
      'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30',
    description: 'Sismo fuerte perceptible ampliamente en zonas pobladas.',
  },
  Moderado: {
    label: 'Moderado',
    glyph: '●',
    colorHex: '#0284C7',
    ringHex: '#0EA5E9',
    textClass: 'text-sky-600 dark:text-sky-400',
    surfaceClass:
      'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30',
    description: 'Sismo moderado de seguimiento instrumental y regional.',
  },
  Bajo: {
    label: 'Bajo',
    glyph: '○',
    colorHex: '#059669',
    ringHex: '#10B981',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    surfaceClass:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
    description: 'Microsismo o evento menor sin impacto significativo.',
  },
};

export const BULLETIN_CONFIG: Record<
  BulletinType,
  { label: string; textClass: string }
> = {
  Alerta: {
    label: 'Alerta Sísmica',
    textClass: 'text-red-600 dark:text-red-400',
  },
  Aviso: {
    label: 'Aviso Oficial',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  Boletín: {
    label: 'Boletín Técnico',
    textClass: 'text-sky-600 dark:text-sky-400',
  },
  Notificación: {
    label: 'Notificación',
    textClass: 'text-slate-600 dark:text-slate-400',
  },
};

export const REGION_OPTIONS: Array<{
  key: RegionKey;
  label: string;
  center: [number, number];
  zoom: number;
}> = [
  { key: 'all', label: 'Global', center: [14, -30], zoom: 2 },
  { key: 'panama', label: 'Panamá y Centroamérica', center: [8.4, -80.4], zoom: 7 },
  { key: 'latam', label: 'Latinoamérica', center: [-14, -72], zoom: 3 },
  { key: 'north_america', label: 'Norteamérica', center: [44, -104], zoom: 3 },
  { key: 'europe', label: 'Europa y Mediterráneo', center: [42, 12], zoom: 4 },
  { key: 'asia_pacific', label: 'Asia y Pacífico', center: [20, 128], zoom: 4 },
  { key: 'oceania', label: 'Oceanía', center: [-36, 172], zoom: 5 },
];

export const AGENCY_LABELS: Record<AgencyId, string> = {
  'IGC-UPA': 'IGC-UPA Panamá',
  USGS: 'USGS EE. UU.',
  EMSC: 'EMSC Europa',
  SSN: 'SSN México',
  SGC: 'SGC Colombia',
  CSN: 'CSN Chile',
  NRCan: 'NRCan Canadá',
  JMA: 'JMA Japón',
  INGV: 'INGV Italia',
  GeoNet: 'GeoNet NZ',
  IGN: 'IGN España',
  BMKG: 'BMKG Indonesia',
};

export function formatCoords(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'O';
  return `${Math.abs(lat).toFixed(3)}° ${latDir}, ${Math.abs(lon).toFixed(3)}° ${lonDir}`;
}

export function formatUtcTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

export function formatLocalTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

export function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr} h`;
  const diffDays = Math.floor(diffHr / 24);
  return `hace ${diffDays} d`;
}

export function classifyDepthLabel(depthKm: number): string {
  if (depthKm < 70) return 'Superficial (< 70 km)';
  if (depthKm < 300) return 'Intermedio (70–300 km)';
  return 'Profundo (> 300 km)';
}

export interface MercalliInfo {
  level: number;
  roman: string;
  label: string;
  effect: string;
  colorClass: string;
  colorHex: string;
  isInstrumental: boolean;
}

const MERCALLI_SCALE: Array<{
  roman: string;
  label: string;
  effect: string;
  colorClass: string;
  colorHex: string;
}> = [
  {
    roman: 'I',
    label: 'No sentido',
    effect: 'Detectado solo por sismógrafos sensibles.',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    colorHex: '#059669',
  },
  {
    roman: 'II',
    label: 'Muy débil',
    effect: 'Sentido por personas en reposo en pisos altos.',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    colorHex: '#059669',
  },
  {
    roman: 'III',
    label: 'Débil',
    effect: 'Perceptible en interiores; vibración como camión ligero.',
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    colorHex: '#10B981',
  },
  {
    roman: 'IV',
    label: 'Ligero',
    effect: 'Puertas y ventanas vibran; objetos colgantes oscilan.',
    colorClass: 'text-sky-600 dark:text-sky-400',
    colorHex: '#0284C7',
  },
  {
    roman: 'V',
    label: 'Moderado',
    effect: 'Sentido por casi todos; platos y cristales pueden vibrar.',
    colorClass: 'text-sky-600 dark:text-sky-400',
    colorHex: '#0EA5E9',
  },
  {
    roman: 'VI',
    label: 'Fuerte',
    effect: 'Sentido por todos; muebles ligeros se desplazan.',
    colorClass: 'text-amber-600 dark:text-amber-400',
    colorHex: '#D97706',
  },
  {
    roman: 'VII',
    label: 'Muy fuerte',
    effect: 'Difícil mantenerse en pie; daños leves en mampostería.',
    colorClass: 'text-amber-600 dark:text-amber-400',
    colorHex: '#F59E0B',
  },
  {
    roman: 'VIII',
    label: 'Severo',
    effect: 'Daños moderados en estructuras ordinarias; caída de muros.',
    colorClass: 'text-red-600 dark:text-red-400',
    colorHex: '#DC2626',
  },
  {
    roman: 'IX',
    label: 'Violento',
    effect: 'Daños considerables en edificios y tuberías subterráneas.',
    colorClass: 'text-red-600 dark:text-red-400',
    colorHex: '#DC2626',
  },
  {
    roman: 'X',
    label: 'Extremo',
    effect: 'Destrucción de estructuras; grietas visibles en el suelo.',
    colorClass: 'text-red-700 dark:text-red-400',
    colorHex: '#B91C1C',
  },
  {
    roman: 'XI',
    label: 'Catastrófico',
    effect: 'Colapso generalizado de infraestructura y puentes.',
    colorClass: 'text-red-700 dark:text-red-400',
    colorHex: '#991B1B',
  },
  {
    roman: 'XII',
    label: 'Total',
    effect: 'Destrucción total; ondas sísmicas visibles en superficie.',
    colorClass: 'text-red-800 dark:text-red-300',
    colorHex: '#7F1D1D',
  },
];

export function getMercalliInfo(event: {
  magnitude: number;
  depthKm: number;
  mmi?: number | null;
}): MercalliInfo {
  const isInstrumental = typeof event.mmi === 'number' && event.mmi >= 1;
  let rawLevel: number;

  if (isInstrumental) {
    rawLevel = Math.round(event.mmi as number);
  } else {
    // Epicentral Mercalli intensity estimation from magnitude and hypocentral depth
    const hypocentralAttenuation = 1.6 * Math.log10(Math.max(10, event.depthKm) / 10);
    const estimated = 1.5 * event.magnitude - 1.2 - hypocentralAttenuation;
    rawLevel = Math.round(estimated);
  }

  const level = Math.max(1, Math.min(12, rawLevel));
  const meta = MERCALLI_SCALE[level - 1];
  return {
    level,
    roman: meta.roman,
    label: meta.label,
    effect: meta.effect,
    colorClass: meta.colorClass,
    colorHex: meta.colorHex,
    isInstrumental,
  };
}

export function buildEventShareText(event: {
  agency: string;
  agencyName: string;
  bulletinType: string;
  severity: string;
  magnitude: number;
  magType: string;
  depthKm: number;
  place: string;
  country: string;
  lat: number;
  lon: number;
  timestamp: string;
  tsunamiWarning: boolean;
  mmi?: number | null;
}): string {
  const mmi = getMercalliInfo(event);
  const tsunami = event.tsunamiWarning ? ' | ⚠ Aviso de Tsunami' : '';
  return [
    `${event.bulletinType.toUpperCase()} SÍSMICA · Nivel ${event.severity}`,
    `Magnitud: M ${event.magnitude.toFixed(1)} ${event.magType}`,
    `Intensidad Mercalli (MMI): ${mmi.roman} (${mmi.label})`,
    `Ubicación: ${event.place} (${event.country})`,
    `Profundidad: ${event.depthKm.toFixed(1)} km | Coords: ${formatCoords(event.lat, event.lon)}`,
    `Fecha UTC: ${formatUtcTime(event.timestamp)}`,
    `Agencia: ${event.agencyName} (${event.agency})${tsunami}`,
  ].join('\n');
}


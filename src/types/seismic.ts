export type AgencyId =
  | 'IGC-UPA'
  | 'USGS'
  | 'EMSC'
  | 'SSN'
  | 'SGC'
  | 'CSN'
  | 'NRCan'
  | 'JMA'
  | 'INGV'
  | 'GeoNet'
  | 'IGN'
  | 'BMKG';

export type BulletinType = 'Alerta' | 'Aviso' | 'Boletín' | 'Notificación';

export type SeverityLevel = 'Crítico' | 'Alto' | 'Moderado' | 'Bajo';

export type RegionKey =
  | 'all'
  | 'panama'
  | 'latam'
  | 'north_america'
  | 'europe'
  | 'asia_pacific'
  | 'oceania';

export type EsriLayerId =
  | 'dark_gray'
  | 'light_gray'
  | 'imagery'
  | 'topo'
  | 'ocean'
  | 'streets'
  | 'natgeo';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface SeismicEvent {
  id: string;
  agency: AgencyId;
  agencyName: string;
  contributor?: string;
  place: string;
  country: string;
  regionKey: Exclude<RegionKey, 'all'>;
  magnitude: number;
  magType: string;
  depthKm: number;
  lat: number;
  lon: number;
  timestamp: string; // ISO 8601 UTC
  status: 'REVISADO' | 'PRELIMINAR' | 'AUTOMÁTICO';
  bulletinType: BulletinType;
  severity: SeverityLevel;
  tsunamiWarning: boolean;
  mmi?: number | null;
  alertColor?: string | null;
  feltReports?: number | null;
  sourceUrl?: string;
}

export interface AgencyStatus {
  id: AgencyId;
  name: string;
  shortName: string;
  country: string;
  coverage: string;
  status: 'online' | 'degraded';
  eventCount: number;
  lastEventAt: string | null;
  sourceUrl: string;
  notes?: string;
}

export interface QuakesApiResponse {
  events: SeismicEvent[];
  agencies: AgencyStatus[];
  updatedAt: string;
}

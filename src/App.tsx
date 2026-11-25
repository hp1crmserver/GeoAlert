import {
  BellRing,
  FileDown,
  Monitor,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AgenciesView from './components/AgenciesView';
import AlertToastStack, { type VisualAlertItem } from './components/AlertToastStack';
import BulletinStudio from './components/BulletinStudio';
import EventInspector from './components/EventInspector';
import GeoAlertIcon from './components/GeoAlertIcon';
import HistoryView from './components/HistoryView';
import SeismicMap from './components/SeismicMap';
import ShareEventMenu from './components/ShareEventMenu';
import type {
  AgencyId,
  AgencyStatus,
  BulletinType,
  EsriLayerId,
  QuakesApiResponse,
  RegionKey,
  SeismicEvent,
  SeverityLevel,
  ThemeMode,
} from './types/seismic';
import { generateEventCard45 } from './utils/cardGenerator45';
import { exportEventPdf } from './utils/pdfExporter';
import {
  AGENCY_LABELS,
  BULLETIN_CONFIG,
  SEVERITY_CONFIG,
  formatRelativeTime,
  getMercalliInfo,
} from './utils/seismicHelpers';
import { playSeismicAlertSound } from './utils/soundAlerts';

type ActiveTab = 'monitor' | 'history' | 'agencies' | 'studio';

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return true;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('monitor');

  // Theme state: light | dark | system
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('sismowatch_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'system';
  });
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => resolveIsDark(themeMode));

  // Esri map layer
  const [esriLayer, setEsriLayer] = useState<EsriLayerId>(() =>
    resolveIsDark(themeMode) ? 'dark_gray' : 'light_gray'
  );

  // Live seismic data
  const [events, setEvents] = useState<SeismicEvent[]>([]);
  const [agencies, setAgencies] = useState<AgencyStatus[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Selected event & map state
  const [selectedEvent, setSelectedEvent] = useState<SeismicEvent | null>(null);
  const [activeRegion, setActiveRegion] = useState<RegionKey>('all');
  const [focusNonce, setFocusNonce] = useState<number>(0);

  // Live feed filters
  const [agencyFilter, setAgencyFilter] = useState<AgencyId | 'all'>('all');
  const [bulletinFilter, setBulletinFilter] = useState<BulletinType | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'all'>('all');
  const [minMagFilter, setMinMagFilter] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Visual & Auditory alert settings
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    return localStorage.getItem('sismowatch_audio') !== 'false';
  });
  const [alertThreshold, setAlertThreshold] = useState<number>(4.5);
  const [visualAlerts, setVisualAlerts] = useState<VisualAlertItem[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const firstLoadDoneRef = useRef<boolean>(false);

  // Apply theme mode & listen to system changes
  useEffect(() => {
    localStorage.setItem('sismowatch_theme', themeMode);
    const apply = () => {
      const dark = resolveIsDark(themeMode);
      setIsDarkTheme(dark);
      document.documentElement.classList.toggle('dark', dark);
      setEsriLayer((prev) => {
        if (prev === 'dark_gray' && !dark) return 'light_gray';
        if (prev === 'light_gray' && dark) return 'dark_gray';
        return prev;
      });
    };
    apply();

    if (themeMode !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => apply();
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('sismowatch_audio', String(audioEnabled));
  }, [audioEnabled]);

  const pushVisualAlert = useCallback(
    (event: SeismicEvent, isTest = false) => {
      const uid = `${event.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setVisualAlerts((prev) => [{ uid, event, isTest }, ...prev].slice(0, 4));
      if (audioEnabled) {
        playSeismicAlertSound(isTest ? 'test' : event.bulletinType);
      }
      setTimeout(() => {
        setVisualAlerts((prev) => prev.filter((item) => item.uid !== uid));
      }, 10_000);
    },
    [audioEnabled]
  );

  const fetchQuakes = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/quakes');
      if (!res.ok) throw new Error('Error de red al consultar boletines');
      const data = (await res.json()) as QuakesApiResponse;
      const incoming = data.events || [];
      setEvents(incoming);
      setAgencies(data.agencies || []);
      setUpdatedAt(data.updatedAt);

      setSelectedEvent((prev) => {
        if (prev) {
          const updated = incoming.find((e) => e.id === prev.id);
          if (updated) return updated;
        }
        return (
          incoming.find((e) => e.agency === 'IGC-UPA' && e.magnitude >= 3.0) ||
          incoming.find((e) => e.magnitude >= 4.5) ||
          incoming[0] ||
          null
        );
      });

      // Notify only for genuinely new events after initial load
      if (!firstLoadDoneRef.current) {
        incoming.forEach((e) => seenIdsRef.current.add(e.id));
        firstLoadDoneRef.current = true;
      } else {
        const freshSignificant = incoming.filter(
          (e) => !seenIdsRef.current.has(e.id) && e.magnitude >= alertThreshold
        );
        incoming.forEach((e) => seenIdsRef.current.add(e.id));
        if (freshSignificant.length > 0) {
          pushVisualAlert(freshSignificant[0], false);
        }
      }
    } catch {
      setFetchError('No se pudo actualizar el flujo sísmico. Reintentando automáticamente.');
    } finally {
      setLoading(false);
    }
  }, [alertThreshold, pushVisualAlert]);

  useEffect(() => {
    fetchQuakes();
    const timer = setInterval(fetchQuakes, 45_000);
    return () => clearInterval(timer);
  }, [fetchQuakes]);

  const filteredLiveEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((ev) => {
      if (activeRegion !== 'all' && ev.regionKey !== activeRegion) return false;
      if (agencyFilter !== 'all' && ev.agency !== agencyFilter) return false;
      if (bulletinFilter !== 'all' && ev.bulletinType !== bulletinFilter) return false;
      if (severityFilter !== 'all' && ev.severity !== severityFilter) return false;
      if (ev.magnitude < minMagFilter) return false;
      if (q) {
        const hay = `${ev.place} ${ev.country} ${ev.agency} ${ev.agencyName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    events,
    activeRegion,
    agencyFilter,
    bulletinFilter,
    severityFilter,
    minMagFilter,
    searchQuery,
  ]);

  const handleSelectAndFocus = useCallback((ev: SeismicEvent) => {
    setSelectedEvent(ev);
    setActiveTab('monitor');
    setFocusNonce((n) => n + 1);
  }, []);

  const handleOpenStudio45 = useCallback((ev: SeismicEvent) => {
    setSelectedEvent(ev);
    setActiveTab('studio');
  }, []);

  const handleExportSinglePdf = useCallback(
    async (ev: SeismicEvent | null) => {
      const target = ev || selectedEvent || events[0];
      if (!target) return;
      try {
        const cardUrl = await generateEventCard45(target, {
          style: isDarkTheme ? 'dark' : 'light',
          esriLayer,
        });
        exportEventPdf(target, cardUrl);
      } catch {
        exportEventPdf(target);
      }
    },
    [selectedEvent, events, isDarkTheme, esriLayer]
  );

  const handleTestAlert = () => {
    const sample =
      selectedEvent ||
      events.find((e) => e.magnitude >= 4.5) ||
      events[0] || {
        id: 'test-alert',
        agency: 'IGC-UPA' as const,
        agencyName: 'Instituto de Geociencias (Universidad de Panamá)',
        place: 'Región Fronteriza Panamá - Costa Rica',
        country: 'Panamá',
        regionKey: 'panama' as const,
        magnitude: 5.4,
        magType: 'Mw',
        depthKm: 18,
        lat: 8.322,
        lon: -82.813,
        timestamp: new Date().toISOString(),
        status: 'REVISADO' as const,
        bulletinType: 'Alerta' as const,
        severity: 'Alto' as const,
        tsunamiWarning: false,
      };
    pushVisualAlert(sample, true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar: Strict 3-Zone Contract */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Brand icon + wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('monitor')}
            className="inline-flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <GeoAlertIcon className="h-6 w-6 shrink-0" />
            <span>GeoAlert</span>
          </button>

          {/* Zone 2: 4 concise single-line text nav links */}
          <nav
            aria-label="Navegación principal"
            className="flex items-center gap-4 sm:gap-6 overflow-x-auto text-sm font-medium"
          >
            {(
              [
                { id: 'monitor', label: 'Monitor en Vivo' },
                { id: 'history', label: 'Historial' },
                { id: 'agencies', label: 'Agencias' },
                { id: 'studio', label: 'Estudio 4:5' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-sky-600 dark:border-sky-400 text-slate-900 dark:text-white font-semibold'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0 hidden sm:block">
            <button
              type="button"
              onClick={() => handleExportSinglePdf(selectedEvent)}
              disabled={!selectedEvent && events.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Exportar Reporte</span>
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Control Toolbar */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Theme Mode & Audio Alerts */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Theme Selector: Claro / Oscuro / Sistema */}
            <div
              role="group"
              aria-label="Modo de tema"
              className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              {(
                [
                  { id: 'light', label: 'Claro', Icon: Sun },
                  { id: 'dark', label: 'Oscuro', Icon: Moon },
                  { id: 'system', label: 'Sistema', Icon: Monitor },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setThemeMode(id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    themeMode === id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Audio Alert Toggle & Threshold */}
            <button
              type="button"
              onClick={() => setAudioEnabled((a) => !a)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                audioEnabled
                  ? 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {audioEnabled ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
              <span>{audioEnabled ? 'Audio Activo' : 'Silenciado'}</span>
            </button>

            <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <label htmlFor="alert-threshold" className="whitespace-nowrap">
                Alerta desde:
              </label>
              <select
                id="alert-threshold"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(Number(e.target.value))}
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-mono font-medium text-slate-900 dark:text-slate-100"
              >
                <option value={3.5}>M ≥ 3.5</option>
                <option value={4.5}>M ≥ 4.5</option>
                <option value={5.5}>M ≥ 5.5</option>
                <option value={6.0}>M ≥ 6.0</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleTestAlert}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BellRing className="h-3.5 w-3.5" />
              <span>Probar Alerta</span>
            </button>
          </div>

          {/* Right: Sync Status & Refresh */}
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            {updatedAt && (
              <span className="font-mono tabular-nums hidden md:inline">
                Última sincronización: {formatRelativeTime(updatedAt)}
              </span>
            )}
            <button
              type="button"
              onClick={fetchQuakes}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 sm:px-6 py-5">
        {fetchError && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
            {fetchError}
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left Feed Column */}
            <aside className="lg:col-span-4 xl:col-span-4 flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden max-h-[820px]">
              {/* Feed Filter Header */}
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h1 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Alertas, Avisos y Boletines
                  </h1>
                  <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    {filteredLiveEvents.length} eventos
                  </span>
                </div>

                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar país, región o ciudad..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <select
                    aria-label="Filtrar por agencia"
                    value={agencyFilter}
                    onChange={(e) => setAgencyFilter(e.target.value as AgencyId | 'all')}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 truncate"
                  >
                    <option value="all">Agencias: Todas</option>
                    {Object.entries(AGENCY_LABELS).map(([id, lbl]) => (
                      <option key={id} value={id}>
                        {lbl}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filtrar por tipo de emisión"
                    value={bulletinFilter}
                    onChange={(e) => setBulletinFilter(e.target.value as BulletinType | 'all')}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 truncate"
                  >
                    <option value="all">Tipos: Todos</option>
                    <option value="Alerta">Alertas</option>
                    <option value="Aviso">Avisos</option>
                    <option value="Boletín">Boletines</option>
                    <option value="Notificación">Notificaciones</option>
                  </select>

                  <select
                    aria-label="Filtrar por magnitud mínima"
                    value={minMagFilter}
                    onChange={(e) => setMinMagFilter(Number(e.target.value))}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-xs font-mono font-medium text-slate-800 dark:text-slate-100"
                  >
                    <option value={0}>Mag: Todas</option>
                    <option value={2.5}>M ≥ 2.5</option>
                    <option value={3.5}>M ≥ 3.5</option>
                    <option value={4.5}>M ≥ 4.5</option>
                    <option value={5.5}>M ≥ 5.5</option>
                    <option value={6.5}>M ≥ 6.5</option>
                  </select>
                </div>

                {/* Severity quick tabs */}
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-x-auto">
                  {(['all', 'Crítico', 'Alto', 'Moderado', 'Bajo'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSeverityFilter(lvl)}
                      className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        severityFilter === lvl
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {lvl === 'all' ? 'Todos' : lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Event List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {loading && filteredLiveEvents.length === 0 ? (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="animate-pulse space-y-2 py-2">
                        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-5/6" />
                      </div>
                    ))}
                  </div>
                ) : filteredLiveEvents.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No hay boletines que coincidan con los filtros seleccionados.
                  </div>
                ) : (
                  filteredLiveEvents.slice(0, 120).map((ev) => {
                    const sev = SEVERITY_CONFIG[ev.severity];
                    const bul = BULLETIN_CONFIG[ev.bulletinType];
                    const mmi = getMercalliInfo(ev);
                    const isSelected = selectedEvent?.id === ev.id;
                    return (
                      <div
                        key={ev.id}
                        className={`flex items-start gap-1.5 px-3.5 py-3 transition-colors ${
                          isSelected
                            ? 'bg-sky-50 dark:bg-sky-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectAndFocus(ev)}
                          className="min-w-0 flex-1 flex items-start gap-3 text-left cursor-pointer"
                        >
                          <div className="w-12 shrink-0 pt-0.5 text-center">
                            <div className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white leading-none">
                              {ev.magnitude.toFixed(1)}
                            </div>
                            <div className="mt-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                              {ev.depthKm.toFixed(0)} km
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-1.5 text-[11px]">
                              <span className={`font-semibold ${sev.textClass}`}>
                                {sev.glyph} {ev.severity}
                              </span>
                              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                                ·
                              </span>
                              <span className={`font-medium ${bul.textClass}`}>
                                {ev.bulletinType}
                              </span>
                              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-mono text-slate-600 dark:text-slate-300">
                                {ev.agency}
                              </span>
                            </div>

                            <div className="mt-0.5 text-xs font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                              {ev.place}
                            </div>

                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                              <span className={`font-mono font-medium ${mmi.colorClass}`}>
                                MMI {mmi.roman} ({mmi.label})
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{ev.country}</span>
                              <span aria-hidden="true">·</span>
                              <span>{formatRelativeTime(ev.timestamp)}</span>
                              {ev.tsunamiWarning && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-semibold text-red-600 dark:text-red-400">
                                    Tsunami
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>

                        <div className="shrink-0 pt-0.5">
                          <ShareEventMenu event={ev} compact align="right" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Right Primary Map + Inspector */}
            <div className="lg:col-span-8 xl:col-span-8 flex flex-col gap-4">
              <div className="flex-1 min-h-[500px]">
                <SeismicMap
                  events={filteredLiveEvents}
                  selectedEvent={selectedEvent}
                  onSelectEvent={setSelectedEvent}
                  esriLayer={esriLayer}
                  onChangeLayer={setEsriLayer}
                  activeRegion={activeRegion}
                  onSelectRegion={setActiveRegion}
                  focusNonce={focusNonce}
                />
              </div>

              <EventInspector
                event={selectedEvent}
                onOpenStudio45={handleOpenStudio45}
                onExportPdf={handleExportSinglePdf}
                onFocusOnMap={handleSelectAndFocus}
              />
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryView
            initialEvents={events}
            isDarkTheme={isDarkTheme}
            onInspectOnMap={handleSelectAndFocus}
            onOpenStudio45={handleOpenStudio45}
          />
        )}

        {activeTab === 'agencies' && (
          <AgenciesView
            agencies={agencies}
            onFilterByAgency={(agId) => {
              setAgencyFilter(agId);
              setActiveRegion('all');
              setActiveTab('monitor');
            }}
          />
        )}

        {activeTab === 'studio' && (
          <BulletinStudio
            event={selectedEvent}
            events={events}
            onSelectEvent={setSelectedEvent}
            defaultEsriLayer={esriLayer}
          />
        )}
      </main>

      {/* Visual Alert Toast Stack */}
      <AlertToastStack
        alerts={visualAlerts}
        onDismiss={(uid) =>
          setVisualAlerts((prev) => prev.filter((item) => item.uid !== uid))
        }
        onInspect={handleSelectAndFocus}
      />
    </div>
  );
}

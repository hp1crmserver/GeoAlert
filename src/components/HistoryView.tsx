import {
  Calendar,
  Download,
  FileDown,
  Image as ImageIcon,
  MapPin,
  Search,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AgencyId,
  RegionKey,
  SeismicEvent,
  SeverityLevel,
} from '../types/seismic';
import { generateEventCard45, generateHistorySummaryCard45 } from '../utils/cardGenerator45';
import { exportEventPdf, exportHistoryPdf } from '../utils/pdfExporter';
import {
  AGENCY_LABELS,
  REGION_OPTIONS,
  SEVERITY_CONFIG,
  formatCoords,
  formatUtcTime,
  getMercalliInfo,
} from '../utils/seismicHelpers';
import ShareEventMenu from './ShareEventMenu';

interface HistoryViewProps {
  initialEvents: SeismicEvent[];
  isDarkTheme: boolean;
  onInspectOnMap: (event: SeismicEvent) => void;
  onOpenStudio45: (event: SeismicEvent) => void;
}

function daysAgoDateStr(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export default function HistoryView({
  initialEvents,
  isDarkTheme,
  onInspectOnMap,
  onOpenStudio45,
}: HistoryViewProps) {
  const [startDate, setStartDate] = useState<string>(() => daysAgoDateStr(7));
  const [endDate, setEndDate] = useState<string>(() => daysAgoDateStr(0));
  const [region, setRegion] = useState<RegionKey>('all');
  const [agency, setAgency] = useState<AgencyId | 'all'>('all');
  const [severity, setSeverity] = useState<SeverityLevel | 'all'>('all');
  const [minMag, setMinMag] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'time' | 'mag'>('time');

  const [events, setEvents] = useState<SeismicEvent[]>(initialEvents);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
        region,
        agency,
        severity,
        minMag: String(minMag),
        q: searchQuery,
      });
      const res = await fetch(`/api/quakes/history?${params.toString()}`);
      if (!res.ok) throw new Error('Error consultando el servidor');
      const data = (await res.json()) as { events: SeismicEvent[] };
      setEvents(data.events || []);
      setPage(1);
    } catch {
      setError('No se pudo cargar el historial remoto. Mostrando catálogo local filtrado.');
      setEvents(initialEvents);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, region, agency, severity, minMag, searchQuery, initialEvents]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const sortedEvents = useMemo(() => {
    const list = [...events];
    if (sortBy === 'mag') {
      list.sort((a, b) => b.magnitude - a.magnitude);
    } else {
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return list;
  }, [events, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / pageSize));
  const visibleRows = sortedEvents.slice((page - 1) * pageSize, page * pageSize);

  const stats = useMemo(() => {
    const maxMag = sortedEvents.reduce((m, e) => Math.max(m, e.magnitude), 0);
    const highCrit = sortedEvents.filter(
      (e) => e.severity === 'Crítico' || e.severity === 'Alto'
    ).length;
    const agenciesSet = new Set(sortedEvents.map((e) => e.agency)).size;
    return { total: sortedEvents.length, maxMag, highCrit, agenciesSet };
  }, [sortedEvents]);

  const applyPreset = (days: number) => {
    setStartDate(daysAgoDateStr(days));
    setEndDate(daysAgoDateStr(0));
  };

  const regionLabel =
    REGION_OPTIONS.find((r) => r.key === region)?.label || 'Global';

  const handleExportHistoryPdf = () => {
    exportHistoryPdf(sortedEvents, {
      startDate,
      endDate,
      regionLabel,
      agency: agency === 'all' ? 'Todas' : agency,
      severity: severity === 'all' ? 'Todos' : severity,
      minMag,
    });
  };

  const handleExportHistoryImage = () => {
    const summaryText = `${startDate} a ${endDate} · ${regionLabel} · ${
      agency === 'all' ? 'Todas las agencias' : agency
    }`;
    const dataUrl = generateHistorySummaryCard45(
      sortedEvents,
      summaryText,
      isDarkTheme ? 'dark' : 'light'
    );
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `resumen-historico-4x5-${startDate}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSinglePdf = async (ev: SeismicEvent) => {
    try {
      const cardUrl = await generateEventCard45(ev, {
        style: isDarkTheme ? 'dark' : 'light',
      });
      exportEventPdf(ev, cardUrl);
    } catch {
      exportEventPdf(ev);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filter Toolbar */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Historial Sísmico y Análisis de Riesgo
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Filtra registros históricos por rango de fechas, región geográfica, agencia y nivel de severidad para exportar reportes en PDF o imagen.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportHistoryImage}
              disabled={sortedEvents.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exportar Imagen 4:5</span>
            </button>

            <button
              type="button"
              onClick={handleExportHistoryPdf}
              disabled={sortedEvents.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Exportar Reporte PDF</span>
            </button>
          </div>
        </div>

        {/* Date presets + date pickers + search */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="lg:col-span-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1 inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Período:
            </span>
            {[
              { label: '24h', days: 1 },
              { label: '7 días', days: 7 },
              { label: '30 días', days: 30 },
            ].map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => applyPreset(p.days)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  startDate === daysAgoDateStr(p.days) && endDate === daysAgoDateStr(0)
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="hist-start" className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
              Desde
            </label>
            <input
              id="hist-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="hist-end" className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
              Hasta
            </label>
            <input
              id="hist-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="hist-search" className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
              Buscar por lugar, país o región
            </label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                id="hist-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Panamá, Chiriquí, México, Japón..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Region, Agency, MinMag, Severity */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-3">
            <label htmlFor="hist-region" className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
              Región Geográfica
            </label>
            <select
              id="hist-region"
              value={region}
              onChange={(e) => setRegion(e.target.value as RegionKey)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100"
            >
              {REGION_OPTIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="hist-agency" className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
              Agencia Emisora
            </label>
            <select
              id="hist-agency"
              value={agency}
              onChange={(e) => setAgency(e.target.value as AgencyId | 'all')}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100"
            >
              <option value="all">Todas las agencias</option>
              {Object.entries(AGENCY_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label htmlFor="hist-minmag" className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
              Magnitud Mínima
            </label>
            <select
              id="hist-minmag"
              value={minMag}
              onChange={(e) => setMinMag(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono font-medium text-slate-900 dark:text-slate-100"
            >
              <option value={0}>Todas (M 0.0+)</option>
              <option value={2.5}>M 2.5+</option>
              <option value={4.0}>M 4.0+</option>
              <option value={5.0}>M 5.0+</option>
              <option value={6.0}>M 6.0+</option>
            </select>
          </div>

          <div className="lg:col-span-5">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
              Nivel de Severidad de Riesgo
            </span>
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              {(['all', 'Crítico', 'Alto', 'Moderado', 'Bajo'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSeverity(lvl)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    severity === lvl
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {lvl === 'all' ? 'Todos' : `${SEVERITY_CONFIG[lvl].glyph} ${lvl}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Eventos Filtrados
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {stats.total}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Magnitud Máxima
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {stats.total ? `M ${stats.maxMag.toFixed(1)}` : '—'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Riesgo Crítico / Alto
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {stats.highCrit}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Agencias con Reportes
          </div>
          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {stats.agenciesSet}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300">
          {error}
        </div>
      )}

      {/* Data Table */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {loading
              ? 'Consultando catálogos históricos FDSN…'
              : `Mostrando ${visibleRows.length} de ${sortedEvents.length} registros`}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Orden:</span>
            <button
              type="button"
              onClick={() => setSortBy('time')}
              className={`px-2 py-1 rounded text-xs font-medium cursor-pointer ${
                sortBy === 'time'
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Más recientes
            </button>
            <button
              type="button"
              onClick={() => setSortBy('mag')}
              className={`px-2 py-1 rounded text-xs font-medium cursor-pointer ${
                sortBy === 'mag'
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Mayor magnitud
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3 whitespace-nowrap">Fecha / Hora UTC</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-right">Mag</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Mercalli (MMI)</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-right">Prof.</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Severidad</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Agencia</th>
                <th className="py-2.5 px-3">Epicentro / Región</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Coordenadas</th>
                <th className="py-2.5 px-3 whitespace-nowrap text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {loading && visibleRows.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="py-3 px-3">
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 px-4 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    No se encontraron sismos con los filtros seleccionados. Ajusta el rango de fechas o reduce la magnitud mínima.
                  </td>
                </tr>
              ) : (
                visibleRows.map((ev) => {
                  const sev = SEVERITY_CONFIG[ev.severity];
                  const mmi = getMercalliInfo(ev);
                  return (
                    <tr
                      key={ev.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono text-[11px] tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatUtcTime(ev.timestamp)}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold tabular-nums text-right text-slate-900 dark:text-white whitespace-nowrap">
                        {ev.magnitude.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`font-mono font-semibold ${mmi.colorClass}`}>
                          {mmi.roman} · {mmi.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {ev.depthKm.toFixed(1)} km
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`font-medium ${sev.textClass}`}>
                          {sev.glyph} {ev.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {ev.agency}
                      </td>
                      <td className="py-2.5 px-3 min-w-[200px]">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {ev.place}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {ev.country} · {ev.bulletinType}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatCoords(ev.lat, ev.lon)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onInspectOnMap(ev)}
                            title="Ver en Mapa"
                            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenStudio45(ev)}
                            title="Generar Imagen 4:5"
                            className="p-1.5 rounded-md text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 cursor-pointer"
                          >
                            <ImageIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSinglePdf(ev)}
                            title="Exportar PDF"
                            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                          </button>
                          <ShareEventMenu event={ev} compact align="right" />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

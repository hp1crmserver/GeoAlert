import {
  Crosshair,
  ExternalLink,
  FileDown,
  Image as ImageIcon,
  Waves,
} from 'lucide-react';
import type { SeismicEvent } from '../types/seismic';
import {
  BULLETIN_CONFIG,
  SEVERITY_CONFIG,
  classifyDepthLabel,
  formatCoords,
  formatLocalTime,
  formatRelativeTime,
  formatUtcTime,
  getMercalliInfo,
} from '../utils/seismicHelpers';
import ShareEventMenu from './ShareEventMenu';

interface EventInspectorProps {
  event: SeismicEvent | null;
  onOpenStudio45: (event: SeismicEvent) => void;
  onExportPdf: (event: SeismicEvent) => void;
  onFocusOnMap: (event: SeismicEvent) => void;
}

export default function EventInspector({
  event,
  onOpenStudio45,
  onExportPdf,
  onFocusOnMap,
}: EventInspectorProps) {
  if (!event) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Selecciona un evento sísmico en la lista o en el mapa para inspeccionar su boletín completo.
      </div>
    );
  }

  const sev = SEVERITY_CONFIG[event.severity];
  const bul = BULLETIN_CONFIG[event.bulletinType];
  const mmi = getMercalliInfo(event);

  return (
    <section
      aria-label="Detalle del evento seleccionado"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5"
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span className={`font-semibold ${sev.textClass}`}>
              {sev.glyph} Nivel {sev.label}
            </span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className={`font-medium ${bul.textClass}`}>{bul.label}</span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-slate-600 dark:text-slate-300">
              {event.agency} ({event.status})
            </span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {formatRelativeTime(event.timestamp)}
            </span>
          </div>

          <div className="mt-2.5 flex items-baseline gap-3.5">
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                {event.magnitude.toFixed(1)}
              </span>
              <span className="font-mono text-xs font-medium text-slate-500 dark:text-slate-400">
                {event.magType}
              </span>
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white leading-snug">
                {event.place}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {event.agencyName} — {event.country}
              </p>
            </div>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onFocusOnMap(event)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Crosshair className="h-3.5 w-3.5" />
            <span>Centrar</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenStudio45(event)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 px-3.5 py-2 text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            <span>Imagen 4:5</span>
          </button>

          <button
            type="button"
            onClick={() => onExportPdf(event)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Exportar PDF</span>
          </button>

          <ShareEventMenu event={event} />

          {event.sourceUrl && (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Fuente</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* Telemetry data strip */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3.5 border-t border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Escala Mercalli (MMI)
          </div>
          <div className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${mmi.colorClass}`}>
            MMI {mmi.roman} · {mmi.label}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={mmi.effect}>
            {mmi.isInstrumental ? 'Instrumental · ' : 'Estimada · '}
            {mmi.effect}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Profundidad Focal
          </div>
          <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {event.depthKm.toFixed(1)} km
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {classifyDepthLabel(event.depthKm)}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Coordenadas
          </div>
          <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatCoords(event.lat, event.lon)}
          </div>
          <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {event.lat.toFixed(4)}, {event.lon.toFixed(4)}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Hora Local / UTC
          </div>
          <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {formatLocalTime(event.timestamp)}
          </div>
          <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {formatUtcTime(event.timestamp)}
          </div>
        </div>

        <div>
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Tsunami / Riesgo
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
            <Waves
              className={`h-4 w-4 shrink-0 ${
                event.tsunamiWarning
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            />
            <span
              className={
                event.tsunamiWarning
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-800 dark:text-slate-200'
              }
            >
              {event.tsunamiWarning ? 'Aviso Activo' : 'Sin Aviso'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {sev.description}
          </div>
        </div>
      </div>
    </section>
  );
}

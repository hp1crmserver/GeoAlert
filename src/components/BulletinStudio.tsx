import { Download, FileDown, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { EsriLayerId, SeismicEvent } from '../types/seismic';
import { generateEventCard45, type CardStyleMode } from '../utils/cardGenerator45';
import { exportEventPdf } from '../utils/pdfExporter';
import {
  ESRI_LAYERS,
  SEVERITY_CONFIG,
  formatCoords,
  formatUtcTime,
  getMercalliInfo,
} from '../utils/seismicHelpers';
import ShareEventMenu from './ShareEventMenu';

interface BulletinStudioProps {
  event: SeismicEvent | null;
  events: SeismicEvent[];
  onSelectEvent: (ev: SeismicEvent) => void;
  defaultEsriLayer: EsriLayerId;
}

export default function BulletinStudio({
  event,
  events,
  onSelectEvent,
  defaultEsriLayer,
}: BulletinStudioProps) {
  const [styleMode, setStyleMode] = useState<CardStyleMode>('dark');
  const [esriLayer, setEsriLayer] = useState<EsriLayerId>(
    defaultEsriLayer === 'light_gray' ? 'topo' : 'imagery'
  );
  const [customNote, setCustomNote] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const activeEvent = event || events[0] || null;

  useEffect(() => {
    if (!activeEvent) {
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    setRendering(true);

    generateEventCard45(activeEvent, {
      style: styleMode,
      esriLayer,
      customNote,
    })
      .then((url) => {
        if (!cancelled) {
          setPreviewUrl(url);
          setRendering(false);
        }
      })
      .catch(() => {
        if (!cancelled) setRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeEvent, styleMode, esriLayer, customNote]);

  const handleDownloadPng = () => {
    if (!previewUrl || !activeEvent) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = `sismo-4x5-${activeEvent.agency}-M${activeEvent.magnitude.toFixed(1)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPdf = () => {
    if (!activeEvent) return;
    exportEventPdf(activeEvent, previewUrl || undefined);
  };

  if (!activeEvent) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500 dark:text-slate-400">
        No hay eventos cargados para generar la tarjeta 4:5.
      </div>
    );
  }

  const sev = SEVERITY_CONFIG[activeEvent.severity];
  const mmi = getMercalliInfo(activeEvent);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Configuration Column */}
      <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Generador de Boletín Gráfico 4:5
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Renderizado exacto en proporción 4:5 (1080×1350 px) con mosaico cartográfico Esri y datos oficiales del evento seleccionado.
          </p>
        </div>

        {/* Event Selector */}
        <div>
          <label
            htmlFor="studio-event-select"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Evento Sísmico Seleccionado
          </label>
          <select
            id="studio-event-select"
            value={activeEvent.id}
            onChange={(e) => {
              const found = events.find((item) => item.id === e.target.value);
              if (found) onSelectEvent(found);
            }}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {events.slice(0, 60).map((ev) => (
              <option key={ev.id} value={ev.id}>
                M {ev.magnitude.toFixed(1)} · {ev.agency} · {ev.place.slice(0, 48)}
              </option>
            ))}
          </select>
        </div>

        {/* Selected Event Quick Summary */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className={`font-semibold ${sev.textClass}`}>
              {sev.glyph} {activeEvent.bulletinType} · {activeEvent.severity}
            </span>
            <span className="font-mono text-slate-500 dark:text-slate-400">
              {activeEvent.agency} · MMI {mmi.roman} ({mmi.label})
            </span>
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">
            M {activeEvent.magnitude.toFixed(1)} {activeEvent.magType} — {activeEvent.place}
          </div>
          <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {formatCoords(activeEvent.lat, activeEvent.lon)} · {activeEvent.depthKm.toFixed(1)} km ·{' '}
            {formatUtcTime(activeEvent.timestamp)}
          </div>
        </div>

        {/* Visual Theme of 4:5 Card */}
        <div>
          <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Estilo de Tarjeta 4:5
          </span>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            {(
              [
                { id: 'dark', label: 'Oscuro Técnico' },
                { id: 'light', label: 'Claro Editorial' },
                { id: 'alert', label: 'Alerta Crítica' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStyleMode(opt.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  styleMode === opt.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Esri Layer inside 4:5 Card */}
        <div>
          <label
            htmlFor="studio-esri-select"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Capa Cartográfica Esri en la Tarjeta
          </label>
          <select
            id="studio-esri-select"
            value={esriLayer}
            onChange={(e) => setEsriLayer(e.target.value as EsriLayerId)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {Object.values(ESRI_LAYERS).map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.label}
              </option>
            ))}
          </select>
        </div>

        {/* Optional Note */}
        <div>
          <label
            htmlFor="studio-note-input"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
          >
            Nota o Pie de Boletín (Opcional)
          </label>
          <input
            id="studio-note-input"
            type="text"
            maxLength={74}
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="Ej. Seguimiento preventivo en Chiriquí y zonas costeras"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Export Actions */}
        <div className="flex flex-wrap gap-2.5 pt-2">
          <button
            type="button"
            disabled={!previewUrl || rendering}
            onClick={handleDownloadPng}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 px-4 py-2.5 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Descargar Imagen 4:5 (PNG)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors whitespace-nowrap cursor-pointer"
          >
            <FileDown className="h-4 w-4" />
            <span>Exportar PDF</span>
          </button>

          <ShareEventMenu event={activeEvent} />
        </div>
      </div>

      {/* Right Live 4:5 Preview */}
      <div className="lg:col-span-7 flex flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-5 sm:p-8">
        <div className="w-full max-w-[440px]">
          <div className="flex items-center justify-between mb-2.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono">Vista previa · Ratio 4:5 (1080×1350)</span>
            {rendering && (
              <span className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Renderizando mapa Esri…
              </span>
            )}
          </div>

          <div className="aspect-[4/5] w-full overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 shadow-lg">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={`Boletín sísmico 4:5 para ${activeEvent.place}`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                Generando composición 4:5…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

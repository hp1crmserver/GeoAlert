import { BellRing, X } from 'lucide-react';
import type { SeismicEvent } from '../types/seismic';
import {
  SEVERITY_CONFIG,
  formatRelativeTime,
  getMercalliInfo,
} from '../utils/seismicHelpers';
import ShareEventMenu from './ShareEventMenu';

export interface VisualAlertItem {
  uid: string;
  event: SeismicEvent;
  isTest?: boolean;
}

interface AlertToastStackProps {
  alerts: VisualAlertItem[];
  onDismiss: (uid: string) => void;
  onInspect: (event: SeismicEvent) => void;
}

export default function AlertToastStack({
  alerts,
  onDismiss,
  onInspect,
}: AlertToastStackProps) {
  if (alerts.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-[900] flex w-[min(390px,calc(100vw-2rem))] flex-col gap-2.5"
    >
      {alerts.map(({ uid, event, isTest }) => {
        const sev = SEVERITY_CONFIG[event.severity];
        const mmi = getMercalliInfo(event);
        return (
          <div
            key={uid}
            role="alert"
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <BellRing className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                <span className={sev.textClass}>
                  {sev.glyph} {isTest ? 'Prueba de ' : ''}
                  {event.bulletinType} · Nivel {event.severity}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(uid)}
                aria-label="Cerrar notificación"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-1.5 flex items-baseline gap-2.5">
              <span className="font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                M {event.magnitude.toFixed(1)}
              </span>
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2">
                {event.place}
              </span>
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {event.agency} · MMI {mmi.roman} ({mmi.label}) ·{' '}
                {formatRelativeTime(event.timestamp)}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <ShareEventMenu event={event} compact align="right" />
                <button
                  type="button"
                  onClick={() => {
                    onInspect(event);
                    onDismiss(uid);
                  }}
                  className="font-medium text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Ver en mapa
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

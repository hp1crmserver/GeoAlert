import { ExternalLink, Filter } from 'lucide-react';
import type { AgencyId, AgencyStatus } from '../types/seismic';
import { formatRelativeTime } from '../utils/seismicHelpers';

interface AgenciesViewProps {
  agencies: AgencyStatus[];
  onFilterByAgency: (agencyId: AgencyId) => void;
}

export default function AgenciesView({
  agencies,
  onFilterByAgency,
}: AgenciesViewProps) {
  const onlineCount = agencies.filter((a) => a.status === 'online').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Red Global de Agencias Sismológicas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Conexión directa con institutos nacionales e internacionales de monitoreo sísmico y alerta temprana.
          </p>
        </div>
        <div className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
          {onlineCount} de {agencies.length} fuentes activas
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agencies.map((ag) => (
          <article
            key={ag.id}
            className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
          >
            <div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {ag.id} · {ag.country}
                </span>
                <span
                  className={`font-medium ${
                    ag.status === 'online'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {ag.status === 'online' ? '● Activa' : '▲ Sin datos recientes'}
                </span>
              </div>

              <h2 className="mt-2 text-base font-semibold text-slate-900 dark:text-white leading-snug">
                {ag.name}
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {ag.coverage}
              </p>
              {ag.notes && (
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {ag.notes}
                </p>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                {ag.eventCount} boletines
                {ag.lastEventAt ? ` · ${formatRelativeTime(ag.lastEventAt)}` : ''}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={ag.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  title="Portal oficial"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => onFilterByAgency(ag.id)}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-2.5 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer"
                >
                  <Filter className="h-3 w-3" />
                  <span>Ver sismos</span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

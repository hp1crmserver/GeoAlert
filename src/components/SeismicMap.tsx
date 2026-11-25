import L from 'leaflet';
import { Layers, Maximize2, Navigation } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { EsriLayerId, RegionKey, SeismicEvent } from '../types/seismic';
import {
  ESRI_LAYERS,
  REGION_OPTIONS,
  SEVERITY_CONFIG,
  buildEventShareText,
  formatCoords,
  formatUtcTime,
  getMercalliInfo,
} from '../utils/seismicHelpers';

interface SeismicMapProps {
  events: SeismicEvent[];
  selectedEvent: SeismicEvent | null;
  onSelectEvent: (ev: SeismicEvent) => void;
  esriLayer: EsriLayerId;
  onChangeLayer: (layer: EsriLayerId) => void;
  activeRegion: RegionKey;
  onSelectRegion: (region: RegionKey) => void;
  focusNonce: number;
}

const MAJOR_TECTONIC_FALLBACK: Array<Array<[number, number]>> = [
  // Cocos-Nazca-Caribbean-Panamá fracture & subduction arc
  [
    [16, -98],
    [12, -89],
    [8.5, -84],
    [7.2, -80.5],
    [6.5, -77.5],
    [1.5, -79.5],
    [-10, -79],
    [-25, -72],
    [-45, -75],
  ],
  // Caribbean plate north boundary
  [
    [15, -88],
    [18.5, -78],
    [19.2, -70],
    [18.5, -62],
    [12, -60],
    [10.5, -67],
    [9.5, -75],
    [8.5, -80],
  ],
  // Pacific Ring of Fire West (Kamchatka - Japan - Philippines - Indonesia)
  [
    [56, 162],
    [45, 150],
    [38, 143],
    [32, 138],
    [22, 122],
    [12, 126],
    [2, 126],
    [-6, 105],
    [-9, 118],
  ],
  // Mid-Atlantic Ridge
  [
    [64, -22],
    [45, -28],
    [28, -44],
    [10, -40],
    [-10, -14],
    [-35, -16],
  ],
];

export default function SeismicMap({
  events,
  selectedEvent,
  onSelectEvent,
  esriLayer,
  onChangeLayer,
  activeRegion,
  onSelectRegion,
  focusNonce,
}: SeismicMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const labelLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const selectedRingLayerRef = useRef<L.LayerGroup | null>(null);
  const tectonicLayerRef = useRef<L.LayerGroup | null>(null);

  const [showTectonic, setShowTectonic] = useState(true);
  const [showWaves, setShowWaves] = useState(true);
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [14, -30],
      zoom: 2,
      minZoom: 2,
      maxZoom: 16,
      worldCopyJump: true,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    selectedRingLayerRef.current = L.layerGroup().addTo(map);
    tectonicLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Esri tile layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
      baseLayerRef.current = null;
    }
    if (labelLayerRef.current) {
      map.removeLayer(labelLayerRef.current);
      labelLayerRef.current = null;
    }

    const cfg = ESRI_LAYERS[esriLayer] || ESRI_LAYERS.dark_gray;
    baseLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 18,
    }).addTo(map);

    if (cfg.labelsUrl) {
      labelLayerRef.current = L.tileLayer(cfg.labelsUrl, {
        maxZoom: 18,
        opacity: 0.85,
      }).addTo(map);
    }
  }, [esriLayer]);

  // Load tectonic plates overlay
  useEffect(() => {
    const map = mapRef.current;
    const group = tectonicLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();
    if (!showTectonic) return;

    let cancelled = false;

    const drawFallback = () => {
      if (cancelled) return;
      MAJOR_TECTONIC_FALLBACK.forEach((coords) => {
        L.polyline(coords, {
          color: '#f97316',
          weight: 1.4,
          opacity: 0.55,
          dashArray: '5 5',
          interactive: false,
        }).addTo(group);
      });
    };

    fetch(
      'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json'
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('No GeoJSON'))))
      .then((geojson) => {
        if (cancelled) return;
        L.geoJSON(geojson, {
          style: {
            color: '#f97316',
            weight: 1.25,
            opacity: 0.5,
          },
          interactive: false,
        }).addTo(group);
      })
      .catch(() => {
        drawFallback();
      });

    return () => {
      cancelled = true;
    };
  }, [showTectonic]);

  // Render earthquake epicenter markers
  useEffect(() => {
    const group = markersLayerRef.current;
    if (!group) return;
    group.clearLayers();

    // Render smaller magnitudes first so critical events stay on top
    const ordered = [...events].sort((a, b) => a.magnitude - b.magnitude);

    ordered.forEach((ev) => {
      const sev = SEVERITY_CONFIG[ev.severity];
      const isSelected = selectedEvent?.id === ev.id;
      const radius = Math.max(5, Math.min(24, Math.pow(1.42, ev.magnitude) * 1.45));

      const marker = L.circleMarker([ev.lat, ev.lon], {
        radius: isSelected ? radius + 3 : radius,
        fillColor: sev.colorHex,
        color: isSelected ? '#ffffff' : sev.ringHex,
        weight: isSelected ? 2.5 : 1.2,
        opacity: 0.95,
        fillOpacity: isSelected ? 0.95 : 0.72,
      });

      const mmi = getMercalliInfo(ev);
      const shareText = buildEventShareText(ev);
      const shareUrl = ev.sourceUrl || window.location.href;
      const encodedFull = encodeURIComponent(`${shareText}\n${shareUrl}`);
      const encodedUrl = encodeURIComponent(shareUrl);
      const encodedShort = encodeURIComponent(
        `${ev.bulletinType} Sísmica: M ${ev.magnitude.toFixed(1)} (MMI ${mmi.roman} · ${mmi.label}) — ${ev.place} (${ev.agency})`
      );

      const popupEl = document.createElement('div');
      popupEl.style.padding = '11px 13px';
      popupEl.style.minWidth = '248px';
      popupEl.style.fontFamily = "'IBM Plex Sans', sans-serif";

      const headerLine = document.createElement('div');
      headerLine.style.fontSize = '11px';
      headerLine.style.fontWeight = '600';
      headerLine.style.color = sev.colorHex;
      headerLine.style.marginBottom = '4px';
      headerLine.textContent = `${sev.glyph} ${ev.bulletinType} · ${ev.severity} · ${ev.agency}`;
      popupEl.appendChild(headerLine);

      const titleLine = document.createElement('div');
      titleLine.style.fontSize = '14px';
      titleLine.style.fontWeight = '700';
      titleLine.style.marginBottom = '4px';
      titleLine.textContent = `M ${ev.magnitude.toFixed(1)} ${ev.magType} — ${ev.place}`;
      popupEl.appendChild(titleLine);

      const mmiLine = document.createElement('div');
      mmiLine.style.fontSize = '11px';
      mmiLine.style.fontWeight = '600';
      mmiLine.style.color = mmi.colorHex;
      mmiLine.style.marginBottom = '4px';
      mmiLine.textContent = `Mercalli (MMI): ${mmi.roman} · ${mmi.label}`;
      popupEl.appendChild(mmiLine);

      const metaLine = document.createElement('div');
      metaLine.style.fontSize = '11px';
      metaLine.style.opacity = '0.82';
      metaLine.style.fontFamily = "'JetBrains Mono', monospace";
      metaLine.style.lineHeight = '1.4';
      metaLine.textContent = `Prof: ${ev.depthKm.toFixed(1)} km · ${formatCoords(ev.lat, ev.lon)}`;
      const timeBr = document.createElement('br');
      const timeText = document.createTextNode(formatUtcTime(ev.timestamp));
      metaLine.appendChild(timeBr);
      metaLine.appendChild(timeText);
      popupEl.appendChild(metaLine);

      const shareBar = document.createElement('div');
      shareBar.style.marginTop = '8px';
      shareBar.style.paddingTop = '7px';
      shareBar.style.borderTop = '1px solid rgba(148, 163, 184, 0.25)';
      shareBar.style.display = 'flex';
      shareBar.style.alignItems = 'center';
      shareBar.style.gap = '6px';
      shareBar.style.flexWrap = 'wrap';

      const shareLabel = document.createElement('span');
      shareLabel.style.fontSize = '10px';
      shareLabel.style.fontWeight = '600';
      shareLabel.style.opacity = '0.7';
      shareLabel.textContent = 'Compartir:';
      shareBar.appendChild(shareLabel);

      const makeLink = (label: string, href: string, color: string) => {
        const a = document.createElement('a');
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = label;
        a.style.fontSize = '11px';
        a.style.fontWeight = '600';
        a.style.color = color;
        a.style.textDecoration = 'none';
        a.style.padding = '2px 6px';
        a.style.borderRadius = '5px';
        a.style.border = '1px solid rgba(148, 163, 184, 0.35)';
        return a;
      };

      shareBar.appendChild(
        makeLink('WhatsApp', `https://wa.me/?text=${encodedFull}`, '#16A34A')
      );
      shareBar.appendChild(
        makeLink(
          'Telegram',
          `https://t.me/share/url?url=${encodedUrl}&text=${encodedShort}`,
          '#0284C7'
        )
      );
      shareBar.appendChild(
        makeLink(
          'X',
          `https://twitter.com/intent/tweet?text=${encodedShort}&url=${encodedUrl}`,
          '#64748B'
        )
      );

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.textContent = 'Copiar';
      copyBtn.style.fontSize = '11px';
      copyBtn.style.fontWeight = '600';
      copyBtn.style.padding = '2px 7px';
      copyBtn.style.borderRadius = '5px';
      copyBtn.style.border = '1px solid rgba(148, 163, 184, 0.35)';
      copyBtn.style.background = 'transparent';
      copyBtn.style.color = 'inherit';
      copyBtn.style.cursor = 'pointer';
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fullCopy = `${shareText}\nFuente: ${shareUrl}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(fullCopy).catch(() => {});
        }
        copyBtn.textContent = '¡Copiado!';
        setTimeout(() => {
          copyBtn.textContent = 'Copiar';
        }, 1800);
      });
      shareBar.appendChild(copyBtn);

      popupEl.appendChild(shareBar);

      marker.bindPopup(popupEl);
      marker.on('click', () => {
        onSelectEvent(ev);
      });
      marker.addTo(group);
    });
  }, [events, selectedEvent, onSelectEvent]);

  // Render seismic wave concentric rings & pan map when selected event changes
  useEffect(() => {
    const map = mapRef.current;
    const ringGroup = selectedRingLayerRef.current;
    if (!map || !ringGroup) return;
    ringGroup.clearLayers();

    if (!selectedEvent) return;
    const sev = SEVERITY_CONFIG[selectedEvent.severity];

    if (showWaves) {
      const baseKm = Math.max(25, Math.pow(2, selectedEvent.magnitude) * 3.5);
      [baseKm * 0.4, baseKm, baseKm * 1.8].forEach((km, idx) => {
        L.circle([selectedEvent.lat, selectedEvent.lon], {
          radius: km * 1000,
          color: sev.ringHex,
          weight: idx === 0 ? 1.8 : 1.1,
          opacity: 0.65 - idx * 0.18,
          fillOpacity: idx === 0 ? 0.08 : 0,
          dashArray: idx === 2 ? '6 6' : undefined,
          interactive: false,
        }).addTo(ringGroup);
      });
    }
  }, [selectedEvent, showWaves]);

  // Fly to selected event when explicitly triggered or selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedEvent || focusNonce === 0) return;
    map.flyTo([selectedEvent.lat, selectedEvent.lon], Math.max(map.getZoom(), 6), {
      duration: 0.7,
    });
  }, [focusNonce, selectedEvent]);

  // Fly when region changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const reg = REGION_OPTIONS.find((r) => r.key === activeRegion);
    if (reg) {
      map.flyTo(reg.center, reg.zoom, { duration: 0.7 });
    }
  }, [activeRegion]);

  const handleResetView = () => {
    const map = mapRef.current;
    if (!map) return;
    onSelectRegion('all');
    map.flyTo([14, -30], 2, { duration: 0.6 });
  };

  return (
    <div className="relative h-full w-full min-h-[480px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
      <div ref={containerRef} className="h-full w-full" />

      {/* Top-Left HUD: Region Quick-Jump & Overlay Toggles */}
      <div className="pointer-events-none absolute top-3 left-3 right-3 z-[400] flex flex-wrap items-start justify-between gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200/90 dark:border-slate-700/90 bg-white/92 dark:bg-slate-900/92 px-2 py-1.5 backdrop-blur-sm">
          <Navigation className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0 ml-1" />
          <label htmlFor="map-region-select" className="sr-only">
            Enfoque regional del mapa
          </label>
          <select
            id="map-region-select"
            value={activeRegion}
            onChange={(e) => onSelectRegion(e.target.value as RegionKey)}
            className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none pr-1 cursor-pointer"
          >
            {REGION_OPTIONS.map((r) => (
              <option key={r.key} value={r.key} className="bg-white dark:bg-slate-900">
                {r.label}
              </option>
            ))}
          </select>

          <span className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setShowTectonic((v) => !v)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showTectonic
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Placas Tectónicas
          </button>

          <button
            type="button"
            onClick={() => setShowWaves((v) => !v)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showWaves
                ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Ondas Sísmicas
          </button>

          <button
            type="button"
            onClick={handleResetView}
            title="Vista global"
            className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Top-Right HUD: Esri Layer Switcher */}
        <div className="pointer-events-auto relative">
          <button
            type="button"
            onClick={() => setLayerMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg border border-slate-200/90 dark:border-slate-700/90 bg-white/92 dark:bg-slate-900/92 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Layers className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            <span>{ESRI_LAYERS[esriLayer].label}</span>
          </button>

          {layerMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-lg z-[500]">
              <div className="px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Capas base ArcGIS / Esri
              </div>
              {Object.values(ESRI_LAYERS).map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => {
                    onChangeLayer(layer.id);
                    setLayerMenuOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${
                    esriLayer === layer.id
                      ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{layer.label}</span>
                  {esriLayer === layer.id && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom-Left Legend (non-hue-only severity classification) */}
      <div className="pointer-events-auto absolute bottom-3 left-3 z-[400] hidden sm:flex items-center gap-3 rounded-lg border border-slate-200/90 dark:border-slate-700/90 bg-white/92 dark:bg-slate-900/92 px-3 py-1.5 text-xs backdrop-blur-sm">
        {(['Crítico', 'Alto', 'Moderado', 'Bajo'] as const).map((lvl) => {
          const cfg = SEVERITY_CONFIG[lvl];
          return (
            <div key={lvl} className="flex items-center gap-1.5 whitespace-nowrap">
              <span style={{ color: cfg.colorHex }} aria-hidden="true">
                {cfg.glyph}
              </span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{lvl}</span>
            </div>
          );
        })}
        <span className="h-3.5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
        <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
          {events.length} sismos
        </span>
      </div>
    </div>
  );
}

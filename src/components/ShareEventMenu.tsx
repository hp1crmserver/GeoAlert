import {
  Check,
  Copy,
  Mail,
  MessageCircle,
  Send,
  Share2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SeismicEvent } from '../types/seismic';
import { buildEventShareText, getMercalliInfo } from '../utils/seismicHelpers';

interface ShareEventMenuProps {
  event: SeismicEvent;
  compact?: boolean;
  align?: 'left' | 'right';
}

export default function ShareEventMenu({
  event,
  compact = false,
  align = 'right',
}: ShareEventMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const shareText = buildEventShareText(event);
  const mmi = getMercalliInfo(event);
  const shareUrl = event.sourceUrl || (typeof window !== 'undefined' ? window.location.href : '');
  const encodedText = encodeURIComponent(`${shareText}\n${shareUrl}`);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedShort = encodeURIComponent(
    `${event.bulletinType} Sísmica: M ${event.magnitude.toFixed(1)} (MMI ${mmi.roman} · ${mmi.label}) — ${event.place} (${event.agency})`
  );
  const encodedSubject = encodeURIComponent(
    `[GeoAlert] ${event.bulletinType} M ${event.magnitude.toFixed(1)} — ${event.place}`
  );
  const encodedBody = encodeURIComponent(`${shareText}\n\nFuente: ${shareUrl}`);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${shareText}\nFuente: ${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy via textarea
      const ta = document.createElement('textarea');
      ta.value = `${shareText}\nFuente: ${shareUrl}`;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Sismo M ${event.magnitude.toFixed(1)} · ${event.place}`,
          text: shareText,
          url: shareUrl,
        });
        setOpen(false);
      } catch {
        // User cancelled native share
      }
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Compartir evento"
        aria-expanded={open}
        className={
          compact
            ? 'inline-flex items-center gap-1 rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <Share2 className="h-3.5 w-3.5" />
        {!compact && <span>Compartir</span>}
      </button>

      {open && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-1.5 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-xl z-[700]`}
        >
          <div className="px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
            Compartir boletín M {event.magnitude.toFixed(1)}
          </div>

          <a
            href={`https://wa.me/?text=${encodedText}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>WhatsApp</span>
          </a>

          <a
            href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedShort}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
          >
            <Send className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            <span>Telegram</span>
          </a>

          <a
            href={`https://twitter.com/intent/tweet?text=${encodedShort}&url=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Share2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span>X (Twitter)</span>
          </a>

          <a
            href={`mailto:?subject=${encodedSubject}&body=${encodedBody}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Mail className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            <span>Correo electrónico</span>
          </a>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
              )}
              <span>{copied ? '¡Texto copiado!' : 'Copiar boletín'}</span>
            </span>
          </button>

          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800 mt-1 pt-2"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Más opciones…</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

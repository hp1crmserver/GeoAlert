import type { BulletinType } from '../types/seismic';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = 'sine',
  peakGain = 0.14
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime + startOffset;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playSeismicAlertSound(kind: BulletinType | 'test'): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (kind === 'Alerta' || kind === 'test') {
    // Urgent calibrated triple-pulse seismic alert
    playTone(ctx, 880, 0, 0.16, 'triangle', 0.18);
    playTone(ctx, 660, 0.18, 0.16, 'triangle', 0.18);
    playTone(ctx, 880, 0.38, 0.16, 'triangle', 0.18);
    playTone(ctx, 987.77, 0.58, 0.28, 'sine', 0.16);
    return;
  }

  if (kind === 'Aviso') {
    // Dual-tone medium urgency chime
    playTone(ctx, 659.25, 0, 0.18, 'sine', 0.14);
    playTone(ctx, 880, 0.2, 0.26, 'sine', 0.14);
    return;
  }

  // Boletín / Notificación: clean single telemetry ping
  playTone(ctx, 587.33, 0, 0.22, 'sine', 0.1);
}

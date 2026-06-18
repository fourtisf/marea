// Procedural ambient + SFX, ported from the prototype. Lazily created on the
// first user gesture (browser autoplay policy).
let AC: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let volume = 0.55;

export function ensureAudio(): void {
  if (AC) return;
  try {
    AC = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = volume * 0.8;
    master.connect(AC.destination);
    startAmbient();
  } catch {
    /* audio unavailable — silent */
  }
}

function startAmbient(): void {
  if (!AC || !master) return;
  const len = AC.sampleRate * 3;
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
  const src = AC.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = AC.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 470;
  const g = AC.createGain();
  g.gain.value = 0.05;
  const lfo = AC.createOscillator();
  lfo.frequency.value = 0.09;
  const lg = AC.createGain();
  lg.gain.value = 0.03;
  lfo.connect(lg).connect(g.gain);
  src.connect(lp).connect(g).connect(master);
  src.start();
  lfo.start();
}

function tone(f: number, t0: number, dur: number, type: OscillatorType, peak: number): void {
  if (!AC || !master) return;
  const o = AC.createOscillator();
  const g = AC.createGain();
  o.type = type;
  o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  job() {
    if (!AC) return;
    const t = AC.currentTime;
    tone(523, t, 0.18, "sine", 0.2);
    tone(784, t + 0.09, 0.22, "sine", 0.18);
  },
  find() {
    if (!AC) return;
    const t = AC.currentTime;
    [659, 784, 988, 1319].forEach((f, i) => tone(f, t + i * 0.07, 0.25, "triangle", 0.16));
  },
  rare() {
    if (!AC) return;
    const t = AC.currentTime;
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.08, 0.4, "triangle", 0.2));
    [1568, 2093].forEach((f, i) => tone(f, t + 0.4 + i * 0.1, 0.5, "sine", 0.12));
  },
  buy() {
    if (!AC) return;
    const t = AC.currentTime;
    tone(392, t, 0.1, "square", 0.12);
    tone(523, t + 0.06, 0.14, "square", 0.12);
  },
};

export function setVolume(v: number): void {
  volume = v;
  if (master) master.gain.value = muted ? 0 : volume * 0.8;
}
export function setMuted(m: boolean): void {
  muted = m;
  if (master) master.gain.value = muted ? 0 : volume * 0.8;
}
export function isMuted(): boolean {
  return muted;
}

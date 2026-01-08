import React, { useEffect, useMemo, useRef, useState } from "react";

type Subdivision = "quarter" | "eighths" | "triplets" | "sixteenths" | "swing";

const COLORS = {
  gold: "rgba(214, 176, 120, 0.95)",
  ink: "rgba(10,10,10,0.95)",
  panel: "rgba(255,255,255,0.06)",
  panel2: "rgba(255,255,255,0.085)",
  stroke: "rgba(255,255,255,0.14)",
  text: "rgba(255,255,255,0.88)",
  dim: "rgba(255,255,255,0.65)",
  dim2: "rgba(255,255,255,0.50)",
  danger: "rgba(255, 90, 90, 0.9)",
  ok: "rgba(120, 255, 200, 0.9)",
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function formatCents(c: number) {
  const s = c > 0 ? "+" : "";
  return `${s}${c}`;
}

/** ======== TUNER MATH ======== */
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteFromFrequency(frequency: number, a4: number) {
  // MIDI note number, A4=69
  return Math.round(12 * (Math.log(frequency / a4) / Math.log(2)) + 69);
}

function frequencyFromNoteNumber(note: number, a4: number) {
  return a4 * Math.pow(2, (note - 69) / 12);
}

function centsOffFromPitch(frequency: number, note: number, a4: number) {
  const ref = frequencyFromNoteNumber(note, a4);
  return Math.round((1200 * Math.log(frequency / ref)) / Math.log(2));
}

function noteLabelFromMidi(note: number) {
  const name = NOTE_NAMES[((note % 12) + 12) % 12];
  const octave = Math.floor(note / 12) - 1;
  return `${name}${octave}`;
}

// Autocorrelation pitch detection (time-domain)
function autoCorrelate(buf: Float32Array, sampleRate: number) {
  // Remove DC
  let rms = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i];
    rms += v * v;
  }
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.01) return { freq: 0, confidence: 0 };

  let r1 = 0;
  let r2 = buf.length - 1;
  const threshold = 0.2;

  for (let i = 0; i < buf.length / 2; i++) {
    if (Math.abs(buf[i]) < threshold) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < buf.length / 2; i++) {
    if (Math.abs(buf[buf.length - i]) < threshold) {
      r2 = buf.length - i;
      break;
    }
  }

  const slice = buf.slice(r1, r2);
  const size = slice.length;

  const c = new Array<number>(size).fill(0);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - i; j++) {
      c[i] += slice[j] * slice[j + i];
    }
  }

  let d = 0;
  while (d < size - 1 && c[d] > c[d + 1]) d++;

  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < size; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  if (maxpos <= 0) return { freq: 0, confidence: 0 };

  // Parabolic interpolation
  const x1 = c[maxpos - 1] ?? 0;
  const x2 = c[maxpos] ?? 0;
  const x3 = c[maxpos + 1] ?? 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const shift = a ? -b / (2 * a) : 0;
  const period = maxpos + shift;

  const freq = sampleRate / period;

  // crude confidence: normalized peak
  const confidence = clamp(maxval / c[0], 0, 1);

  return { freq, confidence };
}

/** ======== METRONOME AUDIO (Self-contained) ======== */
type MetroSound = "classic" | "wood" | "click" | "beep";

function createClickBuffer(ctx: AudioContext, kind: MetroSound, accent: boolean) {
  const sr = ctx.sampleRate;
  const duration = kind === "beep" ? 0.09 : 0.03;
  const len = Math.floor(sr * duration);
  const buffer = ctx.createBuffer(1, len, sr);
  const data = buffer.getChannelData(0);

  if (kind === "beep") {
    const f = accent ? 1046.5 : 784.0; // C6 vs G5-ish
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * (accent ? 18 : 22));
      data[i] = Math.sin(2 * Math.PI * f * t) * env * (accent ? 0.9 : 0.7);
    }
  } else if (kind === "wood") {
    // short noise burst with lowpass-ish decay
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * (accent ? 30 : 38));
      const noise = (Math.random() * 2 - 1) * 0.7;
      const tone = Math.sin(2 * Math.PI * (accent ? 220 : 180) * t) * 0.3;
      data[i] = (noise + tone) * env;
    }
  } else if (kind === "click") {
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * (accent ? 45 : 60));
      const noise = (Math.random() * 2 - 1);
      data[i] = noise * env * 0.8;
    }
  } else {
    // classic
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const f = accent ? 1000 : 750;
      const env = Math.exp(-t * (accent ? 35 : 45));
      data[i] = Math.sin(2 * Math.PI * f * t) * env;
    }
  }

  return buffer;
}

function scheduleBuffer(ctx: AudioContext, buf: AudioBuffer, time: number, gain: GainNode, volume: number) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(g);
  g.connect(gain);
  src.start(time);
  return src;
}

/** ======== UI PANELS ======== */
function Panel({
  title,
  children,
  right,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-4 md:p-5"
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.stroke}`,
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-lg font-semibold" style={{ color: COLORS.text }}>
          {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function SmallLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold" style={{ color: COLORS.dim2 }}>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg px-3 py-2 text-sm"
      style={{
        background: "rgba(0,0,0,0.22)",
        color: COLORS.text,
        border: `1px solid ${COLORS.stroke}`,
        outline: "none",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ color: "#111" }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function PrimaryButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl px-4 py-2 text-sm font-semibold transition"
      style={{
        background: disabled ? "rgba(255,255,255,0.10)" : COLORS.gold,
        color: disabled ? "rgba(255,255,255,0.5)" : COLORS.ink,
        border: `1px solid ${disabled ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.25)"}`,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl px-4 py-2 text-sm font-semibold transition"
      style={{
        background: "rgba(255,255,255,0.10)",
        color: "rgba(255,255,255,0.85)",
        border: `1px solid rgba(255,255,255,0.18)`,
      }}
    >
      {children}
    </button>
  );
}

/** ======== MAIN PAGE ======== */
export default function Metronome() {
  const [tab, setTab] = useState<"metronome" | "tuner">("metronome");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
      {/* Header (נקי) */}
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold" style={{ color: COLORS.gold }}>
          מטרונום טיונר
        </h1>
      </div>

      {/* Sub Tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setTab("metronome")}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition"
          style={{
            background: tab === "metronome" ? COLORS.gold : "rgba(255,255,255,0.10)",
            color: tab === "metronome" ? COLORS.ink : "rgba(255,255,255,0.85)",
            border: `1px solid ${tab === "metronome" ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.18)"}`,
          }}
        >
          מטרונום
        </button>

        <button
          onClick={() => setTab("tuner")}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition"
          style={{
            background: tab === "tuner" ? COLORS.gold : "rgba(255,255,255,0.10)",
            color: tab === "tuner" ? COLORS.ink : "rgba(255,255,255,0.85)",
            border: `1px solid ${tab === "tuner" ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.18)"}`,
          }}
        >
          טיונר
        </button>
      </div>

      {tab === "metronome" ? <MetronomePanel /> : <TunerPanel />}
    </div>
  );
}

/** ======== METRONOME PANEL ======== */
function MetronomePanel() {
  const [bpm, setBpm] = useState(120);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [accentEvery, setAccentEvery] = useState(1); // 0 none, 1 every bar first beat, N every N beats
  const [subdivision, setSubdivision] = useState<Subdivision>("quarter");
  const [sound, setSound] = useState<MetroSound>("classic");
  const [volume, setVolume] = useState(0.8);

  const [running, setRunning] = useState(false);

  // Visual
  const [beatInBar, setBeatInBar] = useState(1);
  const [subIndex, setSubIndex] = useState(0);
  const [blink, setBlink] = useState(false);
  const [phase, setPhase] = useState(0); // 0..1 within beat
  const rafRef = useRef<number | null>(null);

  // Audio scheduler refs
  const audioRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  const subdivisionCount = useMemo(() => {
    switch (subdivision) {
      case "quarter":
        return 1;
      case "eighths":
        return 2;
      case "triplets":
        return 3;
      case "sixteenths":
        return 4;
      case "swing":
        return 2;
      default:
        return 1;
    }
  }, [subdivision]);

  const stepDur = useMemo(() => {
    const beat = 60 / bpm;
    // step duration for each subdivision "tick"
    if (subdivision === "swing") {
      // handled in scheduler per step (long-short)
      return beat / 2;
    }
    return beat / subdivisionCount;
  }, [bpm, subdivision, subdivisionCount]);

  // Visual RAF loop
  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setPhase(0);
      return;
    }

    const ctx = audioRef.current;
    const start = performance.now();
    const loop = () => {
      const now = performance.now();
      // approximate phase by time modulo beat
      const beatMs = (60 / bpm) * 1000;
      const t = ((now - start) % beatMs) / beatMs;
      setPhase(t);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running, bpm]);

  function ensureAudio() {
    if (!audioRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      audioRef.current = ctx;
      masterGainRef.current = master;
    }
    return audioRef.current!;
  }

  function stopScheduler() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startScheduler() {
    const ctx = ensureAudio();
    const master = masterGainRef.current!;
    if (ctx.state === "suspended") ctx.resume().catch(() => void 0);

    const lookahead = 0.10; // seconds
    const scheduleAhead = 0.20; // seconds

    nextNoteTimeRef.current = ctx.currentTime + 0.05;

    let localBeatInBar = 1;
    let localSub = 0;
    let globalTick = 0;

    const tick = () => {
      const now = ctx.currentTime;

      while (nextNoteTimeRef.current < now + scheduleAhead) {
        // Determine swing ratio
        let dur = stepDur;
        if (subdivision === "swing") {
          const beat = 60 / bpm;
          // swing long-short ~ 2/3, 1/3
          dur = localSub % 2 === 0 ? (beat * 2) / 3 : beat / 3;
        }

        const isDownbeat = localSub === 0;
        const shouldAccent =
          accentEvery > 0
            ? (accentEvery === 1 ? isDownbeat && localBeatInBar === 1 : globalTick % accentEvery === 0)
            : false;

        const buf = createClickBuffer(ctx, sound, shouldAccent);
        scheduleBuffer(ctx, buf, nextNoteTimeRef.current, master, volume);

        // Update UI near-synchronously (small timeout to align)
        const fireInMs = Math.max(0, (nextNoteTimeRef.current - ctx.currentTime) * 1000);
        window.setTimeout(() => {
          setBeatInBar(localBeatInBar);
          setSubIndex(localSub);
          setBlink((b) => !b);
        }, fireInMs);

        // Advance counters
        globalTick++;

        localSub++;
        if (localSub >= subdivisionCount) {
          localSub = 0;
          localBeatInBar++;
          if (localBeatInBar > beatsPerBar) localBeatInBar = 1;
        }

        nextNoteTimeRef.current += dur;
      }
    };

    stopScheduler();
    timerRef.current = window.setInterval(tick, lookahead * 1000);
  }

  const toggle = async () => {
    if (!running) {
      try {
        ensureAudio();
        setRunning(true);
        startScheduler();
      } catch {
        setRunning(false);
      }
    } else {
      setRunning(false);
      stopScheduler();
    }
  };

  useEffect(() => {
    // If running and settings change -> restart scheduler to keep accurate
    if (!running) return;
    startScheduler();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, beatsPerBar, accentEvery, subdivision, sound, volume]);

  useEffect(() => {
    return () => {
      stopScheduler();
      if (audioRef.current) {
        audioRef.current.close().catch(() => void 0);
        audioRef.current = null;
      }
    };
  }, []);

  const pendulumAngle = useMemo(() => {
    // phase 0..1 => angle -max..+max (smooth)
    const s = Math.sin(phase * 2 * Math.PI);
    return s * 28; // degrees
  }, [phase]);

  const beatDots = useMemo(() => {
    const arr = [];
    for (let i = 1; i <= beatsPerBar; i++) arr.push(i);
    return arr;
  }, [beatsPerBar]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel
        title="שליטה"
        right={<PrimaryButton onClick={toggle}>{running ? "עצור" : "התחל"}</PrimaryButton>}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <SmallLabel>BPM</SmallLabel>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={20}
                max={300}
                step={1}
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="w-full"
              />
              <div
                className="min-w-[56px] rounded-lg px-2 py-1 text-center text-sm font-semibold"
                style={{ background: "rgba(0,0,0,0.25)", color: COLORS.text, border: `1px solid ${COLORS.stroke}` }}
              >
                {bpm}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <SmallLabel>עוצמה</SmallLabel>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full"
              />
              <div
                className="min-w-[56px] rounded-lg px-2 py-1 text-center text-sm font-semibold"
                style={{ background: "rgba(0,0,0,0.25)", color: COLORS.text, border: `1px solid ${COLORS.stroke}` }}
              >
                {Math.round(volume * 100)}%
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <SmallLabel>מספר פעימות בתיבה</SmallLabel>
            <Select
              value={String(beatsPerBar)}
              onChange={(v) => setBeatsPerBar(Number(v))}
              options={[2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n) }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <SmallLabel>הדגשה</SmallLabel>
            <Select
              value={String(accentEvery)}
              onChange={(v) => setAccentEvery(Number(v))}
              options={[
                { value: "0", label: "ללא" },
                { value: "1", label: "הדגשה בתחילת תיבה" },
                { value: "2", label: "כל 2 פעימות" },
                { value: "3", label: "כל 3 פעימות" },
                { value: "4", label: "כל 4 פעימות" },
                { value: "6", label: "כל 6 פעימות" },
                { value: "8", label: "כל 8 פעימות" },
              ]}
            />
          </div>

          <div className="flex flex-col gap-2">
            <SmallLabel>חלוקה</SmallLabel>
            <Select
              value={subdivision}
              onChange={(v) => setSubdivision(v as Subdivision)}
              options={[
                { value: "quarter", label: "רבעים" },
                { value: "eighths", label: "שמיניות" },
                { value: "triplets", label: "טריולות" },
                { value: "sixteenths", label: "שש־עשרה" },
                { value: "swing", label: "סווינג (3:1)" },
              ]}
            />
          </div>

          <div className="flex flex-col gap-2">
            <SmallLabel>צליל</SmallLabel>
            <Select
              value={sound}
              onChange={(v) => setSound(v as MetroSound)}
              options={[
                { value: "classic", label: "Classic Click" },
                { value: "wood", label: "Woodblock" },
                { value: "click", label: "Noise Click" },
                { value: "beep", label: "Beep (Sine)" },
              ]}
            />
          </div>
        </div>

        <div className="mt-4 text-xs" style={{ color: COLORS.dim2 }}>
          טיפ: אם אין סאונד — לחצי “התחל” פעם אחת ואז נסי שוב (דפדפנים דורשים אינטראקציה להפעלת אודיו).
        </div>
      </Panel>

      <Panel
        title="תצוגה"
        right={
          <div className="flex items-center gap-2">
            <div className="text-xs" style={{ color: COLORS.dim }}>
              Beat: {beatInBar}
            </div>
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: blink ? COLORS.gold : "rgba(255,255,255,0.25)",
                boxShadow: blink ? "0 0 14px rgba(214,176,120,0.7)" : "none",
              }}
              title="נקודה"
            />
          </div>
        }
      >
        {/* Beat dots */}
        <div className="mb-4 flex items-center gap-2">
          {beatDots.map((b) => {
            const active = b === beatInBar;
            return (
              <div
                key={b}
                className="h-3 w-3 rounded-full"
                style={{
                  background: active ? COLORS.gold : "rgba(255,255,255,0.18)",
                  border: `1px solid ${active ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.10)"}`,
                  boxShadow: active ? "0 0 16px rgba(214,176,120,0.55)" : "none",
                }}
                title={`Beat ${b}`}
              />
            );
          })}
          <div className="ml-2 text-xs" style={{ color: COLORS.dim2 }}>
            Sub: {subIndex + 1}
          </div>
        </div>

        {/* Pendulum */}
        <div
          className="relative mx-auto flex h-[320px] w-full items-center justify-center overflow-hidden rounded-2xl"
          style={{
            background: COLORS.panel2,
            border: `1px solid ${COLORS.stroke}`,
          }}
        >
          <div
            className="absolute top-6 h-6 w-6 rounded-full"
            style={{
              background: COLORS.gold,
              boxShadow: "0 0 24px rgba(214,176,120,0.65)",
            }}
          />
          <div
            className="absolute top-9 h-[220px] w-[2px]"
            style={{
              background: "rgba(214,176,120,0.85)",
              transformOrigin: "top center",
              transform: `rotate(${pendulumAngle}deg)`,
              borderRadius: 99,
              boxShadow: "0 0 14px rgba(214,176,120,0.35)",
            }}
          />
          <div
            className="absolute top-[240px] h-10 w-10 rounded-full"
            style={{
              background: "rgba(214,176,120,0.90)",
              transformOrigin: "top center",
              transform: `translateY(0px) rotate(${pendulumAngle}deg)`,
              boxShadow: "0 0 26px rgba(214,176,120,0.55)",
            }}
          />
        </div>
      </Panel>
    </div>
  );
}

/** ======== TUNER PANEL ======== */
function TunerPanel() {

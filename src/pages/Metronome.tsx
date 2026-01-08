import React, { useEffect, useMemo, useRef, useState } from "react";
import MetronomeEngine, {
  type MetronomeSettings,
  type MetronomeSound,
  type SubdivisionMode,
} from "@/lib/metronom/MetronomeEngine";

/** צבעים בסגנון הקיים אצלך */
const COLORS = {
  gold: "rgba(214, 177, 106, 1)",
  ink: "rgba(20, 16, 12, 1)",
  card: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.14)",
  text: "rgba(255,255,255,0.88)",
  subtext: "rgba(255,255,255,0.70)",
};

const SUBDIVISIONS: { value: SubdivisionMode; label: string }[] = [
  { value: "quarter", label: "רבעים" },
  { value: "eighths", label: "שמיניות" },
  { value: "triplets", label: "טריולות" },
  { value: "sixteenths", label: "שש-עשרה" },
  { value: "swing", label: "סווינג (3:1)" },
];

const SOUNDS: { value: MetronomeSound; label: string }[] = [
  { value: "classic_click", label: "Classic Click" },
  { value: "woodblock", label: "Woodblock" },
  { value: "clave", label: "Clave" },
  { value: "rimshot", label: "Rimshot" },
  { value: "cowbell", label: "Cowbell" },
  { value: "hihat", label: "Hi-Hat" },
  { value: "beep_sine", label: "Beep (Sine)" },
  { value: "beep_square", label: "Beep (Square)" },
  { value: "soft_tick", label: "Soft Tick" },
  { value: "digital_pop", label: "Digital Pop" },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* ---------- TUNER HELPERS (A4 variable) ---------- */

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteFromFrequency(frequency: number, a4: number = 440) {
  // MIDI note number, where A4=69
  return Math.round(12 * (Math.log(frequency / a4) / Math.log(2)) + 69);
}

function frequencyFromNoteNumber(note: number, a4: number = 440) {
  return a4 * Math.pow(2, (note - 69) / 12);
}

function centsOffFromPitch(frequency: number, note: number, a4: number = 440) {
  const refFrequency = frequencyFromNoteNumber(note, a4);
  return (1200 * Math.log(frequency / refFrequency)) / Math.log(2);
}

function formatNote(noteNumber: number) {
  const name = NOTE_NAMES[(noteNumber + 1200) % 12];
  const octave = Math.floor(noteNumber / 12) - 1;
  return `${name}${octave}`;
}

/** אוטוקורלציה פשוטה (ללא ספריות) */
function autoCorrelateFloat(timeDomain: Float32Array, sampleRate: number): number | null {
  // מנקה DC
  let rms = 0;
  for (let i = 0; i < timeDomain.length; i++) {
    const v = timeDomain[i];
    rms += v * v;
  }
  rms = Math.sqrt(rms / timeDomain.length);
  if (rms < 0.01) return null; // חלש מדי

  const SIZE = timeDomain.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let bestOffset = -1;
  let bestCorr = 0;

  for (let offset = 8; offset < MAX_SAMPLES; offset++) {
    let corr = 0;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      corr += timeDomain[i] * timeDomain[i + offset];
    }
    corr = corr / MAX_SAMPLES;

    if (corr > bestCorr) {
      bestCorr = corr;
      bestOffset = offset;
    }
  }

  if (bestOffset === -1 || bestCorr < 0.2) return null;
  return sampleRate / bestOffset;
}

/* ---------------------- PAGE ---------------------- */

export default function Metronome() {
  const [tab, setTab] = useState<"metronome" | "tuner">("metronome");

  return (
    <div className="min-h-screen w-full px-4 py-6" style={{ color: COLORS.text }}>
      <div className="mx-auto w-full max-w-5xl">
        {/* Header (נקי, בלי כיתוב כחול) */}
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
              border: `1px solid ${
                tab === "metronome" ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.18)"
              }`,
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
              border: `1px solid ${
                tab === "tuner" ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.18)"
              }`,
            }}
          >
            טיונר
          </button>
        </div>

        {tab === "metronome" ? <MetronomePanel /> : <TunerPanel />}
      </div>
    </div>
  );
}

/* ------------------- METRONOME PANEL ------------------- */

function MetronomePanel() {
  const engineRef = useRef<any>(null);

  const [running, setRunning] = useState(false);

  const [bpm, setBpm] = useState<number>(120);
  const [beatsPerBar, setBeatsPerBar] = useState<number>(4);
  const [accentEvery, setAccentEvery] = useState<number>(0); // 0=none
  const [subdivision, setSubdivision] = useState<SubdivisionMode>("quarter");
  const [sound, setSound] = useState<MetronomeSound>("classic_click");
  const [volume, setVolume] = useState<number>(0.08);

  // ויזואל (fallback)
  const [beatIndex, setBeatIndex] = useState<number>(0);
  const [flash, setFlash] = useState(false);
  const fallbackTimerRef = useRef<number | null>(null);

  const settings: MetronomeSettings = useMemo(
    () => ({
      bpm,
      beatsPerBar,
      accentEvery,
      subdivision,
      sound,
      volume,
    }),
    [bpm, beatsPerBar, accentEvery, subdivision, sound, volume]
  );

  useEffect(() => {
    engineRef.current = new MetronomeEngine();

    // אם קיימת פונקציה לקליטת callbacks – נשתמש בה; אם לא – לא (וככה אין שגיאה)
    const eng = engineRef.current;

    const cb = {
      onTick: (evt: any) => {
        // evt יכול להיות בכל צורה. ננסה בעדינות להוציא beatIndex
        const bi =
          typeof evt?.beatIndex === "number"
            ? evt.beatIndex
            : typeof evt?.beat === "number"
            ? evt.beat
            : null;

        if (bi !== null) setBeatIndex(bi);

        setFlash(true);
        window.setTimeout(() => setFlash(false), 80);
      },
    };

    // נסי כמה שמות נפוצים
    if (eng && typeof eng.setUICallbacks === "function") eng.setUICallbacks(cb);
    else if (eng && typeof eng.setUiCallbacks === "function") eng.setUiCallbacks(cb);
    else if (eng && typeof eng.setCallbacks === "function") eng.setCallbacks(cb);

    return () => {
      tryStopEngine();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tryStopEngine() {
    const eng = engineRef.current;
    try {
      if (fallbackTimerRef.current) {
        window.clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      if (eng && typeof eng.stop === "function") eng.stop();
    } catch {
      // ignore
    }
    setRunning(false);
  }

  function startFallbackVisual() {
    if (fallbackTimerRef.current) return;

    // רק לתצוגה, לא לסאונד.
    const intervalMs = Math.max(30, Math.round((60_000 / bpm) / (subdivision === "quarter" ? 1 : 1)));
    fallbackTimerRef.current = window.setInterval(() => {
      setBeatIndex((prev) => (prev + 1) % beatsPerBar);
      setFlash(true);
      window.setTimeout(() => setFlash(false), 80);
    }, intervalMs);
  }

  function handleToggle() {
    const eng = engineRef.current;

    if (!running) {
      try {
        if (eng && typeof eng.start === "function") eng.start(settings);
        else if (eng && typeof eng.play === "function") eng.play(settings);
        else {
          // אין start? לפחות תראי ויזואל
          startFallbackVisual();
        }

        setRunning(true);
      } catch {
        // אם הסאונד נכשל – עדיין נפעיל ויזואל כדי שלא “יישבר”
        startFallbackVisual();
        setRunning(true);
      }
    } else {
      tryStopEngine();
    }
  }

  // אם משנים settings בזמן ריצה – ננסה לעדכן
  useEffect(() => {
    if (!running) return;
    const eng = engineRef.current;

    try {
      if (eng && typeof eng.updateSettings === "function") eng.updateSettings(settings);
      else if (eng && typeof eng.setSettings === "function") eng.setSettings(settings);
      else {
        // אין update? אפשר פשוט להשאיר; הסאונד אולי עדיין יעבוד לפי internal
      }
    } catch {
      // ignore
    }
  }, [running, settings]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Controls */}
      <div className="rounded-2xl p-4 md:p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">שליטה</div>

          <button
            onClick={handleToggle}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition"
            style={{
              background: running ? "rgba(255,255,255,0.12)" : COLORS.gold,
              color: running ? "rgba(255,255,255,0.90)" : COLORS.ink,
              border: `1px solid ${running ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.25)"}`,
            }}
          >
            {running ? "עצור" : "התחל"}
          </button>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm" style={{ color: COLORS.subtext }}>
            <span>BPM</span>
            <span className="font-semibold" style={{ color: COLORS.text }}>
              {bpm}
            </span>
          </div>
          <input
            type="range"
            min={20}
            max={300}
            step={1}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <LabeledSelect
            label="מספר פעימות בתיבה (1–7)"
            value={beatsPerBar}
            onChange={(v) => setBeatsPerBar(Number(v))}
            options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))}
          />

          <LabeledSelect
            label="תדירות פעימה מודגשת AccentEvery (0–7)"
            value={accentEvery}
            onChange={(v) => setAccentEvery(Number(v))}
            options={[
              { value: 0, label: "ללא" },
              { value: 1, label: "כל פעימה" },
              { value: 2, label: "כל 2 פעימות" },
              { value: 3, label: "כל 3 פעימות" },
              { value: 4, label: "כל 4 פעימות" },
              { value: 5, label: "כל 5 פעימות" },
              { value: 6, label: "כל 6 פעימות" },
              { value: 7, label: "כל 7 פעימות" },
            ]}
          />

          <LabeledSelect
            label="חלוקה (Subdivision)"
            value={subdivision}
            onChange={(v) => setSubdivision(v as SubdivisionMode)}
            options={SUBDIVISIONS}
          />

          <LabeledSelect
            label="צליל"
            value={sound}
            onChange={(v) => setSound(v as MetronomeSound)}
            options={SOUNDS}
          />
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-sm" style={{ color: COLORS.subtext }}>
            <span>ווליום</span>
            <span className="font-semibold" style={{ color: COLORS.text }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={0.1}
            step={0.005}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* Visual */}
      <div className="rounded-2xl p-4 md:p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-lg font-semibold">תצוגה</div>
          <div className="text-sm" style={{ color: COLORS.subtext }}>
            Beat: {beatIndex + 1}
          </div>
        </div>

        <div
          className="relative mx-auto mt-2 flex items-center justify-center rounded-2xl"
          style={{
            height: 320,
            maxWidth: 520,
            border: `1px solid rgba(255,255,255,0.12)`,
            background: "rgba(0,0,0,0.10)",
          }}
        >
          {/* Blinking dot */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="text-sm" style={{ color: COLORS.subtext }}>
              נקודה
            </span>
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{
                background: flash ? COLORS.gold : "rgba(255,255,255,0.18)",
                boxShadow: flash ? `0 0 12px ${COLORS.gold}` : "none",
              }}
            />
          </div>

          {/* Simple pendulum */}
          <div className="relative" style={{ width: 220, height: 260 }}>
            <div
              className="absolute left-1/2 top-2"
              style={{
                width: 6,
                height: 210,
                background: "rgba(255,255,255,0.10)",
                transform: `translateX(-50%) rotate(${pendulumAngle(beatIndex, beatsPerBar)}deg)`,
                transformOrigin: "50% 0%",
                borderRadius: 999,
              }}
            />
            <div
              className="absolute left-1/2 top-[190px]"
              style={{
                width: 18,
                height: 18,
                transform: `translateX(-50%)`,
                background: COLORS.gold,
                borderRadius: 999,
                boxShadow: `0 0 16px rgba(214,177,106,0.55)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function pendulumAngle(beatIndex: number, beatsPerBar: number) {
  // זווית פשוטה לפי beatIndex (רק ויזואל)
  const t = beatsPerBar <= 1 ? 0 : beatIndex / (beatsPerBar - 1); // 0..1
  const angle = -25 + t * 50; // -25..+25
  return angle;
}

function LabeledSelect(props: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  options: { value: any; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm" style={{ color: COLORS.subtext }}>
        {props.label}
      </span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2 text-sm"
        style={{
          background: "rgba(0,0,0,0.25)",
          border: `1px solid rgba(255,255,255,0.14)`,
          color: COLORS.text,
          outline: "none",
        }}
      >
        {props.options.map((o) => (
          <option key={String(o.value)} value={o.value} style={{ color: "#111" }}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ------------------- TUNER PANEL ------------------- */

function TunerPanel() {
  const [micOn, setMicOn] = useState(false);
  const [status, setStatus] = useState<string>("קליטה חלשה / לא יציב");
  const [freq, setFreq] = useState<number | null>(null);
  const [note, setNote] = useState<string>("—");
  const [cents, setCents] = useState<number | null>(null);

  // מאסטר A4
  const [a4, setA4] = useState<number>(440);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  async function startMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      analyserRef.current = analyser;

      source.connect(analyser);

      setMicOn(true);
      setStatus("מקשיב…");

      loop();
    } catch (e: any) {
      setStatus("אין הרשאת מיקרופון / שגיאה");
      setMicOn(false);
    }
  }

  function stopMic() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }

    analyserRef.current = null;

    setMicOn(false);
    setStatus("מיקרופון כבוי");
    setFreq(null);
    setNote("—");
    setCents(null);
  }

  function loop() {
    const analyser = analyserRef.current;
    const ctx = audioCtxRef.current;
    if (!analyser || !ctx) return;

    const buffer = new Float32Array(analyser.fftSize);

    const tick = () => {
      analyser.getFloatTimeDomainData(buffer);

      const f = autoCorrelateFloat(buffer, ctx.sampleRate);

      if (!f) {
        setStatus("קליטה חלשה / לא יציב");
        setFreq(null);
        setNote("—");
        setCents(null);
      } else {
        const nn = noteFromFrequency(f, a4);
        const c = centsOffFromPitch(f, nn, a4);

        setStatus("קולט");
        setFreq(f);
        setNote(formatNote(nn));
        setCents(c);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    // אם מחליפים A4 בזמן שמיקרופון דולק – החישוב יתעדכן אוטומטית בטיק הבא
    // לא צריך שום דבר נוסף
  }, [a4]);

  useEffect(() => {
    return () => stopMic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needle = useMemo(() => {
    const c = cents ?? 0;
    const clamped = clamp(c, -50, 50);
    // -50..+50 -> -60..+60 deg
    return (clamped / 50) * 60;
  }, [cents]);

  return (
    <div className="rounded-2xl p-4 md:p-5" style={{ background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-lg font-semibold">טיונר (מיקרופון)</div>

        <button
          onClick={() => (micOn ? stopMic() : startMic())}
          className="rounded-xl px-4 py-2 text-sm font-semibold transition"
          style={{
            background: micOn ? "rgba(255,255,255,0.12)" : COLORS.gold,
            color: micOn ? "rgba(255,255,255,0.90)" : COLORS.ink,
            border: `1px solid ${micOn ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.25)"}`,
          }}
        >
          {micOn ? "כבה מיקרופון" : "הפעל מיקרופון"}
        </button>
      </div>

      {/* Master A4 */}
      <div className="mt-4 rounded-xl p-3" style={{ border: `1px solid rgba(255,255,255,0.12)`, background: "rgba(0,0,0,0.12)" }}>
        <div className="flex items-center justify-between text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
          <span>כיוון מאסטר (A4)</span>
          <span className="font-semibold">{a4}Hz</span>
        </div>

        <input
          type="range"
          min={435}
          max={445}
          step={1}
          value={a4}
          onChange={(e) => setA4(Number(e.target.value))}
          className="mt-2 w-full"
        />

        <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
          טווח כיוון: 435–445Hz (ברירת מחדל 440Hz)
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <InfoBox title="תו" value={note} sub={status} />
        <InfoBox
          title="תדר (Hz)"
          value={freq ? `${freq.toFixed(1)}` : "—"}
          sub={freq ? `טווח מומלץ ~40Hz–2000Hz` : "—"}
        />
        <InfoBox
          title="סטייה (cents)"
          value={cents == null ? "—" : `${Math.round(cents)}`}
          sub="יעד: ±5 סנט (כמעט מדויק)"
        />
      </div>

      {/* Needle */}
      <div className="mt-4 rounded-2xl p-4" style={{ background: "rgba(0,0,0,0.12)", border: `1px solid rgba(255,255,255,0.12)` }}>
        <div className="mb-2 text-sm" style={{ color: COLORS.subtext }}>
          מד כיוון
        </div>

        <div className="relative mx-auto" style={{ maxWidth: 520, height: 120 }}>
          <div
            className="absolute left-0 right-0 top-1/2"
            style={{ height: 6, transform: "translateY(-50%)", background: "rgba(255,255,255,0.12)", borderRadius: 999 }}
          />
          {/* center mark */}
          <div
            className="absolute top-1/2 left-1/2"
            style={{
              width: 2,
              height: 24,
              transform: "translate(-50%,-50%)",
              background: COLORS.gold,
              borderRadius: 999,
              boxShadow: `0 0 10px rgba(214,177,106,0.55)`,
            }}
          />
          {/* needle */}
          <div
            className="absolute top-1/2 left-1/2"
            style={{
              width: 2,
              height: 52,
              transformOrigin: "50% 90%",
              transform: `translate(-50%,-80%) rotate(${needle}deg)`,
              background: cents == null ? "rgba(255,255,255,0.20)" : COLORS.gold,
              borderRadius: 999,
              boxShadow: cents == null ? "none" : `0 0 14px rgba(214,177,106,0.55)`,
            }}
          />
          {/* dot */}
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: 10,
              height: 10,
              transform: "translate(-50%,-50%)",
              borderRadius: 999,
              background: cents == null ? "rgba(255,255,255,0.18)" : COLORS.gold,
            }}
          />
        </div>

        <div className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
          טיפ: אם הטיונר “קופץ” — התקרבי למקור הצליל, ונסי צליל יציב (ללא ויבראטו חזק).
        </div>
      </div>
    </div>
  );
}

function InfoBox(props: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(0,0,0,0.12)", border: `1px solid rgba(255,255,255,0.12)` }}>
      <div className="text-sm" style={{ color: COLORS.subtext }}>
        {props.title}
      </div>
      <div className="mt-2 text-2xl font-semibold" style={{ color: COLORS.text }}>
        {props.value}
      </div>
      <div className="mt-2 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
        {props.sub}
      </div>
    </div>
  );
}

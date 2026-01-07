import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MetronomeEngine,
  type MetronomeSettings,
  type MetronomeTickEvent,
  type MetronomeSound,
  type SubdivisionMode,
} from "@/lib/metronom/MetronomeEngine";

const SUBDIVISIONS: { value: SubdivisionMode; label: string }[] = [
  { value: "quarter", label: "רבעים" },
  { value: "eighths", label: "שמיניות" },
  { value: "triplets", label: "שלישונים" },
  { value: "sixteenths", label: "שש־עשריות" },
  { value: "swing", label: "סווינג (מנוקד 3:1)" },
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

function formatPct(v01: number) {
  return `${Math.round(v01 * 100)}%`;
}

export default function Metronome() {
  const engine = useMemo(() => MetronomeEngine.getInstance(), []);
  const [settings, setSettings] = useState<MetronomeSettings>(() => engine.getSettings());
  const [running, setRunning] = useState<boolean>(() => engine.getRunning());

  // Beat UI
  const [beatInBar, setBeatInBar] = useState<number>(1);
  const [subIndex, setSubIndex] = useState<number>(0);
  const [flash, setFlash] = useState<{ on: boolean; strong: boolean }>({ on: false, strong: false });

  // For pendulum animation
  const lastMainTickAtRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);
  const [pendulumAngle, setPendulumAngle] = useState<number>(0);

  // Colors (approx. your logo vibe: wine/gold)
  const COLORS = {
    wine: "#5b1f24",
    gold: "#d7b46a",
    gold2: "#f1d18a",
    ink: "#1a1a1a",
  };

  // ---------- Engine wiring ----------
  useEffect(() => {
    engine.setOnState((r) => setRunning(r));

    engine.setOnTick((e: MetronomeTickEvent) => {
      setBeatInBar(e.beatInBar);
      setSubIndex(e.subIndex);

      // Flash dot on main beat only (clear and readable)
      if (e.isMainBeat) {
        lastMainTickAtRef.current = performance.now();
        setFlash({ on: true, strong: e.isDownbeat || e.isAccent });
        // turn off quickly
        window.setTimeout(() => setFlash({ on: false, strong: false }), 90);
      }
    });

    return () => {
      engine.setOnTick(null);
      engine.setOnState(null);
      engine.stop();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [engine]);

  // ---------- Pendulum animation loop ----------
  useEffect(() => {
    const loop = () => {
      const bpm = settings.bpm;
      const msPerBeat = (60_000 / bpm) || 500;

      if (!running) {
        // settle gently to center
        setPendulumAngle((prev) => prev * 0.85);
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const t = performance.now();
      const dt = t - lastMainTickAtRef.current;
      const phase = (dt / msPerBeat) * Math.PI; // 0..π per beat => left->right swing
      // Use sin for smooth left<->right oscillation
      const angle = Math.sin(phase) * 28; // degrees
      setPendulumAngle(angle);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, settings.bpm]);

  // ---------- Apply settings to engine ----------
  const applySettings = (next: Partial<MetronomeSettings>) => {
    const merged: MetronomeSettings = { ...settings, ...next };
    setSettings(merged);

    // Apply to engine
    engine.setBpm(merged.bpm);
    engine.setBeatsPerBar(merged.beatsPerBar);
    engine.setAccentEvery(merged.accentEvery);
    engine.setSubdivision(merged.subdivision);
    engine.setSound(merged.sound);
    engine.setVolume(merged.volume);
  };

  const startStop = async () => {
    if (running) {
      engine.stop();
      return;
    }
    // Must be user gesture => called from button click
    await engine.start();
  };

  // ---------- UI helpers ----------
  const beatDots = useMemo(() => {
    return Array.from({ length: settings.beatsPerBar }, (_, i) => {
      const n = i + 1;
      const isCurrent = n === beatInBar && subIndex === 0;
      const isDownbeat = n === 1;
      return (
        <div
          key={n}
          className="h-3 w-3 rounded-full"
          style={{
            background: isCurrent ? (isDownbeat ? COLORS.gold2 : COLORS.gold) : "rgba(255,255,255,0.25)",
            boxShadow: isCurrent ? `0 0 0 3px rgba(215,180,106,0.25)` : "none",
          }}
          title={`Beat ${n}`}
        />
      );
    });
  }, [settings.beatsPerBar, beatInBar, subIndex]);

  return (
    <div className="min-h-screen w-full p-6" style={{ background: "linear-gradient(135deg, #1a0c0e 0%, #2a0f12 55%, #140607 100%)" }}>
      <div className="mx-auto w-full max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-2xl font-semibold" style={{ color: COLORS.gold }}>
            המטרונום של טובי
          </h1>
          <div className="text-sm" style={{ color: "rgba(255,255,255,0.70)" }}>
            עמוד מטרונום פנימי — שליטה מלאה + מטרונום מכני ויזואלי + נקודה מהבהבת
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Controls */}
          <div className="rounded-xl border p-5" style={{ borderColor: "rgba(215,180,106,0.25)", background: "rgba(0,0,0,0.25)" }}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-medium" style={{ color: "rgba(255,255,255,0.90)" }}>
                שליטה
              </div>
              <button
                onClick={startStop}
                className="rounded-lg px-4 py-2 text-sm font-semibold"
                style={{
                  background: running ? "rgba(255,255,255,0.12)" : COLORS.gold,
                  color: running ? "rgba(255,255,255,0.9)" : COLORS.ink,
                  border: `1px solid ${running ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.2)"}`,
                }}
              >
                {running ? "עצור" : "התחל"}
              </button>
            </div>

            {/* BPM */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                  BPM
                </label>
                <input
                  type="number"
                  min={20}
                  max={300}
                  value={settings.bpm}
                  onChange={(e) => applySettings({ bpm: clamp(Number(e.target.value || 120), 20, 300) })}
                  className="w-24 rounded-md border px-2 py-1 text-sm"
                  style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}
                />
              </div>
              <input
                type="range"
                min={20}
                max={300}
                value={settings.bpm}
                onChange={(e) => applySettings({ bpm: clamp(Number(e.target.value), 20, 300) })}
                className="w-full"
              />
            </div>

            {/* Beats per bar + Accent every */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                  מספר פעימות בתיבה (1–7)
                </label>
                <select
                  value={settings.beatsPerBar}
                  onChange={(e) => applySettings({ beatsPerBar: clamp(Number(e.target.value), 1, 7) })}
                  className="w-full rounded-md border px-2 py-2 text-sm"
                  style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}
                >
                  {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                  תדירות פעמה כבדה AccentEvery (0–7)
                </label>
                <select
                  value={settings.accentEvery}
                  onChange={(e) => applySettings({ accentEvery: clamp(Number(e.target.value), 0, 7) })}
                  className="w-full rounded-md border px-2 py-2 text-sm"
                  style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}
                >
                  {Array.from({ length: 8 }, (_, i) => i).map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "0 — ללא" : n === 1 ? "1 — כל פעימה" : `${n} — כל ${n} פעימות`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subdivision */}
            <div className="mb-4">
              <label className="mb-1 block text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                חלוקה פנימית (מקצבים)
              </label>
              <select
                value={settings.subdivision}
                onChange={(e) => applySettings({ subdivision: e.target.value as SubdivisionMode })}
                className="w-full rounded-md border px-2 py-2 text-sm"
                style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}
              >
                {SUBDIVISIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                * הנקודה המהבהבת מסונכרנת לפעימה הראשית (main beat) כדי שיהיה קל לראות.
              </div>
            </div>

            {/* Sound */}
            <div className="mb-4">
              <label className="mb-1 block text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                סאונד (10+)
              </label>
              <select
                value={settings.sound}
                onChange={(e) => applySettings({ sound: e.target.value as MetronomeSound })}
                className="w-full rounded-md border px-2 py-2 text-sm"
                style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)" }}
              >
                {SOUNDS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Volume */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                  עוצמה
                </label>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                  {formatPct(settings.volume)}
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.volume}
                onChange={(e) => applySettings({ volume: clamp(Number(e.target.value), 0, 1) })}
                className="w-full"
              />
            </div>
          </div>

          {/* Visual */}
          <div className="rounded-xl border p-5" style={{ borderColor: "rgba(215,180,106,0.25)", background: "rgba(0,0,0,0.25)" }}>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-lg font-medium" style={{ color: "rgba(255,255,255,0.90)" }}>
                תצוגה
              </div>

              {/* Flashing dot */}
              <div className="flex items-center gap-2">
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                  נקודה
                </div>
                <div
                  className="h-4 w-4 rounded-full"
                  style={{
                    background: flash.on ? (flash.strong ? COLORS.gold2 : COLORS.gold) : "rgba(255,255,255,0.18)",
                    boxShadow: flash.on ? `0 0 12px ${flash.strong ? "rgba(241,209,138,0.55)" : "rgba(215,180,106,0.45)"}` : "none",
                    transition: "transform 80ms ease, box-shadow 80ms ease",
                    transform: flash.on ? "scale(1.15)" : "scale(1)",
                  }}
                  title="Blink"
                />
              </div>
            </div>

            {/* Beat dots */}
            <div className="mb-4 flex items-center gap-2">
              {beatDots}
              <div className="ml-2 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>
                Beat: <span style={{ color: COLORS.gold }}>{beatInBar}</span>
                {settings.subdivision !== "quarter" && (
                  <>
                    {" "}
                    | Sub: <span style={{ color: COLORS.gold }}>{subIndex}</span>
                  </>
                )}
              </div>
            </div>

            {/* Mechanical metronome */}
            <div
              className="relative mx-auto mt-2 flex h-64 w-full max-w-sm items-end justify-center overflow-hidden rounded-xl"
              style={{
                background: "radial-gradient(120% 140% at 50% 0%, rgba(215,180,106,0.14) 0%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.35) 100%)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              {/* body */}
              <div
                className="absolute bottom-0 h-56 w-56 rounded-2xl"
                style={{
                  background: `linear-gradient(180deg, rgba(91,31,36,0.92) 0%, rgba(38,10,12,0.95) 100%)`,
                  border: "1px solid rgba(215,180,106,0.25)",
                  boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
                }}
              />
              {/* dial */}
              <div
                className="absolute bottom-6 h-12 w-40 rounded-lg"
                style={{
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(215,180,106,0.25)",
                }}
              />
              <div className="absolute bottom-8 text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>
                Toby Metronome
              </div>

              {/* pivot */}
              <div
                className="absolute"
                style={{
                  bottom: 170,
                  left: "50%",
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  transform: "translateX(-50%)",
                  background: COLORS.gold,
                  boxShadow: "0 0 12px rgba(215,180,106,0.35)",
                }}
              />

              {/* arm */}
              <div
                className="absolute origin-top"
                style={{
                  bottom: 170,
                  left: "50%",
                  width: 6,
                  height: 140,
                  transform: `translateX(-50%) rotate(${pendulumAngle}deg)`,
                  transition: running ? "transform 16ms linear" : "transform 120ms ease",
                  background: `linear-gradient(180deg, ${COLORS.gold2} 0%, ${COLORS.gold} 100%)`,
                  borderRadius: 999,
                }}
              >
                {/* weight */}
                <div
                  style={{
                    position: "absolute",
                    top: 40,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 26,
                    height: 18,
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(215,180,106,0.35)",
                    boxShadow: "0 10px 22px rgba(0,0,0,0.45)",
                  }}
                />
                {/* tip */}
                <div
                  style={{
                    position: "absolute",
                    bottom: -10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    background: flash.on ? COLORS.gold2 : COLORS.gold,
                    boxShadow: flash.on ? "0 0 16px rgba(241,209,138,0.55)" : "0 0 10px rgba(215,180,106,0.35)",
                    transition: "background 80ms ease, box-shadow 80ms ease",
                  }}
                  title="Pendulum tip"
                />
              </div>

              {/* baseline markers */}
              <div className="absolute bottom-[170px] left-0 right-0 flex items-center justify-between px-10 text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                <span>◀︎</span>
                <span>▶︎</span>
              </div>
            </div>

            <div className="mt-4 text-xs leading-5" style={{ color: "rgba(255,255,255,0.6)" }}>
              טיפ: אם את במובייל והסאונד לא נשמע — ודאי שלחצת על “התחל” (מחייב פעולה של משתמש כדי להפעיל AudioContext).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


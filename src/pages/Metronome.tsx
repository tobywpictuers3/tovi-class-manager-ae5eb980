import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

import {
  MetronomeEngine,
  type SubdivisionMode,
  type MetronomeSound,
} from "@/lib/metronom/MetronomeEngine";

import {
  TunerEngine,
  type TunerState,
  type NoteMeasurement,
} from "@/lib/tuner/TunerEngine";

/** ---------- helpers ---------- */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function extractBeatInBar(e: any): number | null {
  const candidates = [e?.beatInBar, e?.beat, e?.beatIndex, e?.currentBeat, e?.barBeat];
  for (const v of candidates) {
    if (typeof v === "number" && isFinite(v)) return v;
  }
  return null;
}

/** subdivision ticks per beat (visual only) */
function subdivCount(mode: SubdivisionMode): number {
  switch (mode) {
    case "quarter":
      return 1;
    case "eighths":
      return 2;
    case "triplets":
      return 3;
    case "sixteenths":
      return 4;
    case "swing":
      return 2; // visual: 2 pulses (feel stays beat)
    default:
      return 1;
  }
}

const SOUND_LABELS: Record<MetronomeSound, string> = {
  classic_click: "Classic Click",
  woodblock: "Woodblock",
  clave: "Clave",
  rimshot: "Rimshot",
  cowbell: "Cowbell",
  hihat: "Hi-Hat",
  beep_sine: "Beep (Sine)",
  beep_square: "Beep (Square)",
  soft_tick: "Soft Tick",
  digital_pop: "Digital Pop",
};

const SUB_LABELS: Record<SubdivisionMode, string> = {
  quarter: "רבעים",
  eighths: "שמיניות",
  triplets: "שלישיות",
  sixteenths: "שש עשרה",
  swing: "סווינג",
};

/** ---------- Pendulum Visual (pivot + walls + true trail) ---------- */
type HitEvent =
  | { kind: "main"; side: -1 | 1; isDownbeat: boolean; id: number }
  | { kind: "sub"; strength: "weak"; id: number };

function PendulumVisual(props: {
  running: boolean;
  bpm: number;
  beatsPerBar: number;
  beatInBar: number;
  subdivision: SubdivisionMode;
  // events from engine ticks
  hit: HitEvent;
}) {
  const { running, bpm, beatsPerBar, beatInBar, subdivision, hit } = props;

  // geometry
  const W = 440; // stage width (virtual for math)
  const H = 240;
  const pivotX = W / 2;
  const pivotY = 26;
  const rodLen = 150;
  const maxAngleDeg = 28; // how wide it swings
  const maxAngleRad = (maxAngleDeg * Math.PI) / 180;

  // each beat is travel from one wall to the other:
  // angle(t) = startSide * cos(pi * t/beatMs) * maxAngle
  const beatMs = 60000 / clamp(bpm, 20, 400);

  const startSideRef = useRef<1 | -1>(1);
  const t0Ref = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);

  const [angle, setAngle] = useState<number>(maxAngleRad); // radians
  const angleRef = useRef<number>(maxAngleRad);

  // canvas trail
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastBobRef = useRef<{ x: number; y: number } | null>(null);

  // bursts at walls
  const [lastWallBurst, setLastWallBurst] = useState<{
    side: -1 | 1;
    isDownbeat: boolean;
    id: number;
  } | null>(null);

  // sub pulse sparks (small trail accents)
  const [subSparkId, setSubSparkId] = useState<number>(0);

  // handle tick events:
  useEffect(() => {
    if (hit.kind === "main") {
      startSideRef.current = hit.side;
      t0Ref.current = performance.now();

      // snap angle to wall
      const snap = hit.side * maxAngleRad;
      setAngle(snap);
      angleRef.current = snap;

      setLastWallBurst({ side: hit.side, isDownbeat: hit.isDownbeat, id: hit.id });
    } else {
      // subdivision: create a small spark event
      setSubSparkId(hit.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hit]);

  // animation loop for pendulum + trail
  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const loop = () => {
      const now = performance.now();
      const elapsed = now - t0Ref.current;
      const p = clamp(elapsed / beatMs, 0, 1);

      const side = startSideRef.current;
      const a = side * Math.cos(Math.PI * p) * maxAngleRad;

      setAngle(a);
      angleRef.current = a;

      // draw trail
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        if (ctx) {
          // fade previous frame a bit (leaves tail)
          ctx.fillStyle = "rgba(0,0,0,0.10)";
          ctx.fillRect(0, 0, c.width, c.height);

          // bob position in canvas coords
          const bobX = pivotX + Math.sin(a) * rodLen;
          const bobY = pivotY + Math.cos(a) * rodLen;

          const prev = lastBobRef.current;
          if (prev) {
            // trail line
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(bobX, bobY);
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.strokeStyle = "rgba(244,189,86,0.35)"; // gold-ish
            ctx.shadowColor = "rgba(244,189,86,0.35)";
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
          }

          // keep last
          lastBobRef.current = { x: bobX, y: bobY };
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [running, beatMs, maxAngleRad]);

  // reset canvas cleanly when stopping
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, c.width, c.height);

    lastBobRef.current = null;
  }, [running]);

  // derive bob / rod endpoints (in virtual coords)
  const bobX = pivotX + Math.sin(angle) * rodLen;
  const bobY = pivotY + Math.cos(angle) * rodLen;

  // walls x positions (virtual)
  const wallPad = 36;
  const leftWallX = wallPad;
  const rightWallX = W - wallPad;

  // map virtual -> CSS % for absolute positioning inside stage
  const toPctX = (x: number) => `${(x / W) * 100}%`;
  const toPctY = (y: number) => `${(y / H) * 100}%`;

  const burstColor = lastWallBurst?.isDownbeat
    ? "rgba(255,45,75,0.95)" // red
    : "rgba(244,189,86,0.92)"; // gold

  const burstGlow = lastWallBurst?.isDownbeat
    ? "rgba(255,45,75,0.55)"
    : "rgba(244,189,86,0.50)";

  // subdivision sparks: small flash around current bob position
  const subSparkKey = subSparkId;

  const subdivN = subdivCount(subdivision);
  const showSub = subdivN > 1;

  return (
    <div className="space-y-4">
      {/* beat dots */}
      <div className="flex items-center justify-between">
        <div className="text-white/70 text-sm">תצוגה</div>
        <div className="flex items-center gap-2">
          {Array.from({ length: beatsPerBar }).map((_, i) => {
            const n = i + 1;
            const active = n === clamp(beatInBar, 1, beatsPerBar);
            const down = n === 1;
            return (
              <div
                key={n}
                className={`h-2 w-2 rounded-full ${
                  active
                    ? down
                      ? "bg-red-400"
                      : "bg-amber-300"
                    : "bg-white/20"
                }`}
                title={down ? "פעמה כבדה" : "פעמה"}
              />
            );
          })}
          <div className="text-white/60 text-sm ml-3">
            Beat: {clamp(beatInBar, 1, beatsPerBar)}
          </div>
        </div>
      </div>

      {/* stage */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
        <div className="relative h-[240px] rounded-2xl border border-white/10 bg-black/10 overflow-hidden">
          {/* canvas trail */}
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="absolute inset-0 w-full h-full opacity-90"
            style={{ imageRendering: "auto" }}
          />

          {/* walls */}
          <div
            className="absolute top-[10%] bottom-[10%] w-[12px] rounded-full"
            style={{
              left: `calc(${(leftWallX / W) * 100}% - 6px)`,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.14), rgba(255,255,255,0.06))",
              boxShadow: "0 0 16px rgba(255,255,255,0.08)",
            }}
          />
          <div
            className="absolute top-[10%] bottom-[10%] w-[12px] rounded-full"
            style={{
              left: `calc(${(rightWallX / W) * 100}% - 6px)`,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.14), rgba(255,255,255,0.06))",
              boxShadow: "0 0 16px rgba(255,255,255,0.08)",
            }}
          />

          {/* wall bursts */}
          {lastWallBurst && (
            <div
              key={lastWallBurst.id}
              className="absolute top-[14%] h-[120px] w-[120px] rounded-full pointer-events-none"
              style={{
                left:
                  lastWallBurst.side === -1
                    ? `calc(${(leftWallX / W) * 100}% - 10px)`
                    : `calc(${(rightWallX / W) * 100}% + 10px)`,
                transform: "translateX(-50%)",
                background: `radial-gradient(circle, ${burstColor} 0%, rgba(255,255,255,0.0) 65%)`,
                animation: "tobyBurst 220ms ease-out",
                filter: "blur(0.2px)",
                boxShadow: `0 0 24px ${burstGlow}`,
              }}
            />
          )}

          {/* pivot */}
          <div
            className="absolute h-3 w-3 rounded-full"
            style={{
              left: toPctX(pivotX),
              top: toPctY(pivotY),
              transform: "translate(-50%, -50%)",
              background: "rgba(255,255,255,0.25)",
              boxShadow: "0 0 10px rgba(255,255,255,0.10)",
            }}
          />

          {/* rod (rotates around pivot) */}
          <div
            className="absolute"
            style={{
              left: toPctX(pivotX),
              top: toPctY(pivotY),
              width: "2px",
              height: `${(rodLen / H) * 100}%`,
              transformOrigin: "top center",
              transform: `translate(-50%, 0) rotate(${(angle * 180) / Math.PI}deg)`,
              background:
                "linear-gradient(180deg, rgba(244,189,86,0.95), rgba(244,189,86,0.18))",
              boxShadow: "0 0 10px rgba(244,189,86,0.22)",
            }}
          />

          {/* bob */}
          <div
            className="absolute h-6 w-6 rounded-full"
            style={{
              left: toPctX(bobX),
              top: toPctY(bobY),
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), rgba(244,189,86,0.98))",
              boxShadow: "0 0 22px rgba(244,189,86,0.38)",
            }}
          />

          {/* subdivision spark (small, only if subdivision enabled) */}
          {showSub && subSparkKey > 0 && (
            <div
              key={subSparkKey}
              className="absolute h-[70px] w-[70px] rounded-full pointer-events-none"
              style={{
                left: toPctX(bobX),
                top: toPctY(bobY),
                transform: "translate(-50%, -50%)",
                background:
                  "radial-gradient(circle, rgba(244,189,86,0.55) 0%, rgba(255,255,255,0.0) 70%)",
                animation: "tobySpark 160ms ease-out",
                filter: "blur(0.2px)",
              }}
            />
          )}

          {/* caption */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {running ? "הפגיעה בקיר = פעמה. הדרך = המוזיקה." : "לחצי “התחל” כדי לראות תנועה"}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tobyBurst {
          0% { transform: translateX(-50%) scale(0.35); opacity: 0.0; }
          20% { opacity: 1.0; }
          100% { transform: translateX(-50%) scale(1.35); opacity: 0.0; }
        }
        @keyframes tobySpark {
          0% { transform: translate(-50%, -50%) scale(0.55); opacity: 0.0; }
          25% { opacity: 1.0; }
          100% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.0; }
        }
      `}</style>
    </div>
  );
}

export default function Metronome() {
  const [subTab, setSubTab] = useState<"metronome" | "tuner" | "duration">("metronome");

  // ---------------- Metronome engine ----------------
  const m = useMemo(() => MetronomeEngine.getInstance(), []);
  const [mRunning, setMRunning] = useState<boolean>(m.getRunning());
  const [mSettings, setMSettings] = useState(m.getSettings());
  const [beatInBar, setBeatInBar] = useState<number>(1);

  // Accent toggle (ear only)
  const [accentDownbeat, setAccentDownbeat] = useState<boolean>(() => {
    const s = m.getSettings();
    return (s.accentEvery ?? 0) > 0;
  });

  // events for visuals
  const eventIdRef = useRef(0);
  const hitSideRef = useRef<1 | -1>(1);
  const lastBeatRef = useRef<number>(1);
  const subTickRef = useRef<number>(0);

  const [hit, setHit] = useState<HitEvent>({ kind: "main", side: 1, isDownbeat: true, id: 0 });

  useEffect(() => {
    m.setOnState((running: boolean) => setMRunning(running));

    m.setOnTick((e: any) => {
      const bRaw = extractBeatInBar(e);
      const beatsPerBar = m.getSettings().beatsPerBar;

      const b = typeof bRaw === "number" ? clamp(Math.round(bRaw), 1, beatsPerBar) : lastBeatRef.current;

      // main beat detection:
      // - if beat changes => new main beat
      // - else it's a subdivision tick
      const beatChanged = b !== lastBeatRef.current;

      if (beatChanged) {
        lastBeatRef.current = b;
        setBeatInBar(b);
        subTickRef.current = 0;

        const isDownbeat = b === 1; // (2) heavy beat follows meter
        const side = hitSideRef.current;
        hitSideRef.current = (hitSideRef.current === 1 ? -1 : 1);

        eventIdRef.current += 1;
        setHit({ kind: "main", side, isDownbeat, id: eventIdRef.current });
      } else {
        // subdivision tick -> visual spark only (1)
        const subN = subdivCount(m.getSettings().subdivision);
        if (subN > 1) {
          subTickRef.current += 1;
          // only show sparks for inner subdivisions (not on the main beat)
          if (subTickRef.current < subN) {
            eventIdRef.current += 1;
            setHit({ kind: "sub", strength: "weak", id: eventIdRef.current });
          }
        }
      }
    });

    setMSettings(m.getSettings());

    return () => {
      m.setOnState(null as any);
      m.setOnTick(null as any);
    };
  }, [m]);

  // keep accentEvery synced to beatsPerBar when toggle on
  useEffect(() => {
    if (!accentDownbeat) return;
    // accent every bar: beatsPerBar
    m.setAccentEvery(m.getSettings().beatsPerBar, true);
    setMSettings(m.getSettings());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentDownbeat, mSettings.beatsPerBar]);

  // ---------------- Metronome controls ----------------
  const startMetronome = async () => {
    await m.start();
    setMSettings(m.getSettings());
  };
  const stopMetronome = () => {
    m.stop();
    setMSettings(m.getSettings());
  };

  const setBpm = (v: number) => {
    m.setBpm(v, true);
    setMSettings(m.getSettings());
  };
  const setBeatsPerBar = (v: number) => {
    m.setBeatsPerBar(v, true);
    if (accentDownbeat) m.setAccentEvery(v, true); // (2)(3)
    setMSettings(m.getSettings());
    setBeatInBar((cur) => clamp(cur, 1, v));
  };

  const setSubdivision = (v: SubdivisionMode) => {
    m.setSubdivision(v, true);
    setMSettings(m.getSettings());
  };
  const setSound = (v: MetronomeSound) => {
    m.setSound(v, true);
    setMSettings(m.getSettings());
  };
  const setVolume = (v: number) => {
    m.setVolume(v, true);
    setMSettings(m.getSettings());
  };

  const toggleAccentDownbeat = () => {
    const next = !accentDownbeat;
    setAccentDownbeat(next);

    // (3) accent toggle affects audio only
    if (next) {
      m.setAccentEvery(m.getSettings().beatsPerBar, true);
    } else {
      m.setAccentEvery(0, true);
    }
    setMSettings(m.getSettings());
  };

  // ---------------- Tuner engine (shared for tuner + duration) ----------------
  const t = useMemo(() => new TunerEngine(), []);
  const [tState, setTState] = useState<TunerState>({ status: "idle" });
  const [a4, setA4] = useState<number>(440);
  const [durations, setDurations] = useState<Array<NoteMeasurement & { id: string; createdAt: number }>>([]);

  const micShouldRunRef = useRef(false);

  useEffect(() => {
    t.setOnState(setTState);
    t.setOnNoteMeasured((x) => {
      setDurations((prev) => [{ ...x, id: crypto.randomUUID(), createdAt: Date.now() }, ...prev]);
    });
    return () => t.stop();
  }, [t]);

  const startMic = async () => {
    if (tState.status === "starting" || tState.status === "running") return;
    micShouldRunRef.current = true;

    await t.start({
      a4Hz: a4,
      fluteMinHz: 180,
      fluteMaxHz: 2600,
      minClarity: 0.58,
      absoluteMinRms: 0.004,
      rmsFactor: 2.0,
      attackMs: 40,
      releaseMs: 150,
      minNoteMs: 90,
    });
  };

  const stopMic = () => {
    micShouldRunRef.current = false;
    t.stop();
  };

  useEffect(() => {
    const wantsMic = subTab === "tuner" || subTab === "duration";
    if (wantsMic) startMic().catch(() => {});
    else stopMic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  useEffect(() => {
    if (tState.status !== "running") return;
    if (!micShouldRunRef.current) return;

    (async () => {
      stopMic();
      await startMic();
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a4]);

  const tunerRunning = tState.status === "running";
  const cents = tunerRunning ? tState.cents : 0;
  const centsClamped = clamp(cents, -50, 50);
  const TOL = 5;
  const inTol = Math.abs(centsClamped) <= TOL;
  const markerLeft = 50 + centsClamped;

  const tunerStatusText = (() => {
    if (tState.status === "idle") return "מוכן";
    if (tState.status === "starting") return "מבקש הרשאת מיקרופון…";
    if (tState.status === "running") return "מזהה תו";
    if (tState.status === "no_signal") return "אין אות מספיק חזק/יציב";
    if (tState.status === "permission_denied") return "אין הרשאה למיקרופון";
    if (tState.status === "error") return `שגיאה: ${tState.message}`;
    return "";
  })();

  const showMicRetry =
    tState.status === "permission_denied" ||
    tState.status === "error" ||
    tState.status === "idle";

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-black/20">
        <CardHeader>
          <CardTitle className="text-right">העזרים של טובי</CardTitle>
        </CardHeader>

        <CardContent>
          <Tabs value={subTab} onValueChange={(v) => setSubTab(v as any)} className="space-y-6">
            <TabsList className="gap-2">
              <TabsTrigger value="metronome">מטרונום</TabsTrigger>
              <TabsTrigger value="tuner">טיונר</TabsTrigger>
              <TabsTrigger value="duration">מדידת אורך צליל</TabsTrigger>
            </TabsList>

            {/* ===================== METRONOME ===================== */}
            <TabsContent value="metronome" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Controls */}
                <Card className="border-white/10 bg-black/20">
                  <CardHeader>
                    <CardTitle className="text-right">שליטה</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-right">
                        <div className="text-sm text-white/70">סטטוס</div>
                        <div className="text-white">{mRunning ? "פועל" : "מוכן"}</div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={startMetronome} disabled={mRunning}>
                          התחל
                        </Button>
                        <Button variant="secondary" onClick={stopMetronome} disabled={!mRunning}>
                          עצור
                        </Button>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/70">BPM</div>
                        <div className="text-white tabular-nums">{mSettings.bpm}</div>
                      </div>
                      <input
                        type="range"
                        min={40}
                        max={220}
                        value={mSettings.bpm}
                        onChange={(e) => setBpm(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="text-right">
                        <div className="text-sm text-white/70">מספר פעימות בתיבה</div>
                        <select
                          className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-white"
                          value={mSettings.beatsPerBar}
                          onChange={(e) => setBeatsPerBar(Number(e.target.value))}
                        >
                          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* (3) replace AccentEvery with toggle */}
                      <div className="text-right">
                        <div className="text-sm text-white/70">הדגשת פעימה כבדה (לאוזן)</div>
                        <Button
                          type="button"
                          variant={accentDownbeat ? "default" : "secondary"}
                          className="w-full justify-center"
                          onClick={toggleAccentDownbeat}
                        >
                          {accentDownbeat ? "מופעל" : "כבוי"}
                        </Button>
                        <div className="text-xs text-white/50 mt-1">
                          הויזואליה תמיד תדגיש פעימה כבדה, גם כשהאודיו כבוי.
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-white/70">חלוקה פנימית</div>
                        <select
                          className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-white"
                          value={mSettings.subdivision}
                          onChange={(e) => setSubdivision(e.target.value as SubdivisionMode)}
                        >
                          {Object.keys(SUB_LABELS).map((k) => (
                            <option key={k} value={k}>
                              {SUB_LABELS[k as SubdivisionMode]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-white/70">סאונד</div>
                        <select
                          className="w-full bg-black/30 border border-white/10 rounded-md p-2 text-white"
                          value={mSettings.sound}
                          onChange={(e) => setSound(e.target.value as MetronomeSound)}
                        >
                          {Object.keys(SOUND_LABELS).map((k) => (
                            <option key={k} value={k}>
                              {SOUND_LABELS[k as MetronomeSound]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-white/70">עוצמה</div>
                        <div className="text-white tabular-nums">{Math.round(mSettings.volume * 100)}%</div>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(mSettings.volume * 100)}
                        onChange={(e) => setVolume(Number(e.target.value) / 100)}
                        className="w-full"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Visual */}
                <Card className="border-white/10 bg-black/20">
                  <CardHeader>
                    <CardTitle className="text-right">מראה ויזואלי</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PendulumVisual
                      running={mRunning}
                      bpm={mSettings.bpm}
                      beatsPerBar={mSettings.beatsPerBar}
                      beatInBar={beatInBar}
                      subdivision={mSettings.subdivision}
                      hit={hit}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ===================== TUNER ===================== */}
            <TabsContent value="tuner" className="space-y-6">
              <Card className="border-white/10 bg-black/20">
                <CardHeader>
                  <CardTitle className="text-right">טיונר</CardTitle>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-white/70 text-sm text-right">כיוון מאסטר (A4)</div>
                      <div className="text-white tabular-nums">{a4}Hz</div>
                    </div>
                    <input
                      type="range"
                      min={430}
                      max={450}
                      value={a4}
                      onChange={(e) => setA4(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-right">
                      <div className="text-sm text-white/70">סטטוס</div>
                      <div className="text-white">{tunerStatusText}</div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={startMic} disabled={tState.status === "starting" || tState.status === "running"}>
                        הפעל מיקרופון
                      </Button>
                      <Button variant="secondary" onClick={stopMic} disabled={tState.status === "idle"}>
                        סגור מיקרופון
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
                      <div className="text-sm text-white/70">תו</div>
                      <div className="text-3xl text-white font-semibold">{tunerRunning ? tState.note : "--"}</div>
                    </div>

                    <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
                      <div className="text-sm text-white/70">תדירות</div>
                      <div className="text-3xl text-white font-semibold">
                        {tunerRunning ? `${tState.hz.toFixed(1)} Hz` : "--"}
                      </div>
                    </div>

                    <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
                      <div className="text-sm text-white/70">סטייה (cents)</div>
                      <div className={`text-3xl font-semibold ${tunerRunning ? (inTol ? "text-emerald-400" : "text-red-400") : "text-white"}`}>
                        {tunerRunning ? (cents > 0 ? `+${cents}` : `${cents}`) : "--"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-2">
                    <div className="flex justify-between text-xs text-white/60">
                      <span>-50</span><span>-25</span><span>0</span><span>+25</span><span>+50</span>
                    </div>

                    <div className="relative h-4 rounded bg-white/10 overflow-hidden">
                      <div className="absolute top-0 h-4 bg-emerald-500/25" style={{ left: `${50 - 5}%`, width: `${10}%` }} />
                      <div className="absolute top-0 h-4 w-[2px] bg-white/70 left-1/2 -translate-x-1/2" />
                      <div
                        className={`absolute top-[-6px] h-7 w-[3px] rounded ${tunerRunning ? (inTol ? "bg-emerald-400" : "bg-red-400") : "bg-white/50"}`}
                        style={{
                          left: `${markerLeft}%`,
                          transform: "translateX(-50%)",
                          transition: "left 80ms linear",
                        }}
                      />
                    </div>

                    <div className="text-right text-xs text-white/50">
                      ירוק = בתחום המותר (±{TOL} סנט). אדום = מחוץ לתחום.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ===================== DURATION ===================== */}
            <TabsContent value="duration" className="space-y-6">
              <Card className="border-white/10 bg-black/20">
                <CardHeader>
                  <CardTitle className="text-right">מדידת אורך צליל</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-right">
                      <div className="text-sm text-white/70">מצב</div>
                      <div className="text-white">
                        {tState.status === "starting" && "מבקש הרשאת מיקרופון…"}
                        {tState.status === "running" && "מקשיב ומודד אוטומטית"}
                        {tState.status === "no_signal" && "ממתין לצליל יציב"}
                        {tState.status === "idle" && "מוכן למדידה"}
                        {tState.status === "permission_denied" && "אין הרשאה למיקרופון"}
                        {tState.status === "error" && `שגיאה: ${tState.message}`}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {showMicRetry && <Button onClick={startMic}>הפעל מיקרופון</Button>}
                      <Button variant="secondary" onClick={() => setDurations([])} disabled={durations.length === 0}>
                        נקה רשימה
                      </Button>
                    </div>
                  </div>

                  {durations.length === 0 ? (
                    <div className="text-right text-white/60 text-sm">עדיין אין תוצאות.</div>
                  ) : (
                    <div className="space-y-2">
                      {durations.slice(0, 30).map((n, idx) => (
                        <div key={n.id} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
                          <div className="text-white/70 text-sm">#{durations.length - idx}</div>
                          <div className="text-white font-semibold tabular-nums">{n.durationSec.toFixed(2)} שנ׳</div>
                          <div className="text-white/60 text-sm tabular-nums">
                            {typeof n.lastHz === "number" ? `${Math.round(n.lastHz)} Hz` : ""}
                          </div>
                        </div>
                      ))}
                      {durations.length > 30 && (
                        <div className="text-right text-white/50 text-xs">מציג 30 אחרונים מתוך {durations.length}</div>
                      )}
                    </div>
                  )}

                  <div className="text-right text-xs text-white/50">
                    המיקרופון נסגר אוטומטית כשעוברים ללשונית אחרת.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

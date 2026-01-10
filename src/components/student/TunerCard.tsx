import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TunerEngine, type TunerState } from "@/lib/tuner/TunerEngine";

function centsColor(cents: number) {
  const abs = Math.abs(cents);
  if (abs <= 5) return "text-emerald-400";
  if (abs <= 15) return "text-yellow-300";
  return "text-red-400";
}

export default function TunerCard() {
  const engine = useMemo(() => new TunerEngine(), []);
  const [state, setState] = useState<TunerState>({ status: "idle" });

  useEffect(() => {
    engine.setOnState(setState);
    return () => engine.stop();
  }, [engine]);

  const start = async () => {
    await engine.start();
  };
  const stop = () => engine.stop();

  const running = state.status === "running";
  const noSignal = state.status === "no_signal";
  const denied = state.status === "permission_denied";
  const err = state.status === "error";

  const cents = running ? state.cents : 0;
  const inTol = Math.abs(cents) <= 5;

  return (
    <Card className="border-white/10 bg-black/20">
      <CardHeader>
        <CardTitle className="text-right">טיונר (מיקרופון)</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-right">
            <div className="text-sm text-white/70">סטטוס</div>
            <div className="text-white">
              {state.status === "idle" && "מוכן"}
              {state.status === "starting" && "מבקש הרשאת מיקרופון..."}
              {running && "מזהה תו"}
              {noSignal && "אין אות מספיק חזק"}
              {denied && "אין הרשאה למיקרופון"}
              {err && `שגיאה: ${state.message}`}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={start} disabled={state.status === "starting" || running}>
              התחל
            </Button>
            <Button variant="secondary" onClick={stop} disabled={state.status === "idle"}>
              עצור
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
            <div className="text-sm text-white/70">תו</div>
            <div className="text-3xl text-white font-semibold">{running ? state.note : "--"}</div>
          </div>

          <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
            <div className="text-sm text-white/70">תדירות</div>
            <div className="text-3xl text-white font-semibold">{running ? `${state.hz.toFixed(1)} Hz` : "--"}</div>
          </div>

          <div className="rounded-lg bg-black/25 border border-white/10 p-3 text-right">
            <div className="text-sm text-white/70">סטייה (סנטים)</div>
            <div className={`text-3xl font-semibold ${running ? centsColor(state.cents) : "text-white"}`}>
              {running ? (state.cents > 0 ? `+${state.cents}` : `${state.cents}`) : "--"}
            </div>
          </div>
        </div>

        {/* Visual needle */}
        <div className="rounded-lg bg-black/25 border border-white/10 p-4">
          <div className="flex justify-between text-xs text-white/60 mb-2">
            <span>-50</span><span>-25</span><span>0</span><span>+25</span><span>+50</span>
          </div>

          <div className="relative h-3 bg-white/10 rounded overflow-hidden">
            {/* Green band that glows when in tune */}
            <div
              className="absolute top-0 h-3"
              style={{
                left: "45%",
                width: "10%",
                background: running && inTol ? "rgba(16,185,129,0.45)" : "rgba(16,185,129,0.20)",
                boxShadow: running && inTol ? "0 0 22px rgba(16,185,129,0.55)" : "none",
                transition: "background 120ms ease, box-shadow 120ms ease",
              }}
              title="טווח מותר"
            />

            <div className="absolute top-0 h-3 w-[2px] bg-white/70 left-1/2 -translate-x-1/2" title="0" />

            <div
              className="absolute top-[-10px] h-8 w-[3px] rounded"
              style={{
                left: running ? `${50 + Math.max(-50, Math.min(50, state.cents))}%` : "50%",
                transform: "translateX(-50%)",
                transition: "left 80ms linear",
                background: running ? (inTol ? "rgb(52,211,153)" : "rgb(248,113,113)") : "rgba(244,189,86,0.7)",
              }}
              title="needle"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

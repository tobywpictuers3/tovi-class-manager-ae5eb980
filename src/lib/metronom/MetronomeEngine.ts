/* eslint-disable no-console */

/**
 * Toby Metronome Engine (Web Audio API)
 * - Lookahead scheduler (stable timing)
 * - BPM, beatsPerBar (1..7)
 * - AccentEvery (0..7): 0=none, 1=all, N=every N beats (global)
 * - Subdivision modes: quarter, eighths, triplets, sixteenths, swing (3:1)
 * - 10+ synthesized sounds (no external assets)
 * - Master volume (0..1)
 * - UI callbacks for visual metronome + blinking dot sync
 */

export type SubdivisionMode =
  | "quarter"
  | "eighths"
  | "triplets"
  | "sixteenths"
  | "swing";

export type MetronomeSound =
  | "classic_click"
  | "woodblock"
  | "clave"
  | "rimshot"
  | "cowbell"
  | "hihat"
  | "beep_sine"
  | "beep_square"
  | "soft_tick"
  | "digital_pop";

export interface MetronomeSettings {
  bpm: number; // 20..300
  beatsPerBar: number; // 1..7
  accentEvery: number; // 0..7
  subdivision: SubdivisionMode;
  sound: MetronomeSound;
  volume: number; // 0..1
}

export interface MetronomeTickEvent {
  /** 1..beatsPerBar */
  beatInBar: number;
  /** 0..(subdivisionCount-1) */
  subIndex: number;
  /** total beats since start (0-based) */
  globalBeatCount: number;
  /** is this the first beat in the bar */
  isDownbeat: boolean;
  /** accent per accentEvery rule (applies on main beat only; sub-clicks are never accented by default) */
  isAccent: boolean;
  /** scheduled audio time (AudioContext seconds) */
  time: number;
  /** current subdivision */
  subdivision: SubdivisionMode;
  /** convenience: true for main beat (subIndex === 0) */
  isMainBeat: boolean;
}

const STORAGE_KEY = "toby-metronome-settings-v2";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function safeInt(n: unknown, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : fallback;
}

function safeNum(n: unknown, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function getSubdivisionOffsets(mode: SubdivisionMode): number[] {
  switch (mode) {
    case "quarter":
      return [0];
    case "eighths":
      return [0, 0.5];
    case "triplets":
      return [0, 1 / 3, 2 / 3];
    case "sixteenths":
      return [0, 0.25, 0.5, 0.75];
    case "swing":
      // 3:1 feel inside a beat (dotted eighth + sixteenth)
      return [0, 0.75];
    default:
      return [0];
  }
}

export class MetronomeEngine {
  private static _instance: MetronomeEngine | null = null;

  static getInstance(): MetronomeEngine {
    if (!MetronomeEngine._instance) MetronomeEngine._instance = new MetronomeEngine();
    return MetronomeEngine._instance;
  }

  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private isRunning = false;

  private bpm = 120;
  private beatsPerBar = 4;
  private accentEvery = 0; // 0 none
  private subdivision: SubdivisionMode = "quarter";
  private sound: MetronomeSound = "classic_click";
  private volume = 0.7;

  private scheduleAheadTime = 0.12; // seconds
  private lookaheadMs = 25; // ms

  private timerId: number | null = null;

  /** Beat index in bar: 0..beatsPerBar-1 */
  private beatIndexInBar = 0;
  /** Total beats since start (0-based, increments each main beat) */
  private globalBeatCount = 0;

  /** Next main beat time (AudioContext time) */
  private nextBeatTime = 0;

  // For synthesized noise (hi-hat)
  private noiseBuffer: AudioBuffer | null = null;

  // UI callbacks
  private onTick: ((e: MetronomeTickEvent) => void) | null = null;
  private onState: ((running: boolean) => void) | null = null;

  private constructor() {
    this.load();
  }

  // ---------- Persistence ----------
  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Partial<MetronomeSettings>;

      this.setBpm(s.bpm ?? this.bpm, false);
      this.setBeatsPerBar(s.beatsPerBar ?? this.beatsPerBar, false);
      this.setAccentEvery(s.accentEvery ?? this.accentEvery, false);
      this.setSubdivision((s.subdivision as SubdivisionMode) ?? this.subdivision, false);
      this.setSound((s.sound as MetronomeSound) ?? this.sound, false);
      this.setVolume(s.volume ?? this.volume, false);
    } catch (err) {
      console.warn("Failed to load metronome settings:", err);
    }
  }

  save(): void {
    try {
      const s: MetronomeSettings = {
        bpm: this.bpm,
        beatsPerBar: this.beatsPerBar,
        accentEvery: this.accentEvery,
        subdivision: this.subdivision,
        sound: this.sound,
        volume: this.volume,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (err) {
      console.warn("Failed to save metronome settings:", err);
    }
  }

  // ---------- Audio init ----------
  private ensureAudioContext(): void {
    if (!this.audioCtx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new Ctx();
    }
    if (!this.masterGain && this.audioCtx) {
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.audioCtx.destination);
    }
  }

  private ensureNoiseBuffer(): void {
    if (!this.audioCtx || this.noiseBuffer) return;
    const sr = this.audioCtx.sampleRate;
    const length = Math.floor(sr * 0.25); // 250ms
    const buffer = this.audioCtx.createBuffer(1, length, sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * 0.8;
    this.noiseBuffer = buffer;
  }

  // ---------- Public API ----------
  getSettings(): MetronomeSettings {
    return {
      bpm: this.bpm,
      beatsPerBar: this.beatsPerBar,
      accentEvery: this.accentEvery,
      subdivision: this.subdivision,
      sound: this.sound,
      volume: this.volume,
    };
  }

  getRunning(): boolean {
    return this.isRunning;
  }

  setOnTick(cb: ((e: MetronomeTickEvent) => void) | null): void {
    this.onTick = cb;
  }

  setOnState(cb: ((running: boolean) => void) | null): void {
    this.onState = cb;
  }

  setBpm(bpm: number, persist = true): void {
    this.bpm = clamp(Math.round(bpm), 20, 300);
    if (persist) this.save();
  }

  setBeatsPerBar(n: number, persist = true): void {
    this.beatsPerBar = clamp(safeInt(n, 4), 1, 7);
    this.beatIndexInBar = this.beatIndexInBar % this.beatsPerBar;
    if (persist) this.save();
  }

  setAccentEvery(n: number, persist = true): void {
    this.accentEvery = clamp(safeInt(n, 0), 0, 7);
    if (persist) this.save();
  }

  setSubdivision(mode: SubdivisionMode, persist = true): void {
    const allowed: SubdivisionMode[] = ["quarter", "eighths", "triplets", "sixteenths", "swing"];
    this.subdivision = allowed.includes(mode) ? mode : "quarter";
    if (persist) this.save();
  }

  setSound(sound: MetronomeSound, persist = true): void {
    const allowed: MetronomeSound[] = [
      "classic_click",
      "woodblock",
      "clave",
      "rimshot",
      "cowbell",
      "hihat",
      "beep_sine",
      "beep_square",
      "soft_tick",
      "digital_pop",
    ];
    this.sound = allowed.includes(sound) ? sound : "classic_click";
    if (persist) this.save();
  }

  setVolume(v: number, persist = true): void {
    this.volume = clamp(safeNum(v, 0.7), 0, 1);
    if (this.masterGain) this.masterGain.gain.value = this.volume;
    if (persist) this.save();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.ensureAudioContext();

    // MUST be called from a user gesture to work on iOS
    if (this.audioCtx?.state === "suspended") {
      await this.audioCtx.resume();
    }

    if (!this.audioCtx) return;

    this.isRunning = true;

    // Reset counters
    this.beatIndexInBar = 0;
    this.globalBeatCount = 0;

    this.nextBeatTime = this.audioCtx.currentTime + 0.05;

    this.scheduler();

    this.onState?.(true);
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.timerId !== null) window.clearTimeout(this.timerId);
    this.timerId = null;

    this.onState?.(false);
  }

  // ---------- Scheduler ----------
  private scheduler = (): void => {
    if (!this.audioCtx || !this.isRunning) return;

    while (this.nextBeatTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleBeat(this.nextBeatTime);

      const secondsPerBeat = 60 / this.bpm;
      this.nextBeatTime += secondsPerBeat;

      // advance main beat counters
      this.globalBeatCount += 1;
      this.beatIndexInBar = (this.beatIndexInBar + 1) % this.beatsPerBar;
    }

    this.timerId = window.setTimeout(this.scheduler, this.lookaheadMs);
  };

  private scheduleBeat(mainBeatTime: number): void {
    if (!this.audioCtx) return;

    const offsets = getSubdivisionOffsets(this.subdivision);

    const isDownbeat = this.beatIndexInBar === 0;

    // Accent rule applies to main beat only
    const isAccent =
      this.accentEvery === 0
        ? false
        : this.accentEvery === 1
          ? true
          : (this.globalBeatCount % this.accentEvery) === 0;

    // For each subclick schedule sound; subIndex 0 is the main beat
    offsets.forEach((off, subIndex) => {
      const t = mainBeatTime + off * (60 / this.bpm);
      const isMainBeat = subIndex === 0;

      // Only main beat can be accented strongly; subclicks are weaker
      this.playSoundAt(t, {
        isAccent: isMainBeat ? isAccent : false,
        isDownbeat: isMainBeat ? isDownbeat : false,
        isSub: !isMainBeat,
      });

      // Notify UI near the scheduled time
      if (this.onTick) {
        const event: MetronomeTickEvent = {
          beatInBar: this.beatIndexInBar + 1,
          subIndex,
          globalBeatCount: this.globalBeatCount,
          isDownbeat,
          isAccent: isMainBeat ? isAccent : false,
          time: t,
          subdivision: this.subdivision,
          isMainBeat,
        };

        const delayMs = Math.max(0, (t - this.audioCtx.currentTime) * 1000);
        window.setTimeout(() => {
          if (this.isRunning) this.onTick?.(event);
        }, delayMs);
      }
    });
  }

  // ---------- Sound synthesis ----------
  private playSoundAt(
    time: number,
    flags: { isAccent: boolean; isDownbeat: boolean; isSub: boolean }
  ): void {
    if (!this.audioCtx || !this.masterGain) return;

    const { isAccent, isDownbeat, isSub } = flags;

    // Level strategy:
    // - masterGain controls global volume
    // - per-sound envelope sets relative amplitude
    // - accent boosts amplitude and/or frequency
    const level = isAccent ? 1.0 : isDownbeat ? 0.8 : isSub ? 0.35 : 0.55;

    switch (this.sound) {
      case "classic_click":
        this.soundClassicClick(time, level, isAccent);
        break;
      case "woodblock":
        this.soundWoodblock(time, level, isAccent);
        break;
      case "clave":
        this.soundClave(time, level, isAccent);
        break;
      case "rimshot":
        this.soundRimshot(time, level, isAccent);
        break;
      case "cowbell":
        this.soundCowbell(time, level, isAccent);
        break;
      case "hihat":
        this.soundHiHat(time, level, isAccent);
        break;
      case "beep_sine":
        this.soundBeep(time, level, "sine", isAccent);
        break;
      case "beep_square":
        this.soundBeep(time, level, "square", isAccent);
        break;
      case "soft_tick":
        this.soundSoftTick(time, level, isAccent);
        break;
      case "digital_pop":
        this.soundDigitalPop(time, level, isAccent);
        break;
      default:
        this.soundClassicClick(time, level, isAccent);
    }
  }

  private envClick(g: GainNode, time: number, peak: number, dur: number): void {
    // Clean transient without pops
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  }

  private makeOsc(
    type: OscillatorType,
    freq: number,
    time: number,
    dur: number,
    peak: number
  ): void {
    if (!this.audioCtx || !this.masterGain) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    osc.connect(gain);
    gain.connect(this.masterGain);

    this.envClick(gain, time, peak, dur);

    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private soundClassicClick(time: number, level: number, accent: boolean): void {
    const freq = accent ? 1700 : 1200;
    this.makeOsc("square", freq, time, 0.035, 0.35 * level);
  }

  private soundWoodblock(time: number, level: number, accent: boolean): void {
    // Short triangle with fast decay
    const freq = accent ? 1200 : 850;
    this.makeOsc("triangle", freq, time, 0.05, 0.32 * level);
  }

  private soundClave(time: number, level: number, accent: boolean): void {
    // Thin, higher sine click
    const freq = accent ? 2200 : 1800;
    this.makeOsc("sine", freq, time, 0.03, 0.28 * level);
  }

  private soundRimshot(time: number, level: number, accent: boolean): void {
    // Two quick partials
    this.makeOsc("square", accent ? 2100 : 1600, time, 0.025, 0.22 * level);
    this.makeOsc("square", accent ? 900 : 700, time + 0.004, 0.03, 0.18 * level);
  }

  private soundCowbell(time: number, level: number, accent: boolean): void {
    // Two detuned squares
    const f1 = accent ? 820 : 640;
    const f2 = accent ? 1230 : 960;
    this.makeOsc("square", f1, time, 0.08, 0.18 * level);
    this.makeOsc("square", f2, time, 0.08, 0.18 * level);
  }

  private soundHiHat(time: number, level: number, accent: boolean): void {
    if (!this.audioCtx || !this.masterGain) return;
    this.ensureNoiseBuffer();
    if (!this.noiseBuffer) return;

    const src = this.audioCtx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const hp = this.audioCtx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(6000, time);

    const gain = this.audioCtx.createGain();
    const peak = (accent ? 0.35 : 0.22) * level;
    this.envClick(gain, time, peak, 0.04);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.masterGain);

    src.start(time);
    src.stop(time + 0.06);
  }

  private soundBeep(
    time: number,
    level: number,
    type: OscillatorType,
    accent: boolean
  ): void {
    const freq = accent ? 880 : 660;
    this.makeOsc(type, freq, time, 0.09, 0.16 * level);
  }

  private soundSoftTick(time: number, level: number, accent: boolean): void {
    const freq = accent ? 1400 : 1050;
    this.makeOsc("sine", freq, time, 0.025, 0.18 * level);
  }

  private soundDigitalPop(time: number, level: number, accent: boolean): void {
    // quick pitch drop “pop”
    if (!this.audioCtx || !this.masterGain) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = "sine";
    const fStart = accent ? 900 : 700;
    const fEnd = accent ? 220 : 180;
    osc.frequency.setValueAtTime(fStart, time);
    osc.frequency.exponentialRampToValueAtTime(fEnd, time + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);

    this.envClick(gain, time, 0.22 * level, 0.06);

    osc.start(time);
    osc.stop(time + 0.08);
  }
}

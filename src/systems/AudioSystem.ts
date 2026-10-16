import type * as THREE from 'three';
import type { SoundEmitter, SoundscapeId } from '../worlds/types';

interface Soundscape {
  output: GainNode;
  stop(): void;
}

interface EmitterNode {
  def: SoundEmitter;
  gain: GainNode;
  panner: PannerNode;
  stop(): void;
}

/**
 * Fully procedural ambience: filtered noise for wind and water, detuned
 * oscillator drones, sparse inharmonic bells through a generated reverb.
 * Nothing is loaded from disk or the network.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private bus!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private noise!: AudioBuffer;
  private current: Soundscape | null = null;
  private currentId: SoundscapeId | null = null;
  private emitters: EmitterNode[] = [];
  private volume = 0.7;
  private muted = false;

  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);
    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(5.5, 2.6);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.9;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this.noise = this.makeNoise(6);
    if (this.pendingScape) this.setSoundscape(this.pendingScape);
    if (this.pendingEmitters) this.setEmitters(this.pendingEmitters);
  }

  private pendingScape: SoundscapeId | null = null;
  private pendingEmitters: SoundEmitter[] | null = null;

  setVolume(v: number): void {
    this.volume = v;
    this.applyGain();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyGain();
  }

  private applyGain(): void {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.15);
  }

  /** Suspend processing entirely (tab hidden). */
  suspend(s: boolean): void {
    if (!this.ctx) return;
    if (s) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  setSoundscape(id: SoundscapeId): void {
    this.pendingScape = id;
    if (!this.ctx || this.currentId === id) return;
    const ctx = this.ctx;
    const old = this.current;
    if (old) {
      old.output.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
      setTimeout(() => old.stop(), 4000);
    }
    const scape = this.build(id);
    scape.output.gain.value = 0;
    scape.output.gain.setTargetAtTime(1, ctx.currentTime + 0.2, 1.2);
    this.current = scape;
    this.currentId = id;
  }

  setEmitters(list: SoundEmitter[]): void {
    this.pendingEmitters = list;
    if (!this.ctx) return;
    for (const e of this.emitters) e.stop();
    this.emitters = [];
    const ctx = this.ctx;
    for (const def of list) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const panner = ctx.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'linear';
      panner.refDistance = 1;
      panner.maxDistance = 100000;
      panner.rolloffFactor = 0;
      panner.positionX.value = def.position.x;
      panner.positionY.value = def.position.y;
      panner.positionZ.value = def.position.z;
      gain.connect(panner);
      panner.connect(this.bus);
      panner.connect(this.reverbSend);
      const oscs: OscillatorNode[] = [];
      const f = def.pitch ?? 110;
      const partials = def.kind === 'water' ? [] : [1, 1.5, 2.01, 3.0];
      partials.forEach((m, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * m;
        o.detune.value = (i % 2 ? 1 : -1) * 4;
        const g = ctx.createGain();
        g.gain.value = 0.25 / (i + 1);
        o.connect(g).connect(gain);
        o.start();
        oscs.push(o);
      });
      this.emitters.push({
        def,
        gain,
        panner,
        stop: () => {
          oscs.forEach((o) => o.stop());
          gain.disconnect();
          panner.disconnect();
        },
      });
    }
  }

  updateListener(pos: THREE.Vector3, forward: THREE.Vector3): void {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos.x, t, 0.05);
      l.positionY.setTargetAtTime(pos.y, t, 0.05);
      l.positionZ.setTargetAtTime(pos.z, t, 0.05);
      l.forwardX.setTargetAtTime(forward.x, t, 0.05);
      l.forwardY.setTargetAtTime(forward.y, t, 0.05);
      l.forwardZ.setTargetAtTime(forward.z, t, 0.05);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    }
    for (const e of this.emitters) {
      const d = pos.distanceTo(e.def.position);
      const k = Math.max(0, 1 - d / e.def.radius);
      e.gain.gain.setTargetAtTime(k * k * 0.22, t, 0.2);
    }
  }

  /** One-shot cues. */
  play(kind: 'chime' | 'resonance' | 'whoosh' | 'reveal' | 'click'): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    switch (kind) {
      case 'chime':
        [1046.5, 1318.5, 1568].forEach((f, i) => this.bell(f, t + i * 0.18, 0.05, 3.5));
        break;
      case 'resonance':
        this.bell(110, t, 0.16, 9);
        this.bell(164.8, t + 0.05, 0.08, 7);
        break;
      case 'reveal':
        [110, 164.8, 277.2, 329.6].forEach((f) => this.swell(f, t, 2.5, 6, 0.05));
        break;
      case 'whoosh': {
        const src = this.noiseSource();
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 1.2;
        bp.frequency.setValueAtTime(180, t);
        bp.frequency.exponentialRampToValueAtTime(2200, t + 0.9);
        bp.frequency.exponentialRampToValueAtTime(240, t + 2.2);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.35, t + 0.8);
        g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
        src.connect(bp).connect(g);
        g.connect(this.bus);
        g.connect(this.reverbSend);
        src.start(t);
        src.stop(t + 2.6);
        break;
      }
      case 'click':
        this.bell(2093, t, 0.015, 0.4);
        break;
    }
  }

  // ---------------------------------------------------------------- builders

  private build(id: SoundscapeId): Soundscape {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.connect(this.bus);
    const send = ctx.createGain();
    send.gain.value = 1;
    out.connect(send).connect(this.reverbSend);
    const stops: (() => void)[] = [];
    const timers: number[] = [];
    const every = (min: number, max: number, fn: () => void) => {
      const tick = () => {
        fn();
        timers.push(window.setTimeout(tick, (min + Math.random() * (max - min)) * 1000));
      };
      timers.push(window.setTimeout(tick, (1 + Math.random() * min) * 1000));
    };
    const wind = (level: number, freq: number, q: number, rate: number) => stops.push(this.wind(out, level, freq, q, rate));
    const drone = (freqs: number[], level: number, cutoff: number, type: OscillatorType = 'sine') => stops.push(this.drone(out, freqs, level, cutoff, type));
    const scale = (notes: number[], gain: number, decay: number, min: number, max: number, inharmonic = false) =>
      every(min, max, () => {
        if (!this.ctx) return;
        const f = notes[Math.floor(Math.random() * notes.length)];
        this.bell(f, this.ctx.currentTime, gain, decay, out, inharmonic);
      });

    switch (id) {
      case 'cathedral':
        wind(0.12, 420, 0.6, 0.05);
        wind(0.05, 1200, 2.5, 0.11); // lapping water
        drone([55, 82.4, 110.3], 0.05, 380);
        scale([220, 246.9, 293.7, 329.6, 440], 0.035, 8, 9, 20);
        break;
      case 'ascent':
        wind(0.16, 900, 0.5, 0.07);
        wind(0.06, 2400, 1.5, 0.13);
        drone([196, 293.7], 0.018, 900);
        scale([880, 1174.7, 1318.5, 1760], 0.02, 6, 6, 14, true);
        break;
      case 'obsidian': {
        drone([41.2, 61.7, 82.4, 82.9], 0.06, 260, 'sawtooth');
        wind(0.035, 300, 0.8, 0.04);
        scale([164.8, 185, 246.9, 329.6], 0.03, 5, 10, 22, true);
        every(3.6, 3.6, () => this.pulse(out));
        break;
      }
      case 'house':
        wind(0.03, 180, 0.4, 0.03); // room tone
        drone([220, 221.4, 329.1, 330.9], 0.016, 1400, 'triangle');
        drone([60], 0.012, 200);
        scale([392, 466.2, 587.3], 0.018, 4, 14, 30);
        break;
      case 'horizon':
        wind(0.18, 520, 0.45, 0.04);
        wind(0.07, 1500, 0.9, 0.09);
        drone([73.4, 110, 146.8, 220.5], 0.035, 700);
        scale([293.7, 329.6, 440, 493.9, 587.3], 0.022, 9, 12, 24);
        break;
    }
    return {
      output: out,
      stop: () => {
        timers.forEach((t) => clearTimeout(t));
        stops.forEach((s) => s());
        out.disconnect();
      },
    };
  }

  private wind(out: AudioNode, level: number, freq: number, q: number, rate: number): () => void {
    const ctx = this.ctx!;
    const src = this.noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = freq * 0.45;
    lfo.connect(lfoGain).connect(bp.frequency);
    const amp = ctx.createGain();
    amp.gain.value = level;
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = rate * 1.73;
    const lfo2Gain = ctx.createGain();
    lfo2Gain.gain.value = level * 0.6;
    lfo2.connect(lfo2Gain).connect(amp.gain);
    src.connect(bp).connect(amp).connect(out);
    src.start();
    lfo.start();
    lfo2.start();
    return () => {
      src.stop();
      lfo.stop();
      lfo2.stop();
    };
  }

  private drone(out: AudioNode, freqs: number[], level: number, cutoff: number, type: OscillatorType): () => void {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    lp.Q.value = 0.7;
    const amp = ctx.createGain();
    amp.gain.value = level;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.03;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = cutoff * 0.35;
    lfo.connect(lfoGain).connect(lp.frequency);
    const oscs = freqs.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = (i - freqs.length / 2) * 3;
      o.connect(lp);
      o.start();
      return o;
    });
    lp.connect(amp).connect(out);
    lfo.start();
    return () => {
      oscs.forEach((o) => o.stop());
      lfo.stop();
    };
  }

  private bell(freq: number, t: number, gain: number, decay: number, out?: AudioNode, inharmonic = false): void {
    const ctx = this.ctx!;
    const partials = inharmonic ? [1, 2.76, 5.4, 8.93] : [1, 2, 3.01, 4.2];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    g.connect(out ?? this.bus);
    g.connect(this.reverbSend);
    partials.forEach((p, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * p;
      const pg = ctx.createGain();
      pg.gain.value = 1 / (i + 1) ** 1.6;
      o.connect(pg).connect(g);
      o.start(t);
      o.stop(t + decay + 0.1);
    });
  }

  private swell(freq: number, t: number, attack: number, release: number, gain: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    o.connect(g);
    g.connect(this.bus);
    g.connect(this.reverbSend);
    o.start(t);
    o.stop(t + attack + release + 0.1);
  }

  private pulse(out: AudioNode): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 1.3);
  }

  private noiseSource(): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = this.noise.duration;
    src.playbackRate.value = 0.97 + Math.random() * 0.06;
    return src;
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      // Brownish noise: softer than white, better for wind.
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.04 * w) / 1.04;
        d[i] = last * 3.2 + w * 0.08;
      }
    }
    return buf;
  }

  private impulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * 0.5;
    }
    return buf;
  }
}

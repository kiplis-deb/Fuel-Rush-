/**
 * Real-time Web Audio API sound synthesizer for automotive racing physics:
 * - Dynamic engine harmonics tuned to RPM and gear ratio
 * - Modulated tire skid noise when drifting or braking hard
 * - Checkpoint pass musical chime
 * - Fuel canister collection sound
 * - Low fuel warning beeps
 * - Out of fuel engine sputter
 * - Finish line victory celebration
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  // Engine sound nodes
  private engineGain: GainNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private osc3: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Tire skid nodes
  private tireGain: GainNode | null = null;
  private tireFilter: BiquadFilterNode | null = null;
  private tireNoiseNode: AudioBufferSourceNode | null = null;

  // State
  private isInitialized = false;
  private isRunning = false;
  private isPaused = false;
  private lastWarningTime = 0;

  public init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupEngineSound();
      this.setupTireSound();

      this.isInitialized = true;
    } catch {
      // AudioContext not supported or blocked
    }
  }

  public pause() {
    this.isPaused = true;
    this.stopEngineSound();
  }

  public resume() {
    this.isPaused = false;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public stopEngineSound() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      if (this.engineGain) {
        this.engineGain.gain.cancelScheduledValues(now);
        this.engineGain.gain.setValueAtTime(0, now);
      }
      if (this.tireGain) {
        this.tireGain.gain.cancelScheduledValues(now);
        this.tireGain.gain.setValueAtTime(0, now);
      }
    } catch {
      // Audio safety
    }
  }

  private setupEngineSound() {
    if (!this.ctx || !this.masterGain) return;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    // 3 harmonic oscillators for deep engine throbbing (sawtooth + triangle + sub sine)
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc1.frequency.setValueAtTime(45, this.ctx.currentTime);

    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.setValueAtTime(90, this.ctx.currentTime);

    this.osc3 = this.ctx.createOscillator();
    this.osc3.type = 'sine';
    this.osc3.frequency.setValueAtTime(22.5, this.ctx.currentTime);

    const oscMix = this.ctx.createGain();
    oscMix.gain.setValueAtTime(0.3, this.ctx.currentTime);

    this.osc1.connect(this.engineFilter);
    this.osc2.connect(this.engineFilter);
    this.osc3.connect(this.engineFilter);

    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.osc1.start();
    this.osc2.start();
    this.osc3.start();
    this.isRunning = true;
  }

  private setupTireSound() {
    if (!this.ctx || !this.masterGain) return;

    // Generate 1-second white noise buffer
    const bufferSize = this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;
    this.tireNoiseNode = whiteNoise;

    this.tireFilter = this.ctx.createBiquadFilter();
    this.tireFilter.type = 'bandpass';
    this.tireFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
    this.tireFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    this.tireGain = this.ctx.createGain();
    this.tireGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    whiteNoise.connect(this.tireFilter);
    this.tireFilter.connect(this.tireGain);
    this.tireGain.connect(this.masterGain);

    whiteNoise.start();
  }

  public updateVehicleSound(rpm: number, throttle: number, driftIntensity: number, isOutOfFuel: boolean) {
    if (!this.ctx || !this.isInitialized || this.isMuted || this.isPaused) return;

    const now = this.ctx.currentTime;

    if (isOutOfFuel) {
      // Cut engine sound down
      this.engineGain?.gain.setTargetAtTime(0.02, now, 0.2);
      this.osc1?.frequency.setTargetAtTime(20, now, 0.3);
      this.osc2?.frequency.setTargetAtTime(40, now, 0.3);
      return;
    }

    // Engine pitch mapping (idle 800 RPM -> 35 Hz, max 8000 RPM -> 220 Hz)
    const baseFreq = 30 + (rpm / 8000) * 160;
    this.osc1?.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.osc2?.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.05);
    this.osc3?.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);

    // Filter opens up as throttle increases
    const filterFreq = 400 + (rpm / 8000) * 1800 + throttle * 1200;
    this.engineFilter?.frequency.setTargetAtTime(filterFreq, now, 0.05);

    // Volume dynamically adjusts with throttle and load
    const targetGain = 0.12 + throttle * 0.18 + (rpm / 8000) * 0.15;
    this.engineGain?.gain.setTargetAtTime(targetGain, now, 0.05);

    // Tire screech based on drift intensity and lateral slip
    if (this.tireGain && this.tireFilter) {
      const tireVolume = Math.min(Math.max((driftIntensity - 0.2) * 1.25, 0), 0.35);
      this.tireGain.gain.setTargetAtTime(tireVolume, now, 0.04);
      this.tireFilter.frequency.setTargetAtTime(1000 + driftIntensity * 800, now, 0.05);
    }
  }

  public playCheckpointSound() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      // Dual-tone high chime (F5 -> A5 -> C6 arpeggio)
      const freqs = [698.46, 880.0, 1046.5];
      freqs.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0, now + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.36);
      });
    } catch {
      // Audio error safety
    }
  }

  public playFuelPickupSound() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      // Rising high sparkle sound
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.22);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Audio error safety
    }
  }

  public playLowFuelWarning() {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastWarningTime < 1.2) return; // Debounce warning beeps
    this.lastWarningTime = now;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.setValueAtTime(0.12, now + 0.08);
      gain.gain.setValueAtTime(0, now + 0.1);
      gain.gain.setValueAtTime(0.12, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // Audio error safety
    }
  }

  public playVictoryFanfare() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [
        { f: 523.25, t: 0.0, d: 0.15 }, // C5
        { f: 659.25, t: 0.15, d: 0.15 }, // E5
        { f: 783.99, t: 0.30, d: 0.18 }, // G5
        { f: 1046.50, t: 0.48, d: 0.60 }, // C6
      ];

      notes.forEach((note) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.f, now + note.t);

        gain.gain.setValueAtTime(0, now + note.t);
        gain.gain.linearRampToValueAtTime(0.28, now + note.t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.d);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(now + note.t);
        osc.stop(now + note.t + note.d + 0.05);
      });
    } catch {
      // Audio error safety
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }
}

export const soundEngine = new SoundEngine();

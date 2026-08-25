/* Процедурный синтез звуков на базе Web Audio API */
import { ProceduralSoundSpec, projectileTypeRegistry } from '@bubble-wars/shared';

export class SoundFx {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private noiseBuf: AudioBuffer | null = null;
    public isMuted: boolean = false;
    private volume: number = 0.55;

    public init(): void {
        try {
            if (!this.ctx) {
                const AC =
                    window.AudioContext ??
                    (window as unknown as { webkitAudioContext?: typeof AudioContext })
                        .webkitAudioContext;
                if (!AC) return;
                this.ctx = new AC();
                this.master = this.ctx.createGain();

                const savedVol = localStorage.getItem('bubble_sound_volume');
                if (savedVol !== null) {
                    const v = parseFloat(savedVol);
                    if (!isNaN(v) && v >= 0 && v <= 1) this.volume = v;
                }
                const savedMuted = localStorage.getItem('bubble_sound_muted');
                if (savedMuted !== null) {
                    this.isMuted = savedMuted === 'true';
                }

                this.master.gain.value = this.isMuted ? 0 : this.volume;
                this.master.connect(this.ctx.destination);
                const len = Math.floor(this.ctx.sampleRate * 0.5);
                this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
                const d = this.noiseBuf.getChannelData(0);
                for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
            }
            if (this.ctx.state === 'suspended') {
                void this.ctx.resume();
            }
        } catch {
            /* ignore */
        }
    }

    public unlock(): void {
        this.init();
    }

    public getVolume(): number {
        return this.volume;
    }

    public setVolume(vol: number): void {
        this.volume = Math.max(0, Math.min(1, vol));
        try {
            localStorage.setItem('bubble_sound_volume', this.volume.toString());
        } catch {
            /* ignore */
        }

        if (this.volume > 0 && this.isMuted) {
            this.isMuted = false;
            try {
                localStorage.setItem('bubble_sound_muted', 'false');
            } catch {
                /* ignore */
            }
        } else if (this.volume === 0 && !this.isMuted) {
            this.isMuted = true;
            try {
                localStorage.setItem('bubble_sound_muted', 'true');
            } catch {
                /* ignore */
            }
        }

        if (this.master) {
            this.master.gain.value = this.isMuted ? 0 : this.volume;
        }
    }

    public toggleMute(): boolean {
        this.isMuted = !this.isMuted;
        try {
            localStorage.setItem('bubble_sound_muted', this.isMuted.toString());
        } catch {
            /* ignore */
        }
        if (this.master) {
            this.master.gain.value = this.isMuted ? 0 : this.volume;
        }
        return this.isMuted;
    }

    public setMuted(muted: boolean): boolean {
        this.isMuted = muted;
        try {
            localStorage.setItem('bubble_sound_muted', this.isMuted.toString());
        } catch {
            /* ignore */
        }
        if (this.master) {
            this.master.gain.value = this.isMuted ? 0 : this.volume;
        }
        return this.isMuted;
    }

    private osc(
        type: OscillatorType,
        f0: number,
        f1: number,
        dur: number,
        vol: number,
        delay = 0
    ): void {
        if (!this.ctx || !this.master || this.isMuted) return;
        try {
            const t0 = this.ctx.currentTime + delay;
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = type;
            o.frequency.setValueAtTime(Math.max(30, f0), t0);
            o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
            g.gain.setValueAtTime(0, t0);
            g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            o.connect(g).connect(this.master);
            o.start(t0);
            o.stop(t0 + dur + 0.05);
        } catch {
            /* ignore */
        }
    }

    private noise(dur: number, vol: number, freq: number, q: number, delay = 0): void {
        if (!this.ctx || !this.master || !this.noiseBuf || this.isMuted) return;
        try {
            const t0 = this.ctx.currentTime + delay;
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuf;
            const f = this.ctx.createBiquadFilter();
            f.type = 'bandpass';
            f.frequency.value = freq;
            f.Q.value = q;
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(vol, t0);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            src.connect(f).connect(g).connect(this.master);
            src.start(t0);
            src.stop(t0 + dur + 0.05);
        } catch {
            /* ignore */
        }
    }

    /** size 0..1 — чем больше пузырь, тем ниже звук лопания */
    public playBubblePop(radius: number = 20): void {
        const size = Math.min(1, Math.max(0.1, radius / 50));
        this.osc('sine', 440 - 240 * size, 70, 0.11 + 0.1 * size, 0.45);
        this.noise(0.05 + 0.08 * size, 0.4, 2500 - 1500 * size, 1.1);
    }

    public playShoot(): void {
        this.osc('sine', 470, 790, 0.08, 0.26);
        this.noise(0.03, 0.1, 3400, 1);
    }

    public playHit(): void {
        this.osc('triangle', 250, 130, 0.07, 0.3);
    }

    public playSound(spec?: ProceduralSoundSpec): void {
        if (!spec) {
            return;
        }
        for (const layer of spec) {
            switch (layer.type) {
                case 'oscillator':
                    this.osc(
                        layer.wave,
                        layer.fromFreq,
                        layer.toFreq,
                        layer.duration,
                        layer.volume,
                        layer.delay ?? 0
                    );
                    break;
                case 'noise':
                    this.noise(
                        layer.duration,
                        layer.volume,
                        layer.freq,
                        layer.q,
                        layer.delay ?? 0
                    );
                    break;
            }
        }
    }

    public playKill(): void {
        const size = 1.0;
        this.osc('sine', 440 - 240 * size, 70, 0.11 + 0.1 * size, 0.45);
        this.noise(0.05 + 0.08 * size, 0.4, 2500 - 1500 * size, 1.1);
        this.osc('sawtooth', 540, 65, 0.36, 0.22, 0.02);
        this.noise(0.3, 0.32, 950, 0.8, 0.01);
    }

    public playRespawn(): void {
        [440, 586, 880].forEach((f, i) => this.osc('sine', f, f * 1.02, 0.09, 0.22, i * 0.09));
    }

    public playClick(): void {
        this.osc('sine', 900, 640, 0.05, 0.14);
    }
}

export const soundFx = new SoundFx();

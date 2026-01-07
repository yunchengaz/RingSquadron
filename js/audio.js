// Procedural Audio Generator - Soft, Normalized Sounds
export class AudioManager {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        this.muted = false;
        this.masterVolume = 0.15; // Master volume for normalization

        // Sound throttling to prevent audio overload
        this.lastShootTime = 0;
        this.shootThrottleMs = 50; // Min ms between shoot sounds
        this.activeShootSounds = 0;
        this.maxConcurrentShoots = 3; // Max simultaneous shoot sounds
    }

    init() {
        if (this.initialized) return;

        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }

    // Create a soft filter for pleasant sounds
    createSoftFilter() {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        filter.Q.value = 0.5;
        return filter;
    }

    // Player shooting - soft, subtle blip (throttled to prevent audio overload)
    playShoot() {
        if (!this.initialized || this.muted) return;

        // Throttle shoot sounds to prevent audio chaos with many allies
        const now = performance.now();
        if (now - this.lastShootTime < this.shootThrottleMs) return;
        if (this.activeShootSounds >= this.maxConcurrentShoots) return;

        this.lastShootTime = now;
        this.activeShootSounds++;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.createSoftFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.04);

        const vol = this.masterVolume * 0.4;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.04);

        // Decrease active count after sound finishes
        setTimeout(() => { this.activeShootSounds--; }, 50);
    }

    // Enemy shooting - soft low tone
    playEnemyShoot() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.createSoftFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.06);

        const vol = this.masterVolume * 0.35;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.06);
    }

    // Explosion - soft filtered noise
    playExplosion() {
        if (!this.initialized || this.muted) return;

        const bufferSize = this.ctx.sampleRate * 0.15;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // Soft noise with envelope
        for (let i = 0; i < bufferSize; i++) {
            const envelope = Math.pow(1 - i / bufferSize, 2);
            data[i] = (Math.random() * 2 - 1) * envelope * 0.5;
        }

        const noise = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        noise.buffer = buffer;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.15);
        filter.Q.value = 1;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        const vol = this.masterVolume * 0.8;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

        noise.start(this.ctx.currentTime);
    }

    // Ring collect - soft pleasant chime
    playRingCollect() {
        if (!this.initialized || this.muted) return;

        const notes = [523, 659, 784]; // C5, E5, G5
        const duration = 0.1;
        const vol = this.masterVolume * 0.5;

        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.createSoftFilter();

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            const startTime = this.ctx.currentTime + i * 0.05;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(vol, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }

    // Ring value increase - soft rising tone
    playRingIncrease() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.createSoftFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.08);

        const vol = this.masterVolume * 0.4;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.08);
    }

    // Ally join - soft chord
    playAllyJoin() {
        if (!this.initialized || this.muted) return;

        const frequencies = [262, 330, 392]; // C4, E4, G4
        const vol = this.masterVolume * 0.35;

        frequencies.forEach(freq => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.createSoftFilter();

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

            osc.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + 0.2);
        });
    }

    // Ally lost (negative ring) - soft descending tone
    playAllyLost() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.createSoftFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.15);

        const vol = this.masterVolume * 0.5;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.15);
    }

    // Damage taken - soft thud
    playDamage() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'lowpass';
        filter.frequency.value = 400;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);

        const vol = this.masterVolume * 0.6;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.1);
    }

    // Game over - soft descending melody
    playGameOver() {
        if (!this.initialized || this.muted) return;

        const notes = [392, 330, 294, 262]; // G4, E4, D4, C4
        const duration = 0.2;
        const vol = this.masterVolume * 0.5;

        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.createSoftFilter();

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            const startTime = this.ctx.currentTime + i * duration;
            gain.gain.setValueAtTime(vol, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }

    // Wave start - ascending fanfare
    playWaveStart() {
        if (!this.initialized || this.muted) return;

        const notes = [262, 330, 392, 523]; // C4, E4, G4, C5
        const duration = 0.1;
        const vol = this.masterVolume * 0.4;

        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.createSoftFilter();

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            const startTime = this.ctx.currentTime + i * 0.08;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(vol, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }

    // Power up / bonus sound
    playPowerUp() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.createSoftFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.15);

        const vol = this.masterVolume * 0.45;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.2);
    }

    // === WEAPON VARIETY SOUNDS ===

    // Laser weapon - high pitched zap
    playLaser() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.createSoftFilter();
        filter.frequency.value = 3000;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.05);

        const vol = this.masterVolume * 0.3;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.05);
    }

    // Spread shot - wider tone
    playSpread() {
        if (!this.initialized || this.muted) return;

        const frequencies = [500, 600, 700];
        const vol = this.masterVolume * 0.25;

        frequencies.forEach(freq => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.createSoftFilter();

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.7, this.ctx.currentTime + 0.04);

            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

            osc.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + 0.04);
        });
    }

    // Missile launcher - deep thump
    playMissile() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'lowpass';
        filter.frequency.value = 600;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.08);

        const vol = this.masterVolume * 0.5;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.1);
    }

    // Plasma weapon - warbling tone
    playPlasma() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        const gain = this.ctx.createGain();
        const filter = this.createSoftFilter();

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.06);

        lfo.type = 'sine';
        lfo.frequency.value = 40;
        lfoGain.gain.value = 50;

        const vol = this.masterVolume * 0.35;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

        lfo.start(this.ctx.currentTime);
        osc.start(this.ctx.currentTime);
        lfo.stop(this.ctx.currentTime + 0.06);
        osc.stop(this.ctx.currentTime + 0.06);
    }

    // === ENEMY TYPE SOUNDS ===

    // Tank enemy shoot - heavy bass
    playTankShoot() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'lowpass';
        filter.frequency.value = 300;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.1);

        const vol = this.masterVolume * 0.5;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.1);
    }

    // Sniper enemy shoot - sharp crack
    playSniperShoot() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'highpass';
        filter.frequency.value = 1000;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(2000, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.03);

        const vol = this.masterVolume * 0.4;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.04);
    }

    // Bomber enemy - deep rumble
    playBomberShoot() {
        if (!this.initialized || this.muted) return;

        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            const envelope = Math.pow(1 - i / bufferSize, 1.5);
            data[i] = (Math.random() * 2 - 1) * envelope;
        }

        const noise = this.ctx.createBufferSource();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        noise.buffer = buffer;
        filter.type = 'lowpass';
        filter.frequency.value = 200;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        const vol = this.masterVolume * 0.45;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

        noise.start(this.ctx.currentTime);
    }

    // Shield enemy - resonant ping
    playShieldShoot() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 5;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.08);

        const vol = this.masterVolume * 0.4;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.1);
    }

    // Shield hit - metallic clang
    playShieldHit() {
        if (!this.initialized || this.muted) return;

        const frequencies = [800, 1200, 1600];
        const vol = this.masterVolume * 0.3;

        frequencies.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(vol * (1 - i * 0.2), this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

            osc.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + 0.1);
        });
    }

    // Elite enemy sound modifier - deeper and resonant
    playEliteShoot() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.createSoftFilter();

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.1);

        const vol = this.masterVolume * 0.5;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

        osc.start(this.ctx.currentTime);
        osc2.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.12);
        osc2.stop(this.ctx.currentTime + 0.12);
    }

    // Boss attack sound
    playBossAttack() {
        if (!this.initialized || this.muted) return;

        const osc = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'lowpass';
        filter.frequency.value = 800;

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.15);

        lfo.type = 'sine';
        lfo.frequency.value = 20;
        lfoGain.gain.value = 30;

        const vol = this.masterVolume * 0.6;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

        lfo.start(this.ctx.currentTime);
        osc.start(this.ctx.currentTime);
        lfo.stop(this.ctx.currentTime + 0.2);
        osc.stop(this.ctx.currentTime + 0.2);
    }

    // Combo milestone sound
    playComboMilestone(comboCount) {
        if (!this.initialized || this.muted) return;

        const baseFreq = 400 + Math.min(comboCount * 20, 400);
        const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];
        const vol = this.masterVolume * 0.4;

        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.createSoftFilter();

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            const startTime = this.ctx.currentTime + i * 0.05;
            gain.gain.setValueAtTime(vol, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

            osc.start(startTime);
            osc.stop(startTime + 0.1);
        });
    }

    // Victory - triumphant ascending melody
    playVictory() {
        if (!this.initialized || this.muted) return;

        const notes = [262, 330, 392, 523, 659, 784]; // C4, E4, G4, C5, E5, G5
        const duration = 0.15;
        const vol = this.masterVolume * 0.5;

        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.createSoftFilter();

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            const startTime = this.ctx.currentTime + i * 0.1;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(vol, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

            osc.start(startTime);
            osc.stop(startTime + duration);
        });
    }
}

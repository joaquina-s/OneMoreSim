// audio/uiSounds.js
// Procedural Web Audio API sound effects for UI interactions.
// Generates sci-fi tones without relying on external assets.

class UISound {
    constructor() {
        this.ctx = null; // Lazy initialization on first user interaction
    }

    _init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
    }

    /**
     * Synthesizes a procedural tone
     * @param {number} freq - Starting frequency (Hz)
     * @param {number} endFreq - Ending frequency (Hz)
     * @param {number} duration - Duration (seconds)
     * @param {string} type - Waveform ('sine', 'square', 'sawtooth', 'triangle')
     * @param {number} gain - Volume (0.0 to 1.0)
     */
    _tone(freq, endFreq, duration, type = 'sine', gain = 0.1) {
        if (!this.ctx) return;

        // Ensure context is resumed (browser autoplay policies)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const oscillator = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        oscillator.type = type;

        // Frequency sweep
        oscillator.frequency.setValueAtTime(freq, this.ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);

        // Volume envelope
        gainNode.gain.setValueAtTime(gain, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        oscillator.start();
        oscillator.stop(this.ctx.currentTime + duration);
    }

    // --- Sound Effects Library ---

    /** Standard button click / texture select */
    click() {
        this._init();
        this._tone(800, 400, 0.05, 'square', 0.08);
    }

    /** World warp / transition */
    switchWorld() {
        this._init();
        this._tone(200, 800, 0.2, 'sine', 0.12);
    }

    /** Subtle hover tick */
    hover() {
        this._init();
        this._tone(1200, 1200, 0.02, 'sine', 0.04);
    }

    /** Error / Invalid action */
    error() {
        this._init();
        this._tone(200, 150, 0.15, 'sawtooth', 0.1);
    }

    /** Enter application / Start */
    enter() {
        this._init();
        this._tone(440, 880, 0.4, 'sine', 0.15);
    }
}

export const uiSound = new UISound();

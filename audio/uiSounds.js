// audio/uiSounds.js
// UI interaction sounds — loads WAV files from assets/Sound/.

class UISound {
    constructor() {
        this.ctx = null;
        this._buffers = {};   // keyed by name
        this._loading = null; // single init promise
    }

    _init() {
        if (this.ctx) return this._loading;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // Load all UI sound files once
        const files = {
            gritito:       'assets/Sound/one-more-sim-CLICK-gritito.wav',
            bubble1:       'assets/Sound/one-more-sim-CLICK-bubble-1.wav',
            bubble2:       'assets/Sound/one-more-sim-CLICK-bubble-2.wav',
            bubble2noFx:   'assets/Sound/one-more-sim-CLICK-bubble-2-no-fx.wav',
        };

        this._loading = Promise.all(
            Object.entries(files).map(([name, url]) =>
                fetch(url)
                    .then(r => r.arrayBuffer())
                    .then(buf => this.ctx.decodeAudioData(buf))
                    .then(decoded => { this._buffers[name] = decoded; })
                    .catch(e => console.warn('[uiSound] failed to load', name, e))
            )
        );
        return this._loading;
    }

    _play(name, gain = 0.5) {
        if (!this.ctx || !this._buffers[name]) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const src = this.ctx.createBufferSource();
        const g = this.ctx.createGain();
        src.buffer = this._buffers[name];
        g.gain.value = gain;
        src.connect(g);
        g.connect(this.ctx.destination);
        src.start();
    }

    // ── Public API ──

    /** Enter / gritito — landing + welcome enter buttons, logo buttons */
    enter()      { this._init(); this._play('gritito', 0.5); }

    /** World nav button click */
    switchWorld() { this._init(); this._play('bubble1', 0.5); }

    /** Texture button click — random between bubble2 and bubble2-no-fx */
    click()      {
        this._init();
        this._play(Math.random() < 0.5 ? 'bubble2' : 'bubble2noFx', 0.5);
    }

    /** Subtle hover tick (procedural — no file needed) */
    hover() {
        this._init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        g.gain.setValueAtTime(0.04, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.02);
    }
}

export const uiSound = new UISound();

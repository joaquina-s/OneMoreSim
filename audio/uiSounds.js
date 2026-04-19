// audio/uiSounds.js
// UI interaction sounds — loads WAV files from assets/Sound/.

class UISound {
    constructor() {
        this.ctx = null;
        this._buffers = {};   // keyed by name
        this._loading = null; // critical-sound init promise
        this._pending = {};   // name → Promise<void> for in-flight decodes
    }

    _init() {
        if (this.ctx) return this._loading;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // Tiered loading: gritito (the ENTER click) is the first sound the
        // user hears, so it's fetched/decoded immediately. The rest are
        // deferred until the browser is idle (or 1.5s elapses) so we don't
        // block the network/CPU during the critical landing animation.
        const critical = {
            gritito: 'assets/Sound/one-more-sim-CLICK-gritito.wav',
        };
        const deferred = {
            bubble1:     'assets/Sound/one-more-sim-CLICK-bubble-1.wav',
            bubble2:     'assets/Sound/one-more-sim-CLICK-bubble-2.wav',
            bubble2noFx: 'assets/Sound/one-more-sim-CLICK-bubble-2-no-fx.wav',
        };

        const decode = ([name, url]) => {
            const p = fetch(url)
                .then(r => r.arrayBuffer())
                .then(buf => this.ctx.decodeAudioData(buf))
                .then(decoded => { this._buffers[name] = decoded; })
                .catch(e => console.warn('[uiSound] failed to load', name, e));
            this._pending[name] = p;
            return p;
        };

        // _loading resolves as soon as the critical sound is ready.
        this._loading = Promise.all(Object.entries(critical).map(decode));

        // Schedule the rest for an idle moment.
        const loadDeferred = () => Object.entries(deferred).forEach(decode);
        if ('requestIdleCallback' in window) {
            requestIdleCallback(loadDeferred, { timeout: 1500 });
        } else {
            setTimeout(loadDeferred, 1500);
        }

        return this._loading;
    }

    _play(name, gain = 0.5) {
        // Ensure the AudioContext exists (created lazily on first user gesture)
        this._init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        // Buffer not loaded yet → wait on this specific sound's decode.
        // Prevents the "sometimes the sound doesn't fire" race on the first
        // interaction (the ENTER click was running before fetch/decode
        // resolved). Per-name promise so deferred sounds also work.
        if (!this._buffers[name]) {
            const p = this._pending[name] || this._loading;
            if (p) p.then(() => {
                if (this._buffers[name]) this._playNow(name, gain);
            });
            return;
        }
        this._playNow(name, gain);
    }

    _playNow(name, gain) {
        const src = this.ctx.createBufferSource();
        const g   = this.ctx.createGain();
        src.buffer = this._buffers[name];
        g.gain.value = gain;
        src.connect(g);
        g.connect(this.ctx.destination);
        src.start();
    }

    // ── Public API ──

    /** Enter / gritito — landing + welcome enter buttons, logo buttons */
    enter()      { this._play('gritito', 0.5); }

    /** World nav button click */
    switchWorld() { this._play('bubble1', 0.5); }

    /** Texture button click — random between bubble2 and bubble2-no-fx */
    click()      {
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

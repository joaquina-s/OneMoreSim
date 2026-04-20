// audio/uiSounds.js v3
// UI interaction sounds — loads WAV/MP3 files from assets/Sound/.

class UISound {
    constructor() {
        this.ctx = null;
        this._buffers = {};   // keyed by name
        this._loading = null; // critical-sound init promise
        this._pending = {};   // name → Promise<void> for in-flight decodes
        this._loops = {};     // name → { src, gain } currently playing loop
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
            // Skin panel (8 random)
            skin1: 'assets/Sound/click-skin-1.mp3',
            skin2: 'assets/Sound/click-skin-2.mp3',
            skin3: 'assets/Sound/click-skin-3.mp3',
            skin4: 'assets/Sound/click-skin-4.mp3',
            skin5: 'assets/Sound/click-skin-5.mp3',
            skin6: 'assets/Sound/click-skin-6.mp3',
            skin7: 'assets/Sound/click-skin-7.mp3',
            skin8: 'assets/Sound/click-skin-8.mp3',
            // Memory pick (9 random)
            mem1: 'assets/Sound/memory-click-1.mp3',
            mem2: 'assets/Sound/memory-click-2.mp3',
            mem3: 'assets/Sound/memory-click-3.mp3',
            mem4: 'assets/Sound/memory-click-4.mp3',
            mem5: 'assets/Sound/memory-click-5.mp3',
            mem6: 'assets/Sound/memory-click-6.mp3',
            mem7: 'assets/Sound/memory-click-7.mp3',
            mem8: 'assets/Sound/memory-click-8.mp3',
            mem9: 'assets/Sound/memory-click-9.mp3',
            // Super_Me_Era (3 random)
            superMe0: 'assets/Sound/super-me-click.mp3',
            superMe1: 'assets/Sound/super-me-click-1.mp3',
            superMe2: 'assets/Sound/super-me-click-1-no-delay.mp3',
            // Single-shot
            chair:    'assets/Sound/presentation-club-chair.mp3',
            discover: 'assets/Sound/click-discover-picture.wav',
            banera1:  'assets/Sound/click-baniera-1.mp3',
            banera2:  'assets/Sound/click-baniera-2.mp3',
            // Loops (lower volume, started/stopped per-world)
            bubbles78: 'assets/Sound/extra-layer-bubbles-7-8.mp3',
            navegando: 'assets/Sound/loop-navegando.mp3',
            viento:    'assets/Sound/viento-noise-20-sec.mp3',
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

    _pickRandom(names) {
        return names[Math.floor(Math.random() * names.length)];
    }

    // ── Public API ──

    /** Enter / gritito — landing + welcome enter buttons, logo buttons */
    enter()      { this._play('gritito', 0.5); }

    /** World nav button click — random memory-click-1..9 */
    switchWorld() {
        const names = ['mem1','mem2','mem3','mem4','mem5','mem6','mem7','mem8','mem9'];
        this._play(this._pickRandom(names), 0.5);
    }

    /** Skin (texture) button click — random click-skin-1..8 */
    click()      {
        const names = ['skin1','skin2','skin3','skin4','skin5','skin6','skin7','skin8'];
        this._play(this._pickRandom(names), 0.55);
    }

    /** Super_Me_Era character click — random super-me-click variants */
    superMeClick() {
        const names = ['superMe0','superMe1','superMe2'];
        this._play(this._pickRandom(names), 0.55);
    }

    /** Presentation club chair click */
    chair() { this._play('chair', 0.6); }

    /** Ambient_Human_Presence cell click — layer transition */
    discover() { this._play('discover', 0.55); }

    /** Fetal_Situation arrow keys — different sound per direction */
    baneraLeft()  { this._play('banera1', 0.6); }
    baneraRight() { this._play('banera2', 0.6); }

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

    // ── Loop API (per-world background layers, fade in/out) ──

    /**
     * Start a looping sound at low volume with fade-in. Idempotent — if the
     * loop is already playing, just ramps to the new target gain.
     */
    startLoop(name, targetGain = 0.2, fadeSec = 1.2) {
        this._init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const begin = () => {
            if (!this._buffers[name]) return;
            // Already playing — re-ramp to new target.
            if (this._loops[name]) {
                const t = this.ctx.currentTime;
                const g = this._loops[name].gain.gain;
                g.cancelScheduledValues(t);
                g.setValueAtTime(g.value, t);
                g.linearRampToValueAtTime(targetGain, t + fadeSec);
                this._loops[name].target = targetGain;
                return;
            }
            const src = this.ctx.createBufferSource();
            const g   = this.ctx.createGain();
            src.buffer = this._buffers[name];
            src.loop = true;
            g.gain.value = 0;
            src.connect(g);
            g.connect(this.ctx.destination);
            const t = this.ctx.currentTime;
            g.gain.linearRampToValueAtTime(targetGain, t + fadeSec);
            src.start();
            this._loops[name] = { src, gain: g, target: targetGain };
        };

        if (!this._buffers[name]) {
            const p = this._pending[name] || this._loading;
            if (p) p.then(begin);
        } else {
            begin();
        }
    }

    /** Stop a looping sound with fade-out. */
    stopLoop(name, fadeSec = 1.2) {
        const loop = this._loops[name];
        if (!loop || !this.ctx) return;
        const t = this.ctx.currentTime;
        const g = loop.gain.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0, t + fadeSec);
        const src = loop.src;
        delete this._loops[name];
        setTimeout(() => { try { src.stop(); } catch (_) {} }, fadeSec * 1000 + 50);
    }

    /** Stop all loops immediately (used on world dispose as safety). */
    stopAllLoops(fadeSec = 0.8) {
        Object.keys(this._loops).forEach(n => this.stopLoop(n, fadeSec));
    }
}

export const uiSound = new UISound();

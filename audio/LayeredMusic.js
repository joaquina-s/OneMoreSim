// audio/LayeredMusic.js
// 4-layer music system: all tracks play simultaneously, always in sync.
// Individual layers can be muted/unmuted without stopping playback.

export default class LayeredMusic {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.layers = {};      // { synth, bass, perc, voice }
        this.isPlaying = false;
        this._beatCallbacks = [];
        this._beatInterval = null;
        this._beatIndex = 0;
        this._startTime = 0;
        this._bpm = 0;
    }

    /**
     * Initialise the audio context and load all 4 layers.
     * Must be called after a user gesture (click) for autoplay policy.
     * @param {number} bpm - beats per minute of the track
     */
    async init(bpm = 120) {
        if (this.audioCtx) return; // already initialised

        this._bpm = bpm;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Master gain (volume control)
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.value = 0.70; // start at 70%
        this.masterGain.connect(this.audioCtx.destination);

        // Define all 5 layers (principal always plays, no toggle)
        const layerDefs = [
            { key: 'principal', src: 'assets/Sound/1-layer-principal-nostalgia.mp3', muted: false },
            { key: 'synth',     src: 'assets/Sound/2-layer-synth-nostalgia.mp3',     muted: false },
            { key: 'bass',      src: 'assets/Sound/4-layer-bass-kick-nostalgia.mp3', muted: false },
            { key: 'perc',      src: 'assets/Sound/3-layer-percussion-nostalgia.mp3', muted: false },
            { key: 'voice',     src: 'assets/Sound/5-layer-voice-nostalgia.mp3',     muted: false },
        ];

        // Fetch and decode all buffers in parallel
        const buffers = await Promise.all(
            layerDefs.map(async (def) => {
                const resp = await fetch(def.src);
                const ab   = await resp.arrayBuffer();
                return this.audioCtx.decodeAudioData(ab);
            })
        );

        // Create a gain + source for each layer
        layerDefs.forEach((def, i) => {
            const gain = this.audioCtx.createGain();
            gain.gain.value = def.muted ? 0 : 1;
            gain.connect(this.masterGain);

            this.layers[def.key] = {
                buffer: buffers[i],
                gain,
                source: null,
                muted: def.muted,
            };
        });
    }

    /**
     * Start all layers simultaneously (called after init).
     * Safe to call multiple times — only starts once.
     */
    play() {
        if (this.isPlaying || !this.audioCtx) return;

        // Resume context if suspended (autoplay policy)
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const now = this.audioCtx.currentTime;
        this._startTime = now;

        for (const key of Object.keys(this.layers)) {
            const layer = this.layers[key];
            const src   = this.audioCtx.createBufferSource();
            src.buffer  = layer.buffer;
            src.loop    = true;
            src.connect(layer.gain);
            src.start(now); // all start at the exact same instant
            layer.source = src;
        }

        this.isPlaying = true;

        // Start the beat tick
        this._startBeatClock();
    }

    /**
     * Mute or unmute a specific layer.
     * The source keeps playing (stays in sync) — only the gain changes.
     * @param {string} key - 'synth' | 'bass' | 'perc' | 'voice'
     * @param {boolean} muted
     */
    setMuted(key, muted) {
        const layer = this.layers[key];
        if (!layer) return;
        layer.muted = muted;
        // Smooth 50ms ramp to avoid click
        layer.gain.gain.linearRampToValueAtTime(
            muted ? 0 : 1,
            this.audioCtx.currentTime + 0.05
        );
    }

    /**
     * Toggle mute state. Returns the new muted value.
     * @param {string} key
     * @returns {boolean} true if now muted
     */
    toggleMute(key) {
        const layer = this.layers[key];
        if (!layer) return false;
        const newMuted = !layer.muted;
        this.setMuted(key, newMuted);
        return newMuted;
    }

    /** @returns {boolean} */
    isMuted(key) {
        return this.layers[key] ? this.layers[key].muted : false;
    }

    /**
     * Set master volume (0–1).
     * @param {number} vol
     */
    setVolume(vol) {
        if (!this.masterGain) return;
        this.masterGain.gain.linearRampToValueAtTime(
            vol,
            this.audioCtx.currentTime + 0.05
        );
    }

    /**
     * Get the AnalyserNode for the spectrogram (connected to master output).
     * Creates one lazily.
     */
    getAnalyser() {
        if (!this._analyser && this.audioCtx) {
            this._analyser = this.audioCtx.createAnalyser();
            this._analyser.fftSize = 2048;
            this._analyser.smoothingTimeConstant = 0.8;
            // Insert between masterGain and destination
            this.masterGain.disconnect();
            this.masterGain.connect(this._analyser);
            this._analyser.connect(this.audioCtx.destination);
        }
        return this._analyser;
    }

    /**
     * Get per-layer AnalyserNodes for multi-color spectrogram.
     * Creates lazily. Each layer gets its own analyser spliced AFTER
     * the layer's gain node (so it respects mute state).
     * @returns {Object} { key: AnalyserNode }
     */
    getLayerAnalysers() {
        if (!this._layerAnalysers) {
            this._layerAnalysers = {};
            for (const [key, layer] of Object.entries(this.layers)) {
                const an = this.audioCtx.createAnalyser();
                an.fftSize = 1024;
                an.smoothingTimeConstant = 0.82;
                // Tap from the layer gain (post-mute)
                layer.gain.connect(an);
                this._layerAnalysers[key] = an;
            }
        }
        return this._layerAnalysers;
    }

    /**
     * Register a callback that fires on every quarter-note beat.
     * @param {function(beatIndex: number)} fn
     */
    onBeat(fn) {
        this._beatCallbacks.push(fn);
    }

    // ── internal beat clock ──
    _startBeatClock() {
        if (this._beatInterval) clearInterval(this._beatInterval);
        const msPerBeat = 60000 / this._bpm;
        this._beatIndex = 0;
        this._beatInterval = setInterval(() => {
            this._beatCallbacks.forEach(fn => fn(this._beatIndex));
            this._beatIndex = (this._beatIndex + 1) % 4;
        }, msPerBeat);
    }

    /** Clean-up */
    dispose() {
        if (this._beatInterval) clearInterval(this._beatInterval);
        for (const layer of Object.values(this.layers)) {
            if (layer.source) { try { layer.source.stop(); } catch (_) {} }
        }
        if (this.audioCtx) this.audioCtx.close();
        this.isPlaying = false;
    }
}

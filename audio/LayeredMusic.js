// audio/LayeredMusic.js
// 5-layer music system. Uses HTMLAudioElement + MediaElementAudioSourceNode
// instead of BufferSource so iOS Safari (which silences WebAudio when the
// physical mute switch is on, and has stricter unlock rules) plays audio
// reliably. The WebAudio graph (gain + analyser) is kept so the spectrogram
// and per-layer mute still work.

export default class LayeredMusic {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.layers = {};
        this.isPlaying = false;
        this._beatCallbacks = [];
        this._beatInterval = null;
        this._beatIndex = 0;
        this._startTime = 0;
        this._bpm = 0;
    }

    async init(bpm = 120) {
        if (this.audioCtx) return;

        this._bpm = bpm;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.value = 0.70;
        this.masterGain.connect(this.audioCtx.destination);

        const layerDefs = [
            { key: 'principal', src: 'assets/Sound/1-layer-principal-one-more-sim.mp3', muted: false },
            { key: 'synth',     src: 'assets/Sound/2-layer-synth-one-more-sim.mp3',     muted: false },
            { key: 'bass',      src: 'assets/Sound/4-layer-bass-one-more-sim.mp3',      muted: false },
            { key: 'perc',      src: 'assets/Sound/3-layer-percu-one-more-sim.mp3',     muted: false },
            { key: 'voice',     src: 'assets/Sound/5-layer-voice-one-more-sim.mp3',     muted: false },
        ];

        // Create one HTMLAudioElement per layer + a gain node. We DON'T wire
        // the MediaElementSource to the WebAudio graph yet — that has to
        // happen lazily inside the first user-gesture call to play(),
        // because creating a MediaElementSource on a not-yet-played element
        // can fail on Safari.
        await Promise.all(layerDefs.map((def) => new Promise((resolve) => {
            const el = new Audio();
            el.src = def.src;
            el.loop = true;
            el.crossOrigin = 'anonymous';
            el.preload = 'auto';
            el.muted = false;
            // playsInline avoids iOS opening the native fullscreen player
            el.setAttribute('playsinline', '');
            el.setAttribute('webkit-playsinline', '');

            const gain = this.audioCtx.createGain();
            gain.gain.value = def.muted ? 0 : 1;
            gain.connect(this.masterGain);

            this.layers[def.key] = {
                el,
                gain,
                mediaSource: null,
                muted: def.muted,
            };

            // Wait until the file is far enough buffered to play through
            const ready = () => { el.removeEventListener('canplaythrough', ready); resolve(); };
            el.addEventListener('canplaythrough', ready);
            el.addEventListener('error', ready); // resolve anyway so init finishes
            // Force load() in case browser is lazy
            try { el.load(); } catch (_) {}
        })));
    }

    /**
     * Start all layers simultaneously. MUST be called synchronously inside
     * a user-gesture handler — no `await` between the gesture and this call.
     */
    play() {
        if (this.isPlaying || !this.audioCtx) return;

        // Resume context (sync, never await)
        if (this.audioCtx.state === 'suspended') {
            try { this.audioCtx.resume(); } catch (_) {}
        }

        // Wire each HTMLAudio into the WebAudio graph (lazy, once) and start
        // playback. Calling .play() on each <audio> inside the gesture is
        // what unlocks iOS Safari's audio output.
        for (const key of Object.keys(this.layers)) {
            const layer = this.layers[key];
            if (!layer.mediaSource) {
                try {
                    layer.mediaSource = this.audioCtx.createMediaElementSource(layer.el);
                    layer.mediaSource.connect(layer.gain);
                } catch (e) {
                    // If already connected or fails, fall back to direct output
                    console.warn('[LayeredMusic] mediaSource connect failed', key, e);
                }
            }
            try {
                layer.el.currentTime = 0;
                const p = layer.el.play();
                if (p && p.catch) p.catch((err) => console.warn('[LayeredMusic] play()', key, err));
            } catch (e) {
                console.warn('[LayeredMusic] play exception', key, e);
            }
        }

        this._startTime = this.audioCtx.currentTime;
        this.isPlaying = true;
        this._startBeatClock();
    }

    setMuted(key, muted) {
        const layer = this.layers[key];
        if (!layer) return;
        layer.muted = muted;
        layer.gain.gain.linearRampToValueAtTime(
            muted ? 0 : 1,
            this.audioCtx.currentTime + 0.05
        );
    }

    toggleMute(key) {
        const layer = this.layers[key];
        if (!layer) return false;
        const newMuted = !layer.muted;
        this.setMuted(key, newMuted);
        return newMuted;
    }

    isMuted(key) {
        return this.layers[key] ? this.layers[key].muted : false;
    }

    setVolume(vol) {
        if (!this.masterGain) return;
        this.masterGain.gain.linearRampToValueAtTime(
            vol,
            this.audioCtx.currentTime + 0.05
        );
    }

    getAnalyser() {
        if (!this._analyser && this.audioCtx) {
            this._analyser = this.audioCtx.createAnalyser();
            this._analyser.fftSize = 2048;
            this._analyser.smoothingTimeConstant = 0.8;
            this.masterGain.disconnect();
            this.masterGain.connect(this._analyser);
            this._analyser.connect(this.audioCtx.destination);
        }
        return this._analyser;
    }

    getLayerAnalysers() {
        if (!this._layerAnalysers) {
            this._layerAnalysers = {};
            for (const [key, layer] of Object.entries(this.layers)) {
                const an = this.audioCtx.createAnalyser();
                an.fftSize = 1024;
                an.smoothingTimeConstant = 0.82;
                layer.gain.connect(an);
                this._layerAnalysers[key] = an;
            }
        }
        return this._layerAnalysers;
    }

    onBeat(fn) {
        this._beatCallbacks.push(fn);
    }

    _startBeatClock() {
        if (this._beatInterval) clearInterval(this._beatInterval);
        const msPerBeat = 60000 / this._bpm;
        this._beatIndex = 0;
        this._beatInterval = setInterval(() => {
            this._beatCallbacks.forEach(fn => fn(this._beatIndex));
            this._beatIndex = (this._beatIndex + 1) % 4;
        }, msPerBeat);
    }

    dispose() {
        if (this._beatInterval) clearInterval(this._beatInterval);
        for (const layer of Object.values(this.layers)) {
            if (layer.el) {
                try { layer.el.pause(); } catch (_) {}
                try { layer.el.src = ''; } catch (_) {}
            }
        }
        if (this.audioCtx) this.audioCtx.close();
        this.isPlaying = false;
    }
}

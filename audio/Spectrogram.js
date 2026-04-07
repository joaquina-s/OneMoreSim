// audio/Spectrogram.js
// Visualización de audio en tiempo real estilo waterfall

class Spectrogram {
    constructor(containerEl) {
        this.containerEl = containerEl;
        this.audioCtx = null;
        this.analyser = null;
        this.source = null;
        this.canvas = null;
        this.ctx = null;
        this.animFrame = null;
        this.isPlaying = false;
        this.audioBuffer = null;
    }

    /**
     * Original init: creates its own AudioContext and loads a single track.
     */
    async init(audioSrc) {
        this._setupCanvas();

        // Create AudioContext
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // Load MP3
        const response = await fetch(audioSrc);
        const arrayBuffer = await response.arrayBuffer();
        this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);

        // AnalyserNode
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;
        this.analyser.connect(this.audioCtx.destination);

        await this._startPlayback();

        if (this.audioCtx.state === 'suspended') {
            console.warn('AudioContext suspended. Waiting for user interaction.');
            const resume = async () => {
                if (this.audioCtx.state === 'suspended') {
                    await this.audioCtx.resume();
                }
                document.removeEventListener('click', resume);
                document.removeEventListener('keydown', resume);
            };
            document.addEventListener('click', resume);
            document.addEventListener('keydown', resume);
        }

        this._drawLoop();
    }

    /**
     * Alternative init: use an external AnalyserNode (from LayeredMusic).
     * No audio loading — only visualisation.
     */
    initFromAnalyser(analyserNode) {
        this._setupCanvas();
        this.analyser = analyserNode;
        this._drawLoop();
    }

    /**
     * Multi-layer init: each layer gets its own colour band.
     * @param {Object} layerAnalysers - { key: AnalyserNode }
     * @param {Object} layerColors   - { key: [r,g,b] } peak colours
     */
    initMultiLayer(layerAnalysers, layerColors) {
        this._setupCanvas();
        this._multiLayers = Object.entries(layerAnalysers).map(([key, an]) => ({
            key,
            analyser: an,
            color: layerColors[key] || [0, 120, 255],
        }));
        this._drawLoopMulti();
    }

    /** Shared canvas setup */
    _setupCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            width: 100%;
            height: 100%;
            display: block;
            image-rendering: pixelated;
        `;
        this.containerEl.innerHTML = '';
        this.containerEl.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        const rect = this.containerEl.getBoundingClientRect();
        this.canvas.width = Math.floor(rect.width);
        this.canvas.height = Math.floor(rect.height);
        this.w = this.canvas.width;
        this.h = this.canvas.height;
    }

    async _startPlayback() {
        if (this.source) {
            this.source.disconnect();
        }

        this.source = this.audioCtx.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.loop = true;
        this.source.connect(this.analyser);
        this.source.start(0);
        this.isPlaying = true;

        this.source.onended = () => {
            this.isPlaying = false;
        };
    }

    _lerp(a, b, t) {
        return a + (b - a) * t;
    }

    _valueToColor(value) {
        // value va de 0.0 (silencio) a 1.0 (pico máximo)
        if (value < 0.001) {
            return [5, 10, 20]; // Negro azulado — silencio total
        }

        if (value < 0.25) {
            // Lerp entre [5, 10, 20] y [0, 30, 80]
            const t = value / 0.25;
            return [
                Math.floor(this._lerp(5, 0, t)),
                Math.floor(this._lerp(10, 30, t)),
                Math.floor(this._lerp(20, 80, t))
            ];
        }

        if (value < 0.55) {
            // Lerp entre [0, 30, 80] y [0, 100, 200]
            const t = (value - 0.25) / 0.30;
            return [
                Math.floor(this._lerp(0, 0, t)),
                Math.floor(this._lerp(30, 100, t)),
                Math.floor(this._lerp(80, 200, t))
            ];
        }

        if (value < 0.80) {
            // Lerp entre [0, 100, 200] y [0, 200, 255]
            const t = (value - 0.55) / 0.25;
            return [
                Math.floor(this._lerp(0, 0, t)),
                Math.floor(this._lerp(100, 200, t)),
                Math.floor(this._lerp(200, 255, t))
            ];
        }

        // value >= 0.80 — picos máximos
        // Lerp entre [0, 200, 255] y [180, 240, 255]
        const t = (value - 0.80) / 0.20;
        return [
            Math.floor(this._lerp(0, 180, t)),
            Math.floor(this._lerp(200, 240, t)),
            Math.floor(this._lerp(255, 255, t))
        ];
    }

    _drawLoop() {
        this.animFrame = requestAnimationFrame(() => this._drawLoop());

        if (!this.analyser) return;

        // Check dimensions asynchronously in case container was hidden during init
        if (this.canvas.width === 0 || this.canvas.height === 0) {
            const rect = this.containerEl.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                this.canvas.width = Math.floor(rect.width);
                this.canvas.height = Math.floor(rect.height);
                this.w = this.canvas.width;
                this.h = this.canvas.height;
            } else {
                return; // Container still hidden/zero size, skip drawing
            }
        }

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        // Crear nueva columna de pixels en el borde derecho
        const imageData = this.ctx.createImageData(1, this.h);

        for (let y = 0; y < this.h; y++) {
            // Cutoff at ~30% of Nyquist (around 6.6kHz) to make bass/mids fill the canvas
            const freqIndex = Math.floor((1 - y / this.h) * bufferLength * 0.3);

            // Amplify the value so ambient tracks still look dynamic
            let value = (dataArray[Math.min(freqIndex, bufferLength - 1)] / 255) * 1.5;
            value = Math.min(1.0, value); // Clamp to 1.0

            const [r, g, b] = this._valueToColor(value);
            const i = y * 4;

            imageData.data[i] = r;
            imageData.data[i + 1] = g;
            imageData.data[i + 2] = b;
            imageData.data[i + 3] = 255;
        }

        // Desplazar el canvas actual un pixel hacia la izquierda (efecto waterfall)
        this.ctx.drawImage(this.canvas, -1, 0);

        // Dibujar la nueva columna analizada en el extremo derecho
        this.ctx.putImageData(imageData, this.w - 1, 0);
    }

    /**
     * Multi-layer draw loop: each layer gets its own colour.
     * Frequency data from all layers is additively blended into one column.
     */
    _drawLoopMulti() {
        this.animFrame = requestAnimationFrame(() => this._drawLoopMulti());

        if (!this._multiLayers || this._multiLayers.length === 0) return;

        // Lazy resize if container was hidden during init
        if (this.canvas.width === 0 || this.canvas.height === 0) {
            const rect = this.containerEl.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                this.canvas.width = Math.floor(rect.width);
                this.canvas.height = Math.floor(rect.height);
                this.w = this.canvas.width;
                this.h = this.canvas.height;
            } else {
                return;
            }
        }

        const imageData = this.ctx.createImageData(1, this.h);

        // Accumulator per pixel row — start black
        const accR = new Float32Array(this.h);
        const accG = new Float32Array(this.h);
        const accB = new Float32Array(this.h);

        for (const layer of this._multiLayers) {
            const bufferLength = layer.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            layer.analyser.getByteFrequencyData(dataArray);

            const [lr, lg, lb] = layer.color; // peak colour for this layer

            for (let y = 0; y < this.h; y++) {
                // Same frequency mapping as single-layer: cut at ~30% Nyquist
                const freqIndex = Math.floor((1 - y / this.h) * bufferLength * 0.3);
                let value = (dataArray[Math.min(freqIndex, bufferLength - 1)] / 255) * 1.5;
                value = Math.min(1.0, value);

                // Intensity curve: slight power ramp so quiet parts stay dark
                const intensity = value * value;

                accR[y] += lr * intensity;
                accG[y] += lg * intensity;
                accB[y] += lb * intensity;
            }
        }

        // Write accumulated colour to image data, clamped to 255
        for (let y = 0; y < this.h; y++) {
            const i = y * 4;
            // Add a tiny base so silence isn't pure black (match single-layer aesthetic)
            imageData.data[i]     = Math.min(255, Math.floor(accR[y]) + 3);
            imageData.data[i + 1] = Math.min(255, Math.floor(accG[y]) + 4);
            imageData.data[i + 2] = Math.min(255, Math.floor(accB[y]) + 10);
            imageData.data[i + 3] = 255;
        }

        // Waterfall scroll left
        this.ctx.drawImage(this.canvas, -1, 0);
        this.ctx.putImageData(imageData, this.w - 1, 0);
    }

    dispose() {
        if (this.animFrame) cancelAnimationFrame(this.animFrame);
        if (this.source) {
            try {
                this.source.stop();
            } catch (e) { }
        }
        if (this.audioCtx) this.audioCtx.close();
        this.isPlaying = false;

        if (this.containerEl) {
            this.containerEl.innerHTML = '';
        }
    }
}

export default Spectrogram;

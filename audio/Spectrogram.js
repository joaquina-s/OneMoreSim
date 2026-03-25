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

    async init(audioSrc) {
        // 1. Crear el canvas y agregarlo al containerEl
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

        // 2. Ajustar resolución del canvas al tamaño real del contenedor
        const rect = this.containerEl.getBoundingClientRect();
        this.canvas.width = Math.floor(rect.width);
        this.canvas.height = Math.floor(rect.height);
        this.w = this.canvas.width;
        this.h = this.canvas.height;

        // 3. Crear AudioContext
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        // 4. Cargar el MP3 via fetch + decodeAudioData
        const response = await fetch(audioSrc);
        const arrayBuffer = await response.arrayBuffer();
        this.audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);

        // 5. Crear AnalyserNode
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;
        this.analyser.connect(this.audioCtx.destination);

        // 6. Handle Autoplay / Suspension
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

        // 7. Arrancar el loop de dibujo
        this._drawLoop();
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

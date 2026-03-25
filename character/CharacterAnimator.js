// character/CharacterAnimator.js
// Procedural humanoid character drawn with Canvas 2D API.
// No external assets required. Designed for future GIF replacement.

export default class CharacterAnimator {
    /**
     * @param {HTMLElement} containerEl - #character-display
     * @param {HTMLElement} buttonsEl   - #texture-buttons
     */
    constructor(containerEl, buttonsEl) {
        this.container = containerEl;
        this.buttonsEl = buttonsEl;

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'char-canvas';
        this.ctx = this.canvas.getContext('2d');

        // Remove placeholder text
        const placeholder = containerEl.querySelector('.char-placeholder');
        if (placeholder) placeholder.style.display = 'none';

        containerEl.appendChild(this.canvas);

        this.activeTexture = 0;
        this.time = 0;
        this.textures = [];
        this._transitioning = false;
        this._resizeObserver = null;
    }

    /**
     * Initialize with texture array and wire buttons.
     * @param {Array} textures - from textures.js
     */
    init(textures) {
        this.textures = textures;

        // Size canvas to container
        this._sizeCanvas();

        // ResizeObserver for responsive sizing
        this._resizeObserver = new ResizeObserver(() => this._sizeCanvas());
        this._resizeObserver.observe(this.container);

        // Wire the 8 texture buttons
        const buttons = this.buttonsEl.querySelectorAll('.texture-btn');
        buttons.forEach((btn, i) => {
            // Set button color from skin data
            if (textures[i]) {
                btn.style.setProperty('--btn-color', textures[i].color);
                btn.style.backgroundColor = textures[i].color;
            }

            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.texture, 10);
                this.switchTexture(id);
            });
        });

        // Mark button 0 as active
        buttons[0]?.classList.add('active');

        // Set initial glow color
        this._updateGlow(textures[0]);
    }

    /**
     * Switch to a different skin with fade transition.
     * @param {number} id
     */
    switchTexture(id) {
        if (id === this.activeTexture || this._transitioning) return;
        if (id < 0 || id >= this.textures.length) return;

        this._transitioning = true;

        // Fade out
        this.canvas.style.opacity = '0';

        setTimeout(() => {
            this.activeTexture = id;

            // Update button active state
            const buttons = this.buttonsEl.querySelectorAll('.texture-btn');
            buttons.forEach(btn => btn.classList.remove('active'));
            buttons[id]?.classList.add('active');

            // Update glow
            this._updateGlow(this.textures[id]);

            // Update mobile FAB swatch color
            const fabSwatch = document.querySelector('.fab-swatch');
            if (fabSwatch) {
                fabSwatch.style.backgroundColor = this.textures[id].color;
            }

            // Also update drawer buttons' active state
            const drawerBtns = document.querySelectorAll('#texture-drawer .texture-btn');
            drawerBtns.forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.texture, 10) === id);
            });

            // Fade in
            this.canvas.style.opacity = '1';
            this._transitioning = false;
        }, 200);
    }

    /**
     * Called every frame from the animation loop.
     * @param {number} time - elapsed seconds
     */
    tick(time) {
        this.time = time;
        this._draw();
    }

    // ─── Private ───

    _sizeCanvas() {
        const rect = this.container.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    _updateGlow(skin) {
        if (!skin) return;
        const glowColor = skin.colorGlow;
        this.container.style.setProperty('--char-glow-color', glowColor + '44');
    }

    _draw() {
        const ctx = this.ctx;
        const rect = this.container.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;

        if (w === 0 || h === 0) return;

        ctx.clearRect(0, 0, w, h);

        const skin = this.textures[this.activeTexture];
        if (!skin) return;

        // For ARCOIRIS (id 7), cycle the glow color
        let effectiveSkin = skin;
        if (skin.id === 7) {
            const hue = (this.time * 60) % 360;
            effectiveSkin = {
                ...skin,
                colorGlow: `hsl(${hue}, 100%, 70%)`,
                colorDetail: `hsla(${(hue + 30) % 360}, 100%, 75%, 0.6)`,
                colorBase: `hsla(${hue}, 80%, 40%, 0.3)`
            };
            // Update glow on container too
            this.container.style.setProperty('--char-glow-color',
                `hsla(${hue}, 100%, 70%, 0.27)`);
        }

        this._drawHumanoid(effectiveSkin, w, h);
    }

    _drawHumanoid(skin, w, h) {
        const ctx = this.ctx;
        const cx = w / 2;
        const u = w / 8;
        const t = this.time;

        // ── Animation offsets ──
        const floatY = Math.sin(t * 1.5) * (u * 0.3);
        const breathScale = 1 + Math.sin(t * 2) * 0.02;
        const glowPulse = 20 + Math.sin(t * 3) * 8;

        // ── Parts definition ──
        const parts = {
            headX: cx,
            headY: h * 0.18 + floatY,
            headR: u * 1.2,

            neckX: cx - u * 0.2,
            neckY: h * 0.25 + floatY,
            neckW: u * 0.4,
            neckH: u * 0.6,

            torsoX: cx - u * 1.2 * breathScale,
            torsoY: h * 0.30 + floatY,
            torsoW: u * 2.4 * breathScale,
            torsoH: u * 3,

            hipX: cx,
            hipY: h * 0.54 + floatY,
            hipRx: u * 1.0,
            hipRy: u * 0.5,

            lArmX: cx - u * 1.8,
            lArmY: h * 0.28 + floatY + Math.sin(t * 1.2) * 2,
            armW: u * 0.5,
            armH: u * 3.2,

            rArmX: cx + u * 1.3,
            rArmY: h * 0.28 + floatY + Math.sin(t * 1.2 + 1) * 2,

            lLegX: cx - u * 1.0,
            lLegY: h * 0.55 + floatY,
            legW: u * 0.7,
            legH: u * 3.5,

            rLegX: cx + u * 0.3,
            rLegY: h * 0.55 + floatY,
        };

        const rr = u * 0.2; // roundRect corner radius

        // ── 1. SILUETA BASE ──
        ctx.save();
        ctx.fillStyle = skin.colorBase;

        // Head
        ctx.beginPath();
        ctx.arc(parts.headX, parts.headY, parts.headR, 0, Math.PI * 2);
        ctx.fill();

        // Neck
        this._roundRect(ctx, parts.neckX, parts.neckY, parts.neckW, parts.neckH, rr * 0.5);
        ctx.fill();

        // Torso
        this._roundRect(ctx, parts.torsoX, parts.torsoY, parts.torsoW, parts.torsoH, rr);
        ctx.fill();

        // Hips
        ctx.beginPath();
        ctx.ellipse(parts.hipX, parts.hipY, parts.hipRx, parts.hipRy, 0, 0, Math.PI * 2);
        ctx.fill();

        // Arms
        this._roundRect(ctx, parts.lArmX, parts.lArmY, parts.armW, parts.armH, rr);
        ctx.fill();
        this._roundRect(ctx, parts.rArmX, parts.rArmY, parts.armW, parts.armH, rr);
        ctx.fill();

        // Legs
        this._roundRect(ctx, parts.lLegX, parts.lLegY, parts.legW, parts.legH, rr);
        ctx.fill();
        this._roundRect(ctx, parts.rLegX, parts.rLegY, parts.legW, parts.legH, rr);
        ctx.fill();

        ctx.restore();

        // ── 2. BORDE EXTERIOR GLOWING ──
        ctx.save();
        ctx.shadowBlur = glowPulse;
        ctx.shadowColor = skin.colorGlow;
        ctx.strokeStyle = skin.colorGlow;
        ctx.lineWidth = 2;

        // Head
        ctx.beginPath();
        ctx.arc(parts.headX, parts.headY, parts.headR, 0, Math.PI * 2);
        ctx.stroke();

        // Torso
        this._roundRect(ctx, parts.torsoX, parts.torsoY, parts.torsoW, parts.torsoH, rr);
        ctx.stroke();

        // Arms
        this._roundRect(ctx, parts.lArmX, parts.lArmY, parts.armW, parts.armH, rr);
        ctx.stroke();
        this._roundRect(ctx, parts.rArmX, parts.rArmY, parts.armW, parts.armH, rr);
        ctx.stroke();

        // Legs
        this._roundRect(ctx, parts.lLegX, parts.lLegY, parts.legW, parts.legH, rr);
        ctx.stroke();
        this._roundRect(ctx, parts.rLegX, parts.rLegY, parts.legW, parts.legH, rr);
        ctx.stroke();

        // Hips
        ctx.beginPath();
        ctx.ellipse(parts.hipX, parts.hipY, parts.hipRx, parts.hipRy, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

        // ── 3. DETALLES INTERNOS (energy lines in torso) ──
        ctx.save();
        ctx.strokeStyle = skin.colorDetail;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 4;
        ctx.shadowColor = skin.colorGlow;

        for (let i = 0; i < 4; i++) {
            const lineX = parts.torsoX + parts.torsoW * (0.2 + i * 0.2);
            const alpha = 0.3 + Math.sin(t * 2.5 + i * 1.5) * 0.3;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(lineX, parts.torsoY + u * 0.3);
            // Curved line
            const cpX = lineX + Math.sin(t * 3 + i) * u * 0.3;
            ctx.quadraticCurveTo(cpX, parts.torsoY + parts.torsoH * 0.5,
                lineX, parts.torsoY + parts.torsoH - u * 0.3);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // ── 4. ENERGY CORE (chest) ──
        ctx.save();
        const coreR = u * 0.5 + Math.sin(t * 4) * u * 0.1;
        const coreX = cx;
        const coreY = parts.torsoY + parts.torsoH * 0.35;

        const grad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR);
        grad.addColorStop(0, skin.colorGlow);
        grad.addColorStop(0.5, skin.colorGlow + '88');
        grad.addColorStop(1, 'transparent');

        ctx.shadowBlur = 30;
        ctx.shadowColor = skin.colorGlow;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright dot
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(coreX, coreY, u * 0.12, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // ── 5. "EYE" details on head ──
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = skin.colorGlow;
        ctx.fillStyle = skin.colorGlow;
        const eyeSpacing = u * 0.4;
        const eyeY = parts.headY - u * 0.1;
        const eyeR = u * 0.15;
        // Left eye
        ctx.beginPath();
        ctx.arc(parts.headX - eyeSpacing, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();
        // Right eye
        ctx.beginPath();
        ctx.arc(parts.headX + eyeSpacing, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // ── 6. FLOATING PARTICLES ──
        if (skin.particles) {
            ctx.save();
            const particleCount = 7;
            for (let i = 0; i < particleCount; i++) {
                const angle = (t * 0.8 + i * (Math.PI * 2 / particleCount));
                const orbitR = u * 2.5 + Math.sin(t * 1.5 + i * 2) * u * 0.8;
                const px = cx + Math.cos(angle) * orbitR;
                const py = h * 0.38 + floatY + Math.sin(angle) * orbitR * 0.6;
                const pr = 2 + Math.sin(t * 3 + i) * 1.5;
                const alpha = 0.4 + Math.sin(t * 2.5 + i * 1.3) * 0.4;

                ctx.globalAlpha = alpha;
                ctx.shadowBlur = 8;
                ctx.shadowColor = skin.colorGlow;
                ctx.fillStyle = skin.colorGlow;
                ctx.beginPath();
                ctx.arc(px, py, pr, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.restore();
        }
    }

    /**
     * Draw a rounded rectangle path (compatible with older browsers).
     */
    _roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}

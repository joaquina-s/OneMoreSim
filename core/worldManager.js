// core/worldManager.js
// Dynamic WorldManager — manages lazy loading, activation and disposal of 8 worlds.
// Uses global THREE and gsap (from CDN script tags).

export class WorldManager {
    /**
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.EffectComposer} composer
     * @param {HTMLElement} canvasContainer - #canvas-area element (for fade transitions)
     */
    constructor(renderer, composer, canvasContainer) {
        this.renderer = renderer;
        this.composer = composer;
        this.canvasContainer = canvasContainer;

        /** @type {Map<string, Function>} id → loaderFn */
        this.worlds = new Map();

        /** @type {Map<string, object>} id → cached module */
        this.cache = new Map();

        this.activeModule = null;
        this.activeId = null;
        this._transitioning = false;

        // DOM refs
        this._loader = document.getElementById('world-loader');
        this._worldName = document.getElementById('active-world-name');
        this._worldButtons = document.querySelectorAll('.world-btn');
    }

    // ─── World names for the header HUD ───
    static WORLD_NAMES = {
        '0': 'CAROUSEL', '1': 'TERRAIN', '2': 'ARRAY-3D', '3': 'TUNNEL',
        '4': 'VÓRTICE', '5': 'NEBULOSA', '6': 'OCÉANO', '7': 'CRISTAL', '9': 'LAYER'
    };

    /**
     * Register a world with a lazy loader function.
     * @param {string} id - world id ('0'–'7')
     * @param {Function} loaderFn - () => Promise<module>
     */
    register(id, loaderFn) {
        this.worlds.set(id, loaderFn);
    }

    /**
     * Activate the landing module (special case — no transition UI).
     * @param {object} landingModule
     */
    activateLanding(landingModule) {
        if (this.activeModule && this.activeModule.dispose) {
            this.activeModule.dispose();
        }
        this.activeModule = landingModule;
        this.activeId = 'landing';
        landingModule.init(this.renderer);
    }

    /**
     * Activate a world by id with full transition.
     * @param {string} id
     */
    async activate(id) {
        // Guard: same world or already transitioning
        if (id === this.activeId || this._transitioning) return;
        if (!this.worlds.has(id)) {
            console.warn(`WorldManager: world "${id}" not registered.`);
            return;
        }

        this._transitioning = true;

        const canvas = this.renderer.domElement;

        try {
            // 1. Fade out canvas
            await this._gsapTo(canvas, { opacity: 0, duration: 0.3 });

            // 2. Show loader
            this._showLoader();

            // 3. Dispose current world
            if (this.activeModule && this.activeModule.dispose) {
                this.activeModule.dispose();
            }
            // Deep-clean render lists
            if (this.renderer.renderLists) {
                this.renderer.renderLists.dispose();
            }
            // Clear all passes from the composer (composer may be null on mobile)
            if (this.composer && this.composer.passes) {
                this.composer.passes.length = 0;
            }

            this.activeModule = null;

            // 4. Load module (from cache or loaderFn)
            let mod;
            if (this.cache.has(id)) {
                mod = this.cache.get(id);
            } else {
                const loaderFn = this.worlds.get(id);
                const result = await loaderFn();
                // Support both default exports and named exports
                mod = result.default || result;
                this.cache.set(id, mod);
            }

            // 5. Init the new world
            mod.init(this.renderer, this.composer);

            // 6. Update active state
            this.activeModule = mod;
            this.activeId = id;

            // 7. Update UI: buttons
            this._worldButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.world === id);
            });

            // 8. Update UI: header world name
            if (this._worldName) {
                this._worldName.textContent = WorldManager.WORLD_NAMES[id] || `WORLD ${id}`;
            }

            // 9. Hide loader, fade in canvas
            this._hideLoader();
            await this._gsapTo(canvas, { opacity: 1, duration: 0.5 });
        } catch (err) {
            console.error(`WorldManager: activate failed for "${id}"`, err);
            
            // On-screen debug helper for the USER
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'position:fixed; top:20px; left:20px; background:rgba(255,0,0,0.8); color:white; padding:20px; z-index:9999; font-family:monospace; pointer-events:none; white-space:pre-wrap;';
            errorDiv.textContent = `Error loading world ${id}:\n\n${err.message}\n${err.stack}`;
            document.body.appendChild(errorDiv);
            setTimeout(() => { if (errorDiv.parentNode) errorDiv.parentNode.removeChild(errorDiv); }, 8000);

            this._hideLoader();
            canvas.style.opacity = '1';
        } finally {
            this._transitioning = false;
        }
    }

    /**
     * Preload a world module without activating it.
     * @param {string} id
     */
    async preload(id) {
        if (this.cache.has(id) || !this.worlds.has(id)) return;
        try {
            const loaderFn = this.worlds.get(id);
            const result = await loaderFn();
            const mod = result.default || result;
            this.cache.set(id, mod);
        } catch (e) {
            console.warn(`WorldManager: preload failed for "${id}"`, e);
        }
    }

    /**
     * Called every frame from the animation loop.
     * @param {number} time
     * @param {object} keys
     */
    tick(time, keys) {
        if (this.activeModule && this.activeModule.update) {
            
            // Global Orbit Navigation via Left/Right Arrows
            if (this.activeModule.camera && this.activeModule._orbitControls && this.activeModule._orbitControls.enabled !== false) {
                if (keys && (keys.left || keys.right)) {
                    const cam = this.activeModule.camera;
                    const target = this.activeModule._orbitControls.target;
                    
                    const angle = 0.02 * (keys.right ? 1 : -1);
                    
                    // Simple 2D rotation around Y
                    const dx = cam.position.x - target.x;
                    const dz = cam.position.z - target.z;
                    
                    const cosA = Math.cos(angle);
                    const sinA = Math.sin(angle);
                    
                    cam.position.x = target.x + dx * cosA - dz * sinA;
                    cam.position.z = target.z + dx * sinA + dz * cosA;
                    
                    cam.lookAt(target);
                }
            }

            if (this.activeId === 'landing') {
                this.activeModule.update(time, keys, this.renderer);
            } else {
                this.activeModule.update(time, keys);
            }
        }
    }

    /**
     * Returns the id of the currently active world.
     * @returns {string|null}
     */
    getCurrentId() {
        return this.activeId;
    }

    // Kept for backward compat with resize handler
    getActive() {
        return this.activeId;
    }

    // ─── Private helpers ───

    _showLoader() {
        if (this._loader) this._loader.style.display = 'flex';
    }

    _hideLoader() {
        if (this._loader) this._loader.style.display = 'none';
    }

    /**
     * Promisified gsap.to
     */
    _gsapTo(target, vars) {
        return new Promise(resolve => {
            gsap.to(target, { ...vars, onComplete: resolve });
        });
    }
}

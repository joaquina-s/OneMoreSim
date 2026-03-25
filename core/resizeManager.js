// core/resizeManager.js
// Centralised resize handling with debounce.
// Dispatches 'device-change' CustomEvent when device type changes.

import { deviceProfile, refreshProfile } from './deviceProfile.js';

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

export class ResizeManager {
    /**
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.EffectComposer|null} composer
     * @param {Function} getCameraFn — returns the active camera (may change per world)
     * @param {object} worldManager
     */
    constructor(renderer, composer, getCameraFn, worldManager) {
        this.renderer = renderer;
        this.composer = composer;
        this._getCamera = getCameraFn;
        this.worldManager = worldManager;
    }

    getCamera() {
        return this._getCamera();
    }

    init() {
        window.addEventListener('resize', debounce(() => this._onResize(), 200));
    }

    _onResize() {
        const prevType = deviceProfile.isMobile ? 'm'
            : deviceProfile.isTablet ? 't' : 'd';

        refreshProfile();

        const newType = deviceProfile.isMobile ? 'm'
            : deviceProfile.isTablet ? 't' : 'd';

        // Determine container
        const isLanding = this.worldManager.getActive() === 'landing';
        let w, h;

        if (isLanding) {
            w = window.innerWidth;
            h = window.innerHeight;
            this.renderer.setSize(w, h);
        } else {
            const container = document.getElementById('canvas-area');
            w = container.clientWidth;
            h = container.clientHeight;
            this.renderer.setSize(w, h, false);
        }

        this.renderer.setPixelRatio(deviceProfile.dpr);

        // Update camera
        const camera = this._getCamera();
        if (camera) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }

        // Update composer
        if (this.composer) {
            this.composer.setSize(w, h);
        }

        // Emit device-change if type changed
        if (prevType !== newType) {
            window.dispatchEvent(new CustomEvent('device-change', {
                detail: deviceProfile
            }));
        }
    }
}

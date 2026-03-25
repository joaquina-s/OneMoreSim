// worlds/world-placeholder.js
// Placeholder world for unimplemented simulations (worlds 1–7).
// Shows a "EN CONSTRUCCIÓN" message over a minimal Three.js scene.

let _scene = null;
let _camera = null;
let _composer = null;
let _renderPass = null;
let _overlayEl = null;

// World names matching the nav buttons
const NAMES = {
    '1': 'TERRAIN', '2': 'ARRAY-3D', '3': 'TUNNEL',
    '4': 'VÓRTICE', '5': 'NEBULOSA', '6': 'OCÉANO', '7': 'CRISTAL'
};

/**
 * Creates a placeholder world.
 * @param {string} worldId - the id passed from register()
 */
export function createPlaceholder(worldId) {
    const label = NAMES[worldId] || `WORLD ${worldId}`;

    return {
        scene: null,
        camera: null,

        init(renderer, composer) {
            _composer = composer;

            // Minimal scene — dark void with a few floating particles
            _scene = new THREE.Scene();
            _scene.background = new THREE.Color(0x050510);
            this.scene = _scene;

            _camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
            _camera.position.set(0, 2, 5);
            _camera.lookAt(0, 0, 0);
            this.camera = _camera;

            // Subtle ambient light
            const ambient = new THREE.AmbientLight(0x00d4ff, 0.3);
            _scene.add(ambient);

            // A few floating particles for visual interest
            const geo = new THREE.BufferGeometry();
            const count = 200;
            const pos = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                pos[i * 3] = (Math.random() - 0.5) * 30;
                pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
                pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
            }
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            const mat = new THREE.PointsMaterial({
                size: 0.08, color: 0x00d4ff, transparent: true,
                opacity: 0.6, blending: THREE.AdditiveBlending
            });
            _scene.add(new THREE.Points(geo, mat));

            // Render pass
            _renderPass = new THREE.RenderPass(_scene, _camera);
            composer.addPass(_renderPass);

            // HTML overlay
            _overlayEl = document.createElement('div');
            _overlayEl.className = 'placeholder-overlay';
            _overlayEl.innerHTML = `
                <div class="placeholder-icon">
                    <svg viewBox="0 0 64 64" width="64" height="64">
                        <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor"
                            stroke-width="2" stroke-dasharray="8 4" />
                        <line x1="20" y1="20" x2="44" y2="44" stroke="currentColor" stroke-width="2" />
                        <line x1="44" y1="20" x2="20" y2="44" stroke="currentColor" stroke-width="2" />
                    </svg>
                </div>
                <div class="placeholder-title">SIMULACIÓN ${label}</div>
                <div class="placeholder-message">EN CONSTRUCCIÓN</div>
                <div class="placeholder-sub">Próximamente disponible</div>
            `;
            const canvasArea = document.getElementById('canvas-area');
            if (canvasArea) canvasArea.appendChild(_overlayEl);
        },

        update(time, keys) {
            if (!_scene || !_camera) return;

            // Slowly rotate the camera around origin
            _camera.position.x = Math.sin(time * 0.2) * 5;
            _camera.position.z = Math.cos(time * 0.2) * 5;
            _camera.lookAt(0, 0, 0);

            // Render
            if (_composer) _composer.render();
        },

        dispose() {
            // Remove passes
            if (_composer && _renderPass) {
                _composer.removePass(_renderPass);
            }

            // Dispose Three.js objects
            if (_scene) {
                _scene.traverse(obj => {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        const mats = [].concat(obj.material);
                        mats.forEach(m => {
                            Object.values(m).forEach(v => {
                                if (v && v.isTexture) v.dispose();
                            });
                            m.dispose();
                        });
                    }
                });
                _scene.clear();
                _scene = null;
            }

            // Remove HTML overlay
            if (_overlayEl && _overlayEl.parentNode) {
                _overlayEl.parentNode.removeChild(_overlayEl);
                _overlayEl = null;
            }

            _camera = null;
            _renderPass = null;
            _composer = null;
            this.scene = null;
            this.camera = null;
        }
    };
}

// worlds/world-05-transform.js
// 3D editor with TransformControls and OrbitControls.
// Uses global THREE.TransformControls and THREE.OrbitControls (loaded via CDN).

export default {
    scene: null,
    camera: null,
    renderer: null,
    objects: [],
    _orbitControls: null,
    _transformControls: null,
    _raycaster: null,
    _mouse: null,
    _handlers: {},
    _selectedObject: null,
    _modeButtons: [],
    _keyHandler: null,

    init(renderer, composer) {
        this.renderer = renderer;
        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();

        // ── Scene ──
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0f);

        // Grid
        const gridHelper = new THREE.GridHelper(30, 30, 0x1a3a5a, 0x1a3a5a);
        this.scene.add(gridHelper);

        // Lighting
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(5, 10, 5);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // ── Camera ──
        this.camera = new THREE.PerspectiveCamera(
            60, window.innerWidth / window.innerHeight, 0.1, 200
        );
        this.camera.position.set(0, 10, 20);
        this.camera.lookAt(0, 0, 0);

        // ── 5 Interactive Objects ──
        const objDefs = [
            { geo: new THREE.BoxGeometry(2, 2, 2), color: 0xff4444, pos: [-8, 1, 0] },
            { geo: new THREE.SphereGeometry(1.2, 32, 32), color: 0x4444ff, pos: [-4, 1.2, 0] },
            { geo: new THREE.TorusGeometry(1, 0.4, 16, 32), color: 0x44ff44, pos: [0, 1.4, 0] },
            { geo: new THREE.ConeGeometry(1, 2.5, 16), color: 0xffaa00, pos: [4, 1.25, 0] },
            { geo: new THREE.IcosahedronGeometry(1.3, 1), color: 0xaa44ff, pos: [8, 1.3, 0] },
        ];

        this.objects = [];
        objDefs.forEach(def => {
            const mat = new THREE.MeshStandardMaterial({
                color: def.color,
                metalness: 0.3,
                roughness: 0.5
            });
            const mesh = new THREE.Mesh(def.geo, mat);
            mesh.position.set(...def.pos);
            mesh.castShadow = true;
            mesh._originalEmissive = new THREE.Color(0x000000);
            this.scene.add(mesh);
            this.objects.push(mesh);
        });

        // ── OrbitControls ──
        this._orbitControls = new THREE.OrbitControls(this.camera, renderer.domElement);
        this._orbitControls.enableDamping = true;
        this._orbitControls.dampingFactor = 0.05;
        this._orbitControls.minDistance = 5;
        this._orbitControls.maxDistance = 50;

        // ── TransformControls ──
        this._transformControls = new THREE.TransformControls(this.camera, renderer.domElement);
        this._transformControls.addEventListener('dragging-changed', (e) => {
            this._orbitControls.enabled = !e.value;
        });
        this.scene.add(this._transformControls);

        // ── Click to select ──
        this._handlers.click = (e) => {
            // Skip if transform gizmo is being dragged
            if (this._transformControls.dragging) return;

            const rect = renderer.domElement.getBoundingClientRect();
            this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this._raycaster.setFromCamera(this._mouse, this.camera);
            const intersects = this._raycaster.intersectObjects(this.objects);

            // Deselect previous
            if (this._selectedObject) {
                this._selectedObject.material.emissive.copy(this._selectedObject._originalEmissive);
            }

            if (intersects.length > 0) {
                const obj = intersects[0].object;
                this._selectedObject = obj;
                obj.material.emissive.set(0x333333);
                this._transformControls.attach(obj);
            } else {
                this._selectedObject = null;
                this._transformControls.detach();
            }
        };
        renderer.domElement.addEventListener('click', this._handlers.click);

        // ── Keyboard shortcuts ──
        this._keyHandler = (e) => {
            switch (e.key.toLowerCase()) {
                case 'q': this._setMode('translate'); break;
                case 'w': this._setMode('rotate'); break;
                case 'e': this._setMode('scale'); break;
                case 'escape':
                    this._transformControls.detach();
                    if (this._selectedObject) {
                        this._selectedObject.material.emissive.copy(this._selectedObject._originalEmissive);
                        this._selectedObject = null;
                    }
                    break;
            }
        };
        window.addEventListener('keydown', this._keyHandler);

        // ── Mode buttons (HTML overlay) ──
        this._createModeButtons();
    },

    _setMode(mode) {
        this._transformControls.setMode(mode);
        this._modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    },

    _createModeButtons() {
        const container = document.getElementById('carousel-container');
        if (!container) return;

        const wrapper = document.createElement('div');
        wrapper.id = 'transform-mode-buttons';
        wrapper.style.cssText = `
            position: absolute; top: 10px; right: 10px; z-index: 100;
            display: flex; gap: 6px; pointer-events: auto;
        `;

        const modes = [
            { mode: 'translate', label: 'MOVER', active: true },
            { mode: 'rotate', label: 'ROTAR', active: false },
            { mode: 'scale', label: 'ESCALAR', active: false },
        ];

        modes.forEach(m => {
            const btn = document.createElement('button');
            btn.dataset.mode = m.mode;
            btn.textContent = m.label;
            btn.className = m.active ? 'active' : '';
            btn.style.cssText = `
                background: #1a2035; border: 1px solid ${m.active ? '#00d4ff' : '#2a3550'};
                color: #00d4ff; padding: 6px 12px; font-family: 'Orbitron', monospace;
                font-size: 10px; letter-spacing: 2px; cursor: pointer; border-radius: 4px;
                transition: all 0.2s ease;
            `;
            btn.addEventListener('click', () => this._setMode(m.mode));
            wrapper.appendChild(btn);
            this._modeButtons.push(btn);
        });

        container.appendChild(wrapper);
    },

    update(time) {
        if (!this.scene || !this.camera) return;

        if (this._orbitControls) this._orbitControls.update();

        // Update mode button styles
        this._modeButtons.forEach(btn => {
            const isActive = btn.classList.contains('active');
            btn.style.borderColor = isActive ? '#00d4ff' : '#2a3550';
            btn.style.boxShadow = isActive ? '0 0 8px rgba(0,212,255,0.4)' : 'none';
        });

        this.renderer.render(this.scene, this.camera);
    },

    dispose() {
        // Remove event listeners
        if (this.renderer) {
            this.renderer.domElement.removeEventListener('click', this._handlers.click);
        }
        if (this._keyHandler) {
            window.removeEventListener('keydown', this._keyHandler);
        }
        this._handlers = {};

        // Remove HTML buttons
        const wrapper = document.getElementById('transform-mode-buttons');
        if (wrapper && wrapper.parentNode) {
            wrapper.parentNode.removeChild(wrapper);
        }
        this._modeButtons = [];

        // Dispose controls
        if (this._transformControls) {
            this._transformControls.detach();
            this._transformControls.dispose();
        }
        if (this._orbitControls) {
            this._orbitControls.dispose();
        }

        // Dispose scene objects
        if (this.scene) {
            this.scene.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    const mats = [].concat(obj.material);
                    mats.forEach(m => m.dispose());
                }
            });
            this.scene.clear();
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.objects = [];
        this._orbitControls = null;
        this._transformControls = null;
        this._selectedObject = null;
    }
};

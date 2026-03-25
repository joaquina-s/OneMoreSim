// worlds/world-06-bloom.js
// Unreal Bloom effect with interactive emissive objects.
// Requires UnrealBloomPass loaded via CDN.

export default {
    scene: null,
    camera: null,
    renderer: null,
    _localComposer: null,
    _bloomPass: null,
    _renderPass: null,
    _handlers: {},
    _raycaster: null,
    _mouse: null,
    _objects: [],
    _outerGroup: null,
    _centerSphere: null,
    _orbitingObjects: [],
    _bloomIndicator: null,
    _targetBloomStrength: 1.5,
    _flashTime: 0,
    _flashStart: 0,
    _isFlashing: false,
    _hoveredObject: null,

    init(renderer, composer) {
        this.renderer = renderer;
        this._raycaster = new THREE.Raycaster();
        this._mouse = new THREE.Vector2();

        // ── Scene ──
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        const ambient = new THREE.AmbientLight(0xffffff, 0.05);
        this.scene.add(ambient);

        // ── Camera ──
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 5, 20);
        this.camera.lookAt(0, 0, 0);

        // ── Local Composer (do not use app's shared composer) ──
        this._localComposer = new THREE.EffectComposer(renderer);
        this._renderPass = new THREE.RenderPass(this.scene, this.camera);
        this._localComposer.addPass(this._renderPass);

        // Adjust bloom resolution on mobile for performance
        const isMobile = window.innerWidth < 768;
        const resMultiplier = isMobile ? 0.5 : 1.0;
        const res = new THREE.Vector2(window.innerWidth * resMultiplier, window.innerHeight * resMultiplier);

        this._bloomPass = new THREE.UnrealBloomPass(res, 1.5, 0.4, 0.85);
        this._localComposer.addPass(this._bloomPass);

        // ── Objects ──
        this._outerGroup = new THREE.Group();
        this.scene.add(this._outerGroup);

        const colors = [0x00ffff, 0xff00ff, 0xffcc00, 0xffffff, 0x00ffaa];
        const geometries = [
            new THREE.SphereGeometry(1, 32, 32),
            new THREE.IcosahedronGeometry(1, 0),
            new THREE.TorusGeometry(0.8, 0.3, 16, 32)
        ];

        // Group A: Outer ring (8 objects)
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const geo = geometries[i % geometries.length];
            const color = colors[i % colors.length];
            const mat = new THREE.MeshStandardMaterial({
                color: 0x000000,
                emissive: color,
                emissiveIntensity: 2.0 + Math.random(),
                metalness: 0,
                roughness: 1
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(Math.cos(angle) * 8, 0, Math.sin(angle) * 8);

            // Store original values for animation
            mesh.userData = {
                baseEmissive: mat.emissiveIntensity,
                targetEmissive: mat.emissiveIntensity,
                speedX: 0.5 + Math.random() * 1.5,
                speedY: 0.5 + Math.random() * 1.5,
                offset: Math.random() * Math.PI * 2
            };

            this._outerGroup.add(mesh);
            this._objects.push(mesh);
        }

        // Group B: Center (1 large, 3 orbiting)
        const centerGeo = new THREE.SphereGeometry(2, 32, 32);
        const centerMat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            emissive: 0xffffff,
            emissiveIntensity: 4.0
        });
        this._centerSphere = new THREE.Mesh(centerGeo, centerMat);
        this.scene.add(this._centerSphere);

        for (let i = 0; i < 3; i++) {
            const geo = new THREE.IcosahedronGeometry(0.5, 1);
            const color = colors[(i + 1) % colors.length];
            const mat = new THREE.MeshStandardMaterial({
                color: 0x000000,
                emissive: color,
                emissiveIntensity: 3.0
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData = {
                angleOffset: (i / 3) * Math.PI * 2,
                radius: 4,
                speed: 1.5 + Math.random() * 0.5
            };
            this.scene.add(mesh);
            this._orbitingObjects.push(mesh);
        }

        // ── HTML Indicator ──
        this._createIndicator();

        // ── Event Listeners ──
        const el = renderer.domElement;

        this._handlers.mousemove = (e) => {
            const rect = el.getBoundingClientRect();
            // Mouse for raycaster
            this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            // Mouse Y for bloom strength (0.5 to 3.0 based on vertical pos)
            const normalizedY = (e.clientY - rect.top) / rect.height; // 0 to 1
            this._targetBloomStrength = 0.5 + (1.0 - normalizedY) * 2.5;

            // Hover effect
            this._raycaster.setFromCamera(this._mouse, this.camera);
            const intersects = this._raycaster.intersectObjects(this._objects);

            if (this._hoveredObject && (!intersects.length || intersects[0].object !== this._hoveredObject)) {
                this._hoveredObject.userData.targetEmissive = this._hoveredObject.userData.baseEmissive;
                this._hoveredObject = null;
                document.body.style.cursor = 'default';
            }

            if (intersects.length > 0) {
                this._hoveredObject = intersects[0].object;
                this._hoveredObject.userData.targetEmissive = 5.0;
                document.body.style.cursor = 'pointer';
            }
        };

        this._handlers.click = () => {
            // Flash effect
            if (!this._isFlashing) {
                this._isFlashing = true;
                this._flashStart = performance.now();
                this._bloomPass.strength = 6.0;
            }
        };

        // Touch support
        this._handlers.touchmove = (e) => {
            if (e.touches.length > 0) {
                const rect = el.getBoundingClientRect();
                const normalizedY = (e.touches[0].clientY - rect.top) / rect.height;
                this._targetBloomStrength = 0.5 + (1.0 - normalizedY) * 2.5;
            }
        };
        this._handlers.touchstart = () => {
            if (!this._isFlashing) {
                this._isFlashing = true;
                this._flashStart = performance.now();
                this._bloomPass.strength = 6.0;
            }
        };

        el.addEventListener('mousemove', this._handlers.mousemove);
        el.addEventListener('click', this._handlers.click);
        el.addEventListener('touchmove', this._handlers.touchmove, { passive: true });
        el.addEventListener('touchstart', this._handlers.touchstart, { passive: true });
    },

    _createIndicator() {
        const container = document.getElementById('carousel-container');
        if (!container) return;

        this._bloomIndicator = document.createElement('div');
        this._bloomIndicator.id = 'bloom-indicator';
        this._bloomIndicator.style.cssText = `
            position: absolute; top: 10px; left: 10px; z-index: 100;
            background: rgba(0, 0, 0, 0.6); border: 1px solid #00d4ff;
            color: #00d4ff; padding: 6px 12px; font-family: 'Orbitron', monospace;
            font-size: 12px; letter-spacing: 1px; border-radius: 4px;
            pointer-events: none; text-shadow: 0 0 5px #00d4ff;
        `;
        this._bloomIndicator.textContent = 'BLOOM: 1.5';
        container.appendChild(this._bloomIndicator);
    },

    update(time) {
        if (!this.scene || !this.camera || !this._localComposer) return;

        // ── Camera orbit ──
        this.camera.position.x = Math.sin(time * 0.05) * 20;
        this.camera.position.z = Math.cos(time * 0.05) * 20;
        this.camera.position.y = 5 + Math.sin(time * 0.03) * 3;
        this.camera.lookAt(0, 0, 0);

        // ── Object animation ──
        this._outerGroup.rotation.y = time * 0.2;

        for (const obj of this._objects) {
            obj.rotation.x = time * obj.userData.speedX + obj.userData.offset;
            obj.rotation.y = time * obj.userData.speedY * 0.7 + obj.userData.offset;

            // Lerp emissive intensity
            obj.material.emissiveIntensity = THREE.MathUtils.lerp(
                obj.material.emissiveIntensity,
                obj.userData.targetEmissive,
                0.1
            );
        }

        this._centerSphere.scale.setScalar(1 + Math.sin(time * 2) * 0.1);

        for (const obj of this._orbitingObjects) {
            const angle = time * obj.userData.speed + obj.userData.angleOffset;
            const r = obj.userData.radius;
            obj.position.set(Math.cos(angle) * r, Math.sin(time * 3 + obj.userData.angleOffset) * 1.5, Math.sin(angle) * r);
            obj.rotation.x += 0.05;
            obj.rotation.y += 0.03;
        }

        // ── Bloom interaction ──
        if (this._isFlashing) {
            const elapsed = performance.now() - this._flashStart;
            if (elapsed > 100) {
                // Return phase (400ms)
                const phase = (elapsed - 100) / 400;
                if (phase >= 1) {
                    this._isFlashing = false;
                } else {
                    this._bloomPass.strength = THREE.MathUtils.lerp(6.0, this._targetBloomStrength, phase);
                }
            }
        } else {
            // Normal lerp to target
            this._bloomPass.strength = THREE.MathUtils.lerp(
                this._bloomPass.strength,
                this._targetBloomStrength,
                0.05
            );
        }

        if (this._bloomIndicator) {
            this._bloomIndicator.textContent = `BLOOM: ${this._bloomPass.strength.toFixed(2)}`;
        }

        // Render with local composer
        this._localComposer.render();
    },

    dispose() {
        document.body.style.cursor = 'default';

        // Remove events
        if (this.renderer) {
            const el = this.renderer.domElement;
            Object.entries(this._handlers).forEach(([event, fn]) => {
                el.removeEventListener(event, fn);
            });
        }
        this._handlers = {};

        // Remove HTML
        if (this._bloomIndicator && this._bloomIndicator.parentNode) {
            this._bloomIndicator.parentNode.removeChild(this._bloomIndicator);
        }
        this._bloomIndicator = null;

        // Dispose post-processing
        if (this._localComposer) {
            this._localComposer.passes.forEach(p => {
                if (p.dispose) p.dispose();
            });
            this._localComposer = null;
        }
        this._bloomPass = null;
        this._renderPass = null;

        // Dispose scene
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
        this._objects = [];
        this._outerGroup = null;
        this._centerSphere = null;
        this._orbitingObjects = [];
        this._hoveredObject = null;
    }
};

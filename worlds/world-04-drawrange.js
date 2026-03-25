// worlds/world-04-drawrange.js
// Neural network / constellation map with progressive drawRange animation.
// Uses global THREE (r128 CDN). No addons required.

export default {
    scene: null,
    camera: null,
    renderer: null,
    _handlers: {},
    _group: null,
    _pointsMat: null,
    _lineGeom: null,
    _lineSegCount: 0,
    _drawCount: 0,
    _dataLines: [],
    _dataLineTimer: 0,
    _nodePositions: null,
    _nodeCount: 200,
    _isDragging: false,
    _prevMouse: { x: 0, y: 0 },
    _camAngleOffset: { x: 0, y: 0 },

    init(renderer, composer) {
        this.renderer = renderer;

        // ── Scene ──
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000508);

        // ── Camera ──
        this.camera = new THREE.PerspectiveCamera(
            60, window.innerWidth / window.innerHeight, 0.1, 200
        );
        this.camera.position.set(0, 0, 40);

        // ── Group (all network nodes + lines) ──
        this._group = new THREE.Group();
        this.scene.add(this._group);

        // ── Generate node positions in a sphere ──
        const nodePositions = new Float32Array(this._nodeCount * 3);
        let idx = 0;
        while (idx < this._nodeCount) {
            const x = (Math.random() - 0.5) * 30;
            const y = (Math.random() - 0.5) * 30;
            const z = (Math.random() - 0.5) * 30;
            if (Math.sqrt(x * x + y * y + z * z) < 15) {
                nodePositions[idx * 3] = x;
                nodePositions[idx * 3 + 1] = y;
                nodePositions[idx * 3 + 2] = z;
                idx++;
            }
        }
        this._nodePositions = nodePositions;

        // ── Points (nodes) ──
        const pointsGeo = new THREE.BufferGeometry();
        pointsGeo.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
        this._pointsMat = new THREE.PointsMaterial({
            size: 0.3,
            color: 0x00d4ff,
            sizeAttenuation: true,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        const points = new THREE.Points(pointsGeo, this._pointsMat);
        this._group.add(points);

        // ── Find connections (3 nearest neighbours per node) ──
        const segments = [];
        const addedPairs = new Set();

        for (let i = 0; i < this._nodeCount; i++) {
            const ix = nodePositions[i * 3];
            const iy = nodePositions[i * 3 + 1];
            const iz = nodePositions[i * 3 + 2];

            // Calculate distances to all other nodes
            const dists = [];
            for (let j = 0; j < this._nodeCount; j++) {
                if (j === i) continue;
                const dx = nodePositions[j * 3] - ix;
                const dy = nodePositions[j * 3 + 1] - iy;
                const dz = nodePositions[j * 3 + 2] - iz;
                dists.push({ idx: j, d: dx * dx + dy * dy + dz * dz });
            }
            dists.sort((a, b) => a.d - b.d);

            // Connect to 3 nearest
            for (let k = 0; k < 3 && k < dists.length; k++) {
                const j = dists[k].idx;
                const key = i < j ? `${i}-${j}` : `${j}-${i}`;
                if (addedPairs.has(key)) continue;
                addedPairs.add(key);
                segments.push(
                    ix, iy, iz,
                    nodePositions[j * 3], nodePositions[j * 3 + 1], nodePositions[j * 3 + 2]
                );
            }
        }

        this._lineSegCount = segments.length / 6; // number of line segments
        const linePositions = new Float32Array(segments);
        this._lineGeom = new THREE.BufferGeometry();
        this._lineGeom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        this._lineGeom.setDrawRange(0, 0); // start empty

        const lineMat = new THREE.LineBasicMaterial({
            color: 0x00d4ff,
            transparent: true,
            opacity: 0.25
        });
        const lineSegments = new THREE.LineSegments(this._lineGeom, lineMat);
        this._group.add(lineSegments);

        // ── Data lines (5 bright travelling lines) ──
        this._dataLines = [];
        for (let d = 0; d < 5; d++) {
            const geo = new THREE.BufferGeometry();
            const pos = new Float32Array(6); // one line segment = 2 points
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            const mat = new THREE.LineBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.8
            });
            const line = new THREE.LineSegments(geo, mat);
            this._group.add(line);
            this._dataLines.push({
                mesh: line,
                geo: geo,
                from: Math.floor(Math.random() * this._nodeCount),
                to: Math.floor(Math.random() * this._nodeCount),
                timer: Math.random() * 2
            });
        }
        this._dataLineTimer = 0;

        // Reset state
        this._drawCount = 0;
        this._isDragging = false;
        this._camAngleOffset = { x: 0, y: 0 };

        // ── Mouse drag handlers ──
        const el = renderer.domElement;
        this._handlers.mousedown = (e) => {
            this._isDragging = true;
            this._prevMouse.x = e.clientX;
            this._prevMouse.y = e.clientY;
        };
        this._handlers.mousemove = (e) => {
            if (!this._isDragging) return;
            const dx = e.clientX - this._prevMouse.x;
            const dy = e.clientY - this._prevMouse.y;
            this._prevMouse.x = e.clientX;
            this._prevMouse.y = e.clientY;
            this._camAngleOffset.x += dx * 0.005;
            this._camAngleOffset.y += dy * 0.005;
        };
        this._handlers.mouseup = () => {
            this._isDragging = false;
        };
        this._handlers.touchstart = (e) => {
            if (e.touches.length === 1) {
                this._isDragging = true;
                this._prevMouse.x = e.touches[0].clientX;
                this._prevMouse.y = e.touches[0].clientY;
            }
        };
        this._handlers.touchmove = (e) => {
            if (!this._isDragging || e.touches.length < 1) return;
            const dx = e.touches[0].clientX - this._prevMouse.x;
            const dy = e.touches[0].clientY - this._prevMouse.y;
            this._prevMouse.x = e.touches[0].clientX;
            this._prevMouse.y = e.touches[0].clientY;
            this._camAngleOffset.x += dx * 0.005;
            this._camAngleOffset.y += dy * 0.005;
        };
        this._handlers.touchend = () => {
            this._isDragging = false;
        };

        el.addEventListener('mousedown', this._handlers.mousedown);
        el.addEventListener('mousemove', this._handlers.mousemove);
        el.addEventListener('mouseup', this._handlers.mouseup);
        el.addEventListener('touchstart', this._handlers.touchstart, { passive: true });
        el.addEventListener('touchmove', this._handlers.touchmove, { passive: true });
        el.addEventListener('touchend', this._handlers.touchend);
    },

    update(time) {
        if (!this.scene || !this.camera) return;

        // ── Progressive drawRange ──
        const maxVerts = this._lineSegCount * 2;
        this._drawCount += 6;
        if (this._drawCount > maxVerts) this._drawCount = 0;
        this._lineGeom.setDrawRange(0, this._drawCount);

        // ── Pulse node size ──
        if (this._pointsMat) {
            this._pointsMat.size = 0.3 + Math.sin(time * 2) * 0.1;
        }

        // ── Rotate group ──
        if (this._group) {
            this._group.rotation.y = time * 0.05;
            this._group.rotation.x = Math.sin(time * 0.03) * 0.2;
        }

        // ── Data lines — travel between random nodes ──
        for (const dl of this._dataLines) {
            dl.timer -= 0.016;
            if (dl.timer <= 0) {
                dl.from = Math.floor(Math.random() * this._nodeCount);
                dl.to = Math.floor(Math.random() * this._nodeCount);
                dl.timer = 2;
            }
            const np = this._nodePositions;
            const posArr = dl.geo.attributes.position.array;
            posArr[0] = np[dl.from * 3];
            posArr[1] = np[dl.from * 3 + 1];
            posArr[2] = np[dl.from * 3 + 2];
            posArr[3] = np[dl.to * 3];
            posArr[4] = np[dl.to * 3 + 1];
            posArr[5] = np[dl.to * 3 + 2];
            dl.geo.attributes.position.needsUpdate = true;
        }

        // ── Camera orbit ──
        const angleX = time * 0.1 + this._camAngleOffset.x;
        const angleY = time * 0.07 + this._camAngleOffset.y;
        this.camera.position.x = Math.sin(angleX) * 40;
        this.camera.position.z = Math.cos(angleX) * 40;
        this.camera.position.y = Math.sin(angleY) * 15;
        this.camera.lookAt(0, 0, 0);

        // Render directly
        this.renderer.render(this.scene, this.camera);
    },

    dispose() {
        // Remove event listeners
        if (this.renderer) {
            const el = this.renderer.domElement;
            Object.entries(this._handlers).forEach(([event, fn]) => {
                el.removeEventListener(event, fn);
            });
        }
        this._handlers = {};

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
        this._group = null;
        this._pointsMat = null;
        this._lineGeom = null;
        this._dataLines = [];
        this._nodePositions = null;
    }
};

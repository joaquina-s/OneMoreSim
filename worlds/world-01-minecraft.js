// worlds/world-01-minecraft.js
// Minecraft-style voxel terrain world.
// Uses global THREE (r128 CDN). No ES module imports for Three.js.
// Implements ImprovedNoise inline to avoid any import dependencies.

import { deviceProfile } from '../core/deviceProfile.js';

// ═══════════════════════════════════════════════
// IMPROVED NOISE — Ken Perlin's reference implementation
// ═══════════════════════════════════════════════

class ImprovedNoise {
    constructor() {
        const p = [
            151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
            140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
            247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
            57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
            74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
            60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
            65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
            200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
            52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
            207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
            119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
            129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
            218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
            81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
            184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
            222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180
        ];
        this.perm = new Array(512);
        for (let i = 0; i < 512; i++) {
            this.perm[i] = p[i & 255];
        }
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x, y, z) {
        const floorX = Math.floor(x);
        const floorY = Math.floor(y);
        const floorZ = Math.floor(z);

        const X = floorX & 255;
        const Y = floorY & 255;
        const Z = floorZ & 255;

        x -= floorX;
        y -= floorY;
        z -= floorZ;

        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);

        const A = this.perm[X] + Y;
        const AA = this.perm[A] + Z;
        const AB = this.perm[A + 1] + Z;
        const B = this.perm[X + 1] + Y;
        const BA = this.perm[B] + Z;
        const BB = this.perm[B + 1] + Z;

        return this.lerp(w,
            this.lerp(v,
                this.lerp(u, this.grad(this.perm[AA], x, y, z),
                    this.grad(this.perm[BA], x - 1, y, z)),
                this.lerp(u, this.grad(this.perm[AB], x, y - 1, z),
                    this.grad(this.perm[BB], x - 1, y - 1, z))
            ),
            this.lerp(v,
                this.lerp(u, this.grad(this.perm[AA + 1], x, y, z - 1),
                    this.grad(this.perm[BA + 1], x - 1, y, z - 1)),
                this.lerp(u, this.grad(this.perm[AB + 1], x, y - 1, z - 1),
                    this.grad(this.perm[BB + 1], x - 1, y - 1, z - 1))
            )
        );
    }
}

// ═══════════════════════════════════════════════
// PROCEDURAL TEXTURE
// ═══════════════════════════════════════════════

function createBlockTexture() {
    const size = 256;
    const tileSize = 16; // each block face = 16x16 pixels
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Fill base dirt color
    ctx.fillStyle = '#6B4226';
    ctx.fillRect(0, 0, size, size);

    // Draw top grass layer on top tiles
    const tilesPerRow = size / tileSize;
    for (let tx = 0; tx < tilesPerRow; tx++) {
        for (let ty = 0; ty < tilesPerRow; ty++) {
            const px = tx * tileSize;
            const py = ty * tileSize;

            // Add slight color variation per tile
            const r = Math.random();
            if (r < 0.5) {
                // Grass-like tile (green tones)
                const g = 60 + Math.floor(Math.random() * 40);
                ctx.fillStyle = `rgb(${50 + Math.floor(Math.random() * 30)}, ${g + 50}, ${30 + Math.floor(Math.random() * 20)})`;
                ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
            } else if (r < 0.8) {
                // Dirt variation
                const brown = 40 + Math.floor(Math.random() * 30);
                ctx.fillStyle = `rgb(${brown + 60}, ${brown + 20}, ${brown})`;
                ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
            }

            // Add noise pixels for texture detail
            for (let i = 0; i < 8; i++) {
                const nx = px + Math.floor(Math.random() * tileSize);
                const ny = py + Math.floor(Math.random() * tileSize);
                const bright = Math.floor(Math.random() * 40);
                ctx.fillStyle = `rgba(0, 0, 0, ${0.05 + Math.random() * 0.1})`;
                ctx.fillRect(nx, ny, 1, 1);
                ctx.fillStyle = `rgba(${bright}, ${bright}, ${bright}, 0.08)`;
                ctx.fillRect(nx + 1, ny, 1, 1);
            }

            // Block border (dark lines)
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// ═══════════════════════════════════════════════
// HEIGHT MAP GENERATION
// ═══════════════════════════════════════════════

function generateHeightData(width, depth) {
    const noise = new ImprovedNoise();
    const data = new Float32Array(width * depth);
    const quality = 2;

    // Multiple octaves of noise
    for (let octave = 0; octave < 4; octave++) {
        const scale = Math.pow(quality, octave);
        for (let iz = 0; iz < depth; iz++) {
            for (let ix = 0; ix < width; ix++) {
                const nx = ix / width * scale;
                const nz = iz / depth * scale;
                data[ix + iz * width] += noise.noise(nx, octave * 17.3, nz) * (30 / scale);
            }
        }
    }

    // Normalize to 0..30
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < data.length; i++) {
        if (data[i] < min) min = data[i];
        if (data[i] > max) max = data[i];
    }
    const range = max - min || 1;
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.floor(((data[i] - min) / range) * 30);
    }

    return data;
}

// ═══════════════════════════════════════════════
// MERGED VOXEL GEOMETRY (visible faces only)
// ═══════════════════════════════════════════════

function getHeight(data, x, z, width, depth) {
    if (x < 0 || x >= width || z < 0 || z >= depth) return 0;
    return data[x + z * width];
}

function buildVoxelGeometry(data, width, depth) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    let vertexCount = 0;

    // Helper to add a quad (2 triangles)
    function addFace(v0, v1, v2, v3, nx, ny, nz) {
        const idx = vertexCount;
        positions.push(
            v0[0], v0[1], v0[2],
            v1[0], v1[1], v1[2],
            v2[0], v2[1], v2[2],
            v3[0], v3[1], v3[2]
        );
        for (let i = 0; i < 4; i++) {
            normals.push(nx, ny, nz);
        }
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        indices.push(idx, idx + 1, idx + 2, idx, idx + 2, idx + 3);
        vertexCount += 4;
    }

    const halfW = width / 2;
    const halfD = depth / 2;

    for (let iz = 0; iz < depth; iz++) {
        for (let ix = 0; ix < width; ix++) {
            const h = data[ix + iz * width];
            if (h <= 0) continue;

            const x = ix - halfW;
            const z = iz - halfD;

            // Top face of tallest block
            addFace(
                [x, h, z], [x + 1, h, z], [x + 1, h, z + 1], [x, h, z + 1],
                0, 1, 0
            );

            // Check adjacent blocks for visible side faces
            // Left (-x)
            const hLeft = getHeight(data, ix - 1, iz, width, depth);
            if (hLeft < h) {
                for (let y = hLeft; y < h; y++) {
                    addFace(
                        [x, y, z + 1], [x, y, z], [x, y + 1, z], [x, y + 1, z + 1],
                        -1, 0, 0
                    );
                }
            }

            // Right (+x)
            const hRight = getHeight(data, ix + 1, iz, width, depth);
            if (hRight < h) {
                for (let y = hRight; y < h; y++) {
                    addFace(
                        [x + 1, y, z], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z],
                        1, 0, 0
                    );
                }
            }

            // Front (-z)
            const hFront = getHeight(data, ix, iz - 1, width, depth);
            if (hFront < h) {
                for (let y = hFront; y < h; y++) {
                    addFace(
                        [x, y, z], [x + 1, y, z], [x + 1, y + 1, z], [x, y + 1, z],
                        0, 0, -1
                    );
                }
            }

            // Back (+z)
            const hBack = getHeight(data, ix, iz + 1, width, depth);
            if (hBack < h) {
                for (let y = hBack; y < h; y++) {
                    addFace(
                        [x + 1, y, z + 1], [x, y, z + 1], [x, y + 1, z + 1], [x + 1, y + 1, z + 1],
                        0, 0, 1
                    );
                }
            }
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    return geometry;
}


// ═══════════════════════════════════════════════
// WORLD MODULE — default export
// ═══════════════════════════════════════════════

export default {
    scene: null,
    camera: null,
    terrain: null,
    texture: null,
    renderer: null,
    _renderPass: null,
    _composer: null,
    _handlers: {},

    // Mouse state
    _isMouseDown: false,
    _mouseButton: -1,
    _prevMouseX: 0,
    _prevMouseY: 0,
    _yaw: 0,
    _pitch: -0.2,
    _moveForward: false,
    _moveBackward: false,

    // World params
    _worldWidth: 0,
    _worldDepth: 0,
    _heightData: null,

    init(renderer, composer) {
        this.renderer = renderer;
        this._composer = composer;

        this._worldWidth = deviceProfile.worldSize;
        this._worldDepth = deviceProfile.worldSize;

        // ── Scene ──
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0025);

        // ── Camera ──
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 500);
        // Place camera at center, elevated above the terrain
        this.camera.position.set(0, 25, 0);
        this._yaw = 0;
        this._pitch = -0.2;
        this._updateCameraRotation();

        // ── Lighting ──
        const ambient = new THREE.AmbientLight(0xcccccc, 1.5);
        this.scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
        dirLight.position.set(1, 1.5, 1).normalize();
        this.scene.add(dirLight);

        // ── Terrain ──
        this._heightData = generateHeightData(this._worldWidth, this._worldDepth);
        const geometry = buildVoxelGeometry(this._heightData, this._worldWidth, this._worldDepth);
        this.texture = createBlockTexture();
        const material = new THREE.MeshLambertMaterial({ map: this.texture });
        this.terrain = new THREE.Mesh(geometry, material);
        this.scene.add(this.terrain);

        // ── Render pass (skip when composer is null on mobile) ──
        if (composer) {
            this._renderPass = new THREE.RenderPass(this.scene, this.camera);
            composer.addPass(this._renderPass);
        }

        // ── Event listeners (attached to canvas, named for disposal) ──
        this._handlers.mousedown = (e) => this._onMouseDown(e);
        this._handlers.mousemove = (e) => this._onMouseMove(e);
        this._handlers.mouseup = (e) => this._onMouseUp(e);
        this._handlers.contextmenu = (e) => e.preventDefault();
        // Touch support
        this._handlers.touchstart = (e) => this._onTouchStart(e);
        this._handlers.touchmove = (e) => this._onTouchMove(e);
        this._handlers.touchend = (e) => this._onTouchEnd(e);

        const el = renderer.domElement;
        el.addEventListener('mousedown', this._handlers.mousedown);
        el.addEventListener('mousemove', this._handlers.mousemove);
        el.addEventListener('mouseup', this._handlers.mouseup);
        el.addEventListener('contextmenu', this._handlers.contextmenu);
        el.addEventListener('touchstart', this._handlers.touchstart, { passive: false });
        el.addEventListener('touchmove', this._handlers.touchmove, { passive: false });
        el.addEventListener('touchend', this._handlers.touchend);

        // Reset movement state
        this._isMouseDown = false;
        this._mouseButton = -1;
        this._moveForward = false;
        this._moveBackward = false;
    },

    update(time, keys) {
        if (!this.scene || !this.camera) return;

        // ── Movement ──
        const speed = 0.5;
        const forward = new THREE.Vector3(
            -Math.sin(this._yaw),
            0,
            -Math.cos(this._yaw)
        );

        if (this._moveForward) {
            this.camera.position.addScaledVector(forward, speed);
        }
        if (this._moveBackward) {
            this.camera.position.addScaledVector(forward, -speed);
        }

        // Arrow keys for movement too
        if (keys && keys.up) this.camera.position.addScaledVector(forward, speed);
        if (keys && keys.down) this.camera.position.addScaledVector(forward, -speed);

        const strafe = new THREE.Vector3(
            -Math.sin(this._yaw + Math.PI / 2), 0,
            -Math.cos(this._yaw + Math.PI / 2)
        );
        if (keys && keys.left) this.camera.position.addScaledVector(strafe, -speed * 0.6);
        if (keys && keys.right) this.camera.position.addScaledVector(strafe, speed * 0.6);

        // Keep camera within bounds and above terrain
        const halfW = this._worldWidth / 2;
        const halfD = this._worldDepth / 2;
        this.camera.position.x = Math.max(-halfW + 2, Math.min(halfW - 2, this.camera.position.x));
        this.camera.position.z = Math.max(-halfD + 2, Math.min(halfD - 2, this.camera.position.z));

        // Keep camera above terrain
        const mapX = Math.floor(this.camera.position.x + halfW);
        const mapZ = Math.floor(this.camera.position.z + halfD);
        const terrainH = getHeight(this._heightData,
            Math.max(0, Math.min(this._worldWidth - 1, mapX)),
            Math.max(0, Math.min(this._worldDepth - 1, mapZ)),
            this._worldWidth, this._worldDepth
        );
        this.camera.position.y = Math.max(this.camera.position.y, terrainH + 3);

        // Render
        if (this._composer) {
            this._composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
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

        // Remove render pass
        if (this._composer && this._renderPass) {
            this._composer.removePass(this._renderPass);
        }

        // Dispose Three.js resources
        if (this.terrain) {
            this.terrain.geometry.dispose();
            this.terrain.material.dispose();
        }
        if (this.texture) {
            this.texture.dispose();
        }

        // Clear scene
        if (this.scene) {
            this.scene.traverse(obj => {
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
            this.scene.clear();
        }

        this.scene = null;
        this.camera = null;
        this.terrain = null;
        this.texture = null;
        this.renderer = null;
        this._renderPass = null;
        this._composer = null;
        this._heightData = null;
    },

    // ── Private: Camera rotation ──
    _updateCameraRotation() {
        // Clamp pitch
        this._pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this._pitch));

        const euler = new THREE.Euler(this._pitch, this._yaw, 0, 'YXZ');
        this.camera.quaternion.setFromEuler(euler);
    },

    // ── Private: Mouse handlers ──
    _onMouseDown(e) {
        this._isMouseDown = true;
        this._mouseButton = e.button;
        this._prevMouseX = e.clientX;
        this._prevMouseY = e.clientY;

        if (e.button === 0) this._moveForward = true;
        if (e.button === 2) this._moveBackward = true;
    },

    _onMouseMove(e) {
        if (!this._isMouseDown) return;

        const dx = e.clientX - this._prevMouseX;
        const dy = e.clientY - this._prevMouseY;
        this._prevMouseX = e.clientX;
        this._prevMouseY = e.clientY;

        this._yaw -= dx * 0.003;
        this._pitch -= dy * 0.003;
        this._updateCameraRotation();
    },

    _onMouseUp(e) {
        this._isMouseDown = false;
        if (e.button === 0) this._moveForward = false;
        if (e.button === 2) this._moveBackward = false;
    },

    // ── Private: Touch handlers ──
    _onTouchStart(e) {
        if (e.touches.length === 1) {
            e.preventDefault();
            this._isMouseDown = true;
            this._moveForward = true;
            this._prevMouseX = e.touches[0].clientX;
            this._prevMouseY = e.touches[0].clientY;
        }
    },

    _onTouchMove(e) {
        if (!this._isMouseDown || e.touches.length < 1) return;
        e.preventDefault();

        const dx = e.touches[0].clientX - this._prevMouseX;
        const dy = e.touches[0].clientY - this._prevMouseY;
        this._prevMouseX = e.touches[0].clientX;
        this._prevMouseY = e.touches[0].clientY;

        this._yaw -= dx * 0.004;
        this._pitch -= dy * 0.004;
        this._updateCameraRotation();
    },

    _onTouchEnd(e) {
        this._isMouseDown = false;
        this._moveForward = false;
    }
};

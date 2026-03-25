// scenes/carousel.js
// Carousel scene — 4 themed rooms, player character, post-processing, room detection.
// Uses global THREE (r128 via CDN script tags).

import { deviceProfile } from '../core/deviceProfile.js';

// --- Private state ---
let carouselScene = null;
let carouselCamera = null;

let ambientLight = null;
let dirLight = null;

let playerGroup = null;
let orbitAngle = 0;
let velocity = 0;
const orbitRadius = 12.5;

let currentRoomId = null;
let roomOverlayTimeout = null;

const simulations = [];

// Shader passes (added to composer during init, removed during dispose)
let blurPass = null;
let pixelPass = null;
let hazePass = null;
let renderPass = null;

// Keep references to composer and renderer for dispose / fallback
let _composer = null;
let _renderer = null;

// --- Room Data ---
const roomData = [
    { id: "1", name: "Nebulosa Cósmica", color: 0x6a0dad, emissive: 0x9c27b0, cx: -12.5, cz: -12.5 },
    { id: "2", name: "Océano Digital", color: 0x0077be, emissive: 0x00bcd4, cx: 12.5, cz: -12.5 },
    { id: "4", name: "Bosque de Cristal", color: 0x00c853, emissive: 0x4caf50, cx: -12.5, cz: 12.5 },
    { id: "3", name: "Volcán Eléctrico", color: 0xff5722, emissive: 0xff9800, cx: 12.5, cz: 12.5 }
];

// ───────────────────────────────────────────────
// Shader Definitions
// ───────────────────────────────────────────────

// 1. Blur Shader (Room 1 — Nebulosa Cósmica)
const BlurShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "amount": { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float amount;
        varying vec2 vUv;
        
        void main() {
            vec4 color = vec4(0.0);
            float offset = amount * 0.005;
            
            color += texture2D(tDiffuse, vUv + vec2(-offset, -offset)) * 0.0625;
            color += texture2D(tDiffuse, vUv + vec2(0.0, -offset)) * 0.125;
            color += texture2D(tDiffuse, vUv + vec2(offset, -offset)) * 0.0625;
            
            color += texture2D(tDiffuse, vUv + vec2(-offset, 0.0)) * 0.125;
            color += texture2D(tDiffuse, vUv) * 0.25;
            color += texture2D(tDiffuse, vUv + vec2(offset, 0.0)) * 0.125;
            
            color += texture2D(tDiffuse, vUv + vec2(-offset, offset)) * 0.0625;
            color += texture2D(tDiffuse, vUv + vec2(0.0, offset)) * 0.125;
            color += texture2D(tDiffuse, vUv + vec2(offset, offset)) * 0.0625;
            
            gl_FragColor = color;
        }
    `
};

// 2. Pixelate Shader (Room 4 — Bosque de Cristal)
const PixelateShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "pixelSize": { value: 0.0 },
        "resolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float pixelSize;
        uniform vec2 resolution;
        varying vec2 vUv;
        
        void main() {
            if (pixelSize <= 0.0) {
                gl_FragColor = texture2D(tDiffuse, vUv);
            } else {
                vec2 curPixelSize = vec2(pixelSize) / resolution;
                vec2 uvPixelated = floor(vUv / curPixelSize) * curPixelSize;
                gl_FragColor = texture2D(tDiffuse, uvPixelated);
            }
        }
    `
};

// 3. Heat Haze Shader (Room 3 — Volcán Eléctrico)
const HazeShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "time": { value: 0.0 },
        "intensity": { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform float intensity;
        varying vec2 vUv;
        
        void main() {
            if (intensity <= 0.0) {
                gl_FragColor = texture2D(tDiffuse, vUv);
            } else {
                vec2 distortedUv = vUv;
                distortedUv.x += sin(vUv.y * 20.0 + time * 5.0) * 0.005 * intensity;
                distortedUv.y += cos(vUv.x * 20.0 + time * 4.0) * 0.005 * intensity;
                
                vec4 color = texture2D(tDiffuse, distortedUv);
                color.r += 0.1 * intensity;
                color.b -= 0.1 * intensity;
                gl_FragColor = color;
            }
        }
    `
};

// ───────────────────────────────────────────────
// Room Construction
// ───────────────────────────────────────────────

function buildRooms(scene) {
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x111111, roughness: 0.8, metalness: 0.2
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    roomData.forEach(room => {
        const pLight = new THREE.PointLight(room.emissive, 2.5, 40);
        pLight.position.set(room.cx, 5, room.cz);
        scene.add(pLight);

        const wallMat = new THREE.MeshStandardMaterial({
            color: room.color, emissive: room.emissive, emissiveIntensity: 0.2,
            transparent: true, opacity: 0.15, side: THREE.DoubleSide
        });

        const wT = 0.5, wH = 10, rs = 25;
        const addWall = (w, h, d, px, pz) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
            wall.position.set(px, h / 2, pz);
            wall.receiveShadow = true;
            wall.castShadow = true;
            scene.add(wall);
        };

        addWall(rs, wH, wT, room.cx, room.cz - rs / 2);
        addWall(rs, wH, wT, room.cx, room.cz + rs / 2);
        addWall(wT, wH, rs, room.cx - rs / 2, room.cz);
        addWall(wT, wH, rs, room.cx + rs / 2, room.cz);
    });

    // Cross Dividers
    const crossMat = new THREE.MeshStandardMaterial({ color: 0x222222, transparent: true, opacity: 0.3 });
    const wall1 = new THREE.Mesh(new THREE.BoxGeometry(50, 10, 0.5), crossMat);
    wall1.position.set(0, 5, 0);
    scene.add(wall1);
    const wall2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10, 50), crossMat);
    wall2.position.set(0, 5, 0);
    scene.add(wall2);
}

// ───────────────────────────────────────────────
// Room Simulations
// ───────────────────────────────────────────────

function initRoom1(scene) {
    const geo = new THREE.BufferGeometry();
    const count = 1200;
    const pos = new Float32Array(count * 3);
    const pRoom = roomData.find(r => r.id === "1");

    for (let i = 0; i < count; i++) {
        const radius = Math.random() * 10;
        const theta = Math.random() * Math.PI * 2;
        pos[i * 3] = pRoom.cx + Math.cos(theta) * radius;
        pos[i * 3 + 1] = Math.random() * 10;
        pos[i * 3 + 2] = pRoom.cz + Math.sin(theta) * radius;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
        size: 0.15, color: pRoom.emissive, transparent: true,
        opacity: 0.8, blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(geo, mat);
    scene.add(particles);

    simulations.push((time) => {
        particles.rotation.y = time * 0.1;
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < count; i++) {
            positions[i * 3 + 1] += Math.sin(time * 2 + i) * 0.01;
        }
        particles.geometry.attributes.position.needsUpdate = true;
    });
}

function initRoom2(scene) {
    const pRoom = roomData.find(r => r.id === "2");

    // Grid Backdrop
    const gridGeo = new THREE.PlaneGeometry(24, 24);
    const gridMat = new THREE.ShaderMaterial({
        uniforms: {
            color1: { value: new THREE.Color(0x000022) },
            color2: { value: new THREE.Color(0x00bcd4) },
            time: { value: 0.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color1;
            uniform vec3 color2;
            uniform float time;
            varying vec2 vUv;
            
            void main() {
                vec2 grid = fract(vUv * 12.0 - vec2(0.0, time * 0.5));
                float line = step(0.1, grid.x) * step(0.1, grid.y);
                gl_FragColor = vec4(mix(color2, color1, line), 0.8);
            }
        `,
        transparent: true,
        side: THREE.DoubleSide
    });

    const gridMesh = new THREE.Mesh(gridGeo, gridMat);
    gridMesh.position.set(pRoom.cx, 0.1, pRoom.cz);
    gridMesh.rotation.x = -Math.PI / 2;
    scene.add(gridMesh);

    const spheres = [];
    const geo = new THREE.SphereGeometry(0.8, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
        color: pRoom.color, emissive: pRoom.emissive, emissiveIntensity: 0.4,
        metalness: 0.8, roughness: 0.2
    });

    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(pRoom.cx - 6 + i * 3, 2, pRoom.cz - 6 + j * 3);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            spheres.push({ mesh, ix: i, iz: j });
        }
    }

    simulations.push((time) => {
        gridMat.uniforms.time.value = time;
        spheres.forEach(s => {
            s.mesh.position.y = 2 + Math.sin(time * 2 + s.ix * 0.5 + s.iz * 0.5) * 1.5;
        });
    });
}

function initRoom3(scene) {
    const pRoom = roomData.find(r => r.id === "3");
    const toruses = [];
    const geo = new THREE.TorusGeometry(1, 0.3, 16, 50);
    const mat = new THREE.MeshStandardMaterial({
        color: pRoom.color, emissive: pRoom.emissive, emissiveIntensity: 0.6,
        metalness: 1.0, roughness: 0.1
    });

    for (let i = 0; i < 12; i++) {
        const mesh = new THREE.Mesh(geo, mat);
        const radius = Math.random() * 6 + 2;
        const angle = (i / 12) * Math.PI * 2;
        mesh.position.set(
            pRoom.cx + Math.cos(angle) * radius,
            1 + Math.random() * 5,
            pRoom.cz + Math.sin(angle) * radius
        );
        mesh.castShadow = true;
        scene.add(mesh);
        toruses.push({ mesh, offset: Math.random() * 10 });
    }

    simulations.push((time) => {
        toruses.forEach(t => {
            t.mesh.rotation.x = time + t.offset;
            t.mesh.rotation.y = time * 1.5 + t.offset;
        });
    });
}

function initRoom4(scene) {
    const pRoom = roomData.find(r => r.id === "4");
    const crystals = [];
    const geo = new THREE.OctahedronGeometry(1.2);
    const mat = new THREE.MeshStandardMaterial({
        color: pRoom.color, emissive: pRoom.emissive, emissiveIntensity: 0.3,
        transparent: true, opacity: 0.7, metalness: 0.5, roughness: 0.1
    });

    for (let i = 0; i < 20; i++) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
            pRoom.cx + (Math.random() - 0.5) * 18,
            2 + Math.random() * 4,
            pRoom.cz + (Math.random() - 0.5) * 18
        );
        mesh.castShadow = true;
        scene.add(mesh);
        crystals.push({ mesh, speed: Math.random() * 2 + 0.5, heightBase: mesh.position.y });
    }

    simulations.push((time) => {
        crystals.forEach((c, i) => {
            c.mesh.rotation.y = time * c.speed;
            c.mesh.position.y = c.heightBase + Math.sin(time + i) * 0.5;
        });
    });
}

// ───────────────────────────────────────────────
// Player Character
// ───────────────────────────────────────────────

function createPlayer(scene) {
    playerGroup = new THREE.Group();
    playerGroup.position.set(12.5, 1.5, 0);
    scene.add(playerGroup);

    const charMat = new THREE.MeshStandardMaterial({
        color: 0xffff00, emissive: 0xffaa00, emissiveIntensity: 0.4,
        roughness: 0.4, metalness: 0.2
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 16), charMat);
    body.position.y = 0.75;
    body.castShadow = true;
    playerGroup.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), charMat);
    head.position.y = 2;
    head.castShadow = true;
    playerGroup.add(head);

    const armGeo = new THREE.CylinderGeometry(0.15, 0.15, 1, 8);
    const leftArm = new THREE.Mesh(armGeo, charMat);
    leftArm.position.set(-0.7, 1, 0);
    leftArm.rotation.z = Math.PI / 8;
    playerGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, charMat);
    rightArm.position.set(0.7, 1, 0);
    rightArm.rotation.z = -Math.PI / 8;
    playerGroup.add(rightArm);
}

// ───────────────────────────────────────────────
// Room Detection
// ───────────────────────────────────────────────

function detectRoom() {
    const px = playerGroup.position.x;
    const pz = playerGroup.position.z;

    let detectedId = null;
    if (px >= 0 && pz >= 0) detectedId = "3";      // Volcán
    else if (px < 0 && pz >= 0) detectedId = "4";   // Bosque
    else if (px < 0 && pz < 0) detectedId = "1";   // Nebulosa
    else if (px >= 0 && pz < 0) detectedId = "2";   // Océano

    if (detectedId && detectedId !== currentRoomId) {
        currentRoomId = detectedId;
        const room = roomData.find(r => r.id === currentRoomId);

        const roomNameDisplay = document.getElementById('room-name-display');
        const currentRoomText = document.getElementById('current-room-name');

        if (currentRoomText) {
            currentRoomText.innerText = room.name;
            currentRoomText.style.color = '#' + room.emissive.toString(16).padStart(6, '0');
        }

        if (roomNameDisplay) {
            roomNameDisplay.innerText = room.name;
            roomNameDisplay.style.color = '#' + room.emissive.toString(16).padStart(6, '0');
            roomNameDisplay.classList.add('visible');

            clearTimeout(roomOverlayTimeout);
            roomOverlayTimeout = setTimeout(() => {
                roomNameDisplay.classList.remove('visible');
            }, 2000);
        }
    }
}

// ───────────────────────────────────────────────
// Public Interface
// ───────────────────────────────────────────────

export const carousel = {
    scene: null,
    camera: null,

    /**
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.EffectComposer} composer
     */
    init(renderer, composer) {
        _composer = composer;
        _renderer = renderer;

        // Scene
        carouselScene = new THREE.Scene();
        carouselScene.background = new THREE.Color(0x050510);
        carouselScene.fog = new THREE.FogExp2(0x050510, 0.015);
        this.scene = carouselScene;

        // Camera
        carouselCamera = new THREE.PerspectiveCamera(
            75, window.innerWidth / window.innerHeight, 0.1, 1000
        );
        this.camera = carouselCamera;

        // Lighting
        ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        carouselScene.add(ambientLight);

        dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
        dirLight.castShadow = deviceProfile.useShadows;
        dirLight.shadow.mapSize.width = deviceProfile.shadowMapSize;
        dirLight.shadow.mapSize.height = deviceProfile.shadowMapSize;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 50;
        const d = 20;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        carouselScene.add(dirLight);

        // Build rooms and simulations
        buildRooms(carouselScene);
        simulations.length = 0;
        initRoom1(carouselScene);
        initRoom2(carouselScene);
        initRoom3(carouselScene);
        initRoom4(carouselScene);

        // Player
        createPlayer(carouselScene);

        // --- Post-processing passes (skip on mobile when composer is null) ---
        if (composer) {
            renderPass = new THREE.RenderPass(carouselScene, carouselCamera);
            composer.addPass(renderPass);

            blurPass = new THREE.ShaderPass(BlurShader);
            blurPass.uniforms.amount.value = 0.0;
            composer.addPass(blurPass);

            pixelPass = new THREE.ShaderPass(PixelateShader);
            pixelPass.uniforms.pixelSize.value = 0.0;
            composer.addPass(pixelPass);

            hazePass = new THREE.ShaderPass(HazeShader);
            hazePass.uniforms.intensity.value = 0.0;
            composer.addPass(hazePass);
        }

        // Reset navigation state
        orbitAngle = 0;
        velocity = 0;
        currentRoomId = null;
    },

    /**
     * @param {number} time  - elapsed seconds from clock
     * @param {object} keys  - { left, right } booleans
     */
    update(time, keys) {
        if (!carouselScene || !carouselCamera || !playerGroup) return;

        // Movement
        if (keys.left) velocity += 0.0015;
        if (keys.right) velocity -= 0.0015;

        // Friction
        if (!keys.left && !keys.right) {
            velocity *= 0.95;
        }

        velocity = Math.max(-0.02, Math.min(0.02, velocity));
        orbitAngle += velocity;

        playerGroup.position.x = Math.cos(orbitAngle) * orbitRadius;
        playerGroup.position.z = Math.sin(orbitAngle) * orbitRadius;

        playerGroup.rotation.y = orbitAngle - Math.PI / 2;
        if (velocity < -0.0001) {
            playerGroup.rotation.y += Math.PI;
        }

        playerGroup.position.y = 1.5 + Math.sin(time * 10) * 0.05;

        // Camera
        const cameraDistance = 18;
        carouselCamera.position.x = playerGroup.position.x + Math.cos(orbitAngle) * cameraDistance;
        carouselCamera.position.z = playerGroup.position.z + Math.sin(orbitAngle) * cameraDistance;
        carouselCamera.position.y = 6;

        carouselCamera.lookAt(
            playerGroup.position.x,
            playerGroup.position.y + 1,
            playerGroup.position.z
        );
        dirLight.position.set(
            playerGroup.position.x + 5,
            playerGroup.position.y + 10,
            playerGroup.position.z + 5
        );

        // Shader uniforms — distance-based blending (only when PostFX active)
        if (_composer) {
            const px = playerGroup.position.x;
            const pz = playerGroup.position.z;

            const distR1 = Math.sqrt(Math.pow(px - (-12.5), 2) + Math.pow(pz - (-12.5), 2));
            const weightR1 = Math.max(0, 1.0 - (distR1 / 20.0));
            blurPass.uniforms.amount.value = THREE.MathUtils.lerp(
                blurPass.uniforms.amount.value, weightR1 * 5.0, 0.05
            );

            const distR4 = Math.sqrt(Math.pow(px - (-12.5), 2) + Math.pow(pz - 12.5, 2));
            const weightR4 = Math.max(0, 1.0 - (distR4 / 20.0));
            pixelPass.uniforms.pixelSize.value = THREE.MathUtils.lerp(
                pixelPass.uniforms.pixelSize.value, weightR4 * 16.0, 0.05
            );

            const distR3 = Math.sqrt(Math.pow(px - 12.5, 2) + Math.pow(pz - 12.5, 2));
            const weightR3 = Math.max(0, 1.0 - (distR3 / 20.0));
            hazePass.uniforms.intensity.value = THREE.MathUtils.lerp(
                hazePass.uniforms.intensity.value, weightR3 * 2.5, 0.05
            );
            hazePass.uniforms.time.value = time;
        }

        // Room detection and simulations
        detectRoom();
        simulations.forEach(sim => sim(time));

        // Render: composer (PostFX) or direct fallback
        if (_composer) {
            _composer.render();
        } else {
            _renderer.render(carouselScene, carouselCamera);
        }
    },

    /**
     * Getter for the pixelPass — needed by resize handler to update resolution uniform.
     */
    getPixelPass() {
        return pixelPass;
    },

    dispose() {
        // Remove passes this module added to the composer
        if (_composer) {
            if (renderPass) _composer.removePass(renderPass);
            if (blurPass) _composer.removePass(blurPass);
            if (pixelPass) _composer.removePass(pixelPass);
            if (hazePass) _composer.removePass(hazePass);
        }

        // Traverse scene and dispose all geometries and materials
        if (carouselScene) {
            carouselScene.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            carouselScene.clear();
            carouselScene = null;
        }

        // Reset state
        this.scene = null;
        this.camera = null;
        carouselCamera = null;
        playerGroup = null;
        simulations.length = 0;
        orbitAngle = 0;
        velocity = 0;
        currentRoomId = null;
        blurPass = null;
        pixelPass = null;
        hazePass = null;
        renderPass = null;
        _composer = null;
        _renderer = null;
    }
};

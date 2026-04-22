// worlds/world09.js
// BubblePicking world — 4 themed rooms with walk character,
// ascending bubbles, floating images, and bubble-picking mechanics.
// Datamosh melt trail behind the character while walking.
// Uses global THREE (r128 via CDN script tags).

import { deviceProfile } from '../core/deviceProfile.js';
import { uiSound } from '../audio/uiSounds.js?v=3';

// ─── Private state ───
let bpScene = null;
let bpCamera = null;

let ambientLight = null;
let dirLight = null;

let playerGroup = null;
let playerMixer = null;
let walkAction = null;
let orbitAngle = 0;
let velocity = 0;
const orbitRadius = 16;
let lastFacingRight = true;
let _windOn = false;

let currentRoomId = null;
let roomOverlayTimeout = null;

const simulations = [];

// Shader passes (unused now — datamosh replaces EffectComposer)
let _composer = null;
let _renderer = null;

// ─── Datamosh trail state ───
let _rtCurrent = null;
let _rtTrailA = null;
let _rtTrailB = null;
let _trailRead = null;
let _trailWrite = null;
let _datamoshScene = null;
let _datamoshCamera = null;
let _datamoshMat = null;
let _finalScene = null;
let _finalMat = null;
let _lastTrailDir = 1.0;
let _trailIntensity = 0.0;
let _lastTime = 0;

// ─── Camera-motion tracking (Option B back-projection approximation) ───
let _prevPVMatrix = null;
let _currPVMatrix = null;
let _motionVec = null;       // THREE.Vector2, UV-space displacement
let _worldRef = null;        // THREE.Vector3, reference point to track
let _tmpV4 = null;           // THREE.Vector4, scratch for projection
let _prevMatricesReady = false;
let _charProjScratch = null;

// ─── Textures ───
let floorTex = null;
let wallTextures = {};

const roomWalls = {};

const state = {
    currentRoom: null,
    bubbleAttached: false,
    bubbleHasImages: false,
    room2Entered: false,
    room3Entered: false,
    room4Entered: false
};

let bubbles = [];
let attachedBubble = null;
let floatingImages = [];
let centralBubble = null;
let absorbedImages = [];
let absorbing = false;
let absorbIndex = 0;
let absorbTimer = 0;
let playerBubbleImages = [];

const roomData = [
    { id: "1", name: "Sala 1 — Nebulosa", color: 0xffffff, emissive: 0xffffff, cx: -12.5, cz: -12.5, wallTex: 'Wall1.png' },
    { id: "2", name: "Sala 2 — Burbujas", color: 0xffffff, emissive: 0xffffff, cx: -12.5, cz: 12.5,  wallTex: 'Wall2.png' },
    { id: "3", name: "Sala 3 — Imágenes", color: 0xffffff, emissive: 0xffffff, cx: 12.5,  cz: 12.5,  wallTex: 'Wall3.png' },
    { id: "4", name: "Sala 4 — Fusión",   color: 0xffffff, emissive: 0xffffff, cx: 12.5,  cz: -12.5, wallTex: 'Wall4.png' }
];

// ═══════════════════════════════════════════════
// Datamosh Melt Shader
// ═══════════════════════════════════════════════
const DatamoshShader = {
    vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
    `,
    fragmentShader: `
        // Depth-based datamosh — per-pixel temporal reprojection.
        // Each pixel reconstructs its world-space position from depth + inverse
        // ProjView of the current camera, then projects that world point through
        // the PREVIOUS camera's ProjView to find where it was on screen last
        // frame. Samples the trail buffer at that UV → motion vectors respect
        // parallax (distant pixels smear less than near ones, just like the
        // shadertoy tlsSRs).
        uniform sampler2D tCurrent;
        uniform sampler2D tTrail;
        uniform sampler2D tDepth;
        uniform mat4      uInvCurrPV;  // inverse of (proj * view) now
        uniform mat4      uPrevPV;     // (proj * view) last frame
        uniform bool      uHasPrev;
        uniform float     uTime;
        uniform float     uDecay;
        uniform float     uDisplace;
        uniform float     uBlockSize;
        uniform float     uActive;
        uniform vec2      uResolution;
        uniform vec2      uCharacterPos;  // character screen pos in [0..1]
        uniform float     uTrailDir;      // -1 = walking left (effect on right), +1 = walking right (effect on left)
        varying vec2 vUv;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
            vec2 blockUv     = floor(vUv / uBlockSize) * uBlockSize;
            vec2 blockCenter = blockUv + vec2(uBlockSize * 0.5);
            vec3 curColor    = texture2D(tCurrent, vUv).rgb;

            // ── Per-pixel reprojection ──
            float depth = texture2D(tDepth, vUv).x;        // [0..1] non-linear
            vec2  prevUv = vUv;
            bool  skyPixel = depth > 0.9995;               // skybox / far plane
            if (uHasPrev && !skyPixel) {
                // Clip-space of this pixel at current camera
                vec4 clip = vec4(vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
                // World-space
                vec4 world = uInvCurrPV * clip;
                world.xyz /= world.w;
                world.w = 1.0;
                // Project through previous camera → previous clip
                vec4 prevClip = uPrevPV * world;
                if (prevClip.w > 0.0) {
                    vec2 prevNdc = prevClip.xy / prevClip.w;
                    prevUv = prevNdc * 0.5 + 0.5;
                }
            }

            // Motion vector from reprojection (this is the per-pixel, depth-aware shift)
            vec2 motionVec = prevUv - vUv;

            // ── Half-screen side mask ──
            // If character walks left (uTrailDir = -1), effect shows on the right side.
            // If character walks right (uTrailDir = +1), effect shows on the left side.
            float boundary = mix(0.5, uCharacterPos.x, 0.7);
            float sideRaw = (vUv.x - boundary) * -uTrailDir;
            float trailMask = smoothstep(-0.08, 0.08, sideRaw) * uActive;

            // Downward displacement bias (content melts downward within the masked side)
            vec2 downBias = vec2(0.0, uDisplace * 2.5 * trailMask);

            // Subtle per-block jitter for macroblock aesthetic (compression look)
            vec2 blockJitter = vec2(
                hash(blockUv + 0.13) - 0.5,
                hash(blockUv + 0.79) - 0.5
            ) * uDisplace * trailMask * 0.4;

            vec2 sampleUv = mix(vUv, prevUv, trailMask) + blockJitter + downBias;

            // OOB → edge corruption noise
            bool oob = sampleUv.x < 0.0 || sampleUv.x > 1.0 ||
                       sampleUv.y < 0.0 || sampleUv.y > 1.0;

            vec3 trailColor;
            if (oob) {
                vec2 n = blockUv + floor(uTime * 1.5) * 0.17;
                trailColor = vec3(hash(n), hash(n + 0.31), hash(n + 0.71));
            } else {
                // RGB split aligned with the motion vector (directional chroma shift)
                vec2 rgbShift = motionVec * 0.35;
                float r = texture2D(tTrail, clamp(sampleUv + rgbShift, 0.0, 1.0)).r;
                float g = texture2D(tTrail, sampleUv).g;
                float b = texture2D(tTrail, clamp(sampleUv - rgbShift, 0.0, 1.0)).b;
                trailColor = vec3(r, g, b);
            }

            // Occasional block freeze — pick a stale lookup along motion direction
            float freezeBlock = step(0.85, hash(blockUv + floor(uTime * 1.8) * 0.23));
            vec2 freezeUv = clamp(blockCenter + motionVec * 2.5, 0.0, 1.0);
            vec3 frozenSample = texture2D(tTrail, freezeUv).rgb;
            trailColor = mix(trailColor, frozenSample, freezeBlock * uActive * 0.5);

            // Sky/background pixels: track current (no smear on flat background)
            if (skyPixel) trailColor = curColor;

            // Feedback accumulation — only on the masked side
            float decay = mix(0.05, uDecay, trailMask);
            vec3  result = mix(curColor, trailColor, decay);

            gl_FragColor = vec4(result, 1.0);
        }
    `
};

// ═══════════════════════════════════════════════
// Room Construction
// ═══════════════════════════════════════════════
function buildRooms(scene) {
    const texLoader = new THREE.TextureLoader();
    floorTex = texLoader.load('assets/CarouselFloor.png');
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 4);

    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8, metalness: 0.2 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(25, 32), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    roomData.forEach(room => {
        const wTex = texLoader.load('assets/' + room.wallTex);
        wTex.wrapS = THREE.ClampToEdgeWrapping;
        wTex.wrapT = THREE.ClampToEdgeWrapping;
        wallTextures[room.id] = wTex;

        const pLight = new THREE.PointLight(room.emissive, 2.5, 40);
        pLight.position.set(room.cx, 5, room.cz);
        scene.add(pLight);

        const innerWallMat = new THREE.MeshStandardMaterial({
            map: wTex, color: 0xffffff,
            emissive: 0x000000, emissiveIntensity: 0.0,
            transparent: true, opacity: 0.85, side: THREE.DoubleSide
        });

        const wT = 0.5, wH = 10, rs = 24.5;
        roomWalls[room.id] = [];

        const addWall = (w, h, d, px, pz, mat) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat.clone());
            wall.position.set(px, h / 2, pz);
            wall.receiveShadow = true;
            wall.castShadow = true;
            scene.add(wall);
            roomWalls[room.id].push(wall);
        };

        const zNear = room.cz - rs / 2;
        const zFar  = room.cz + rs / 2;
        const xNear = room.cx - rs / 2;
        const xFar  = room.cx + rs / 2;

        if (Math.abs(zNear) <= 12) addWall(rs, wH, wT, room.cx, zNear, innerWallMat);
        if (Math.abs(zFar)  <= 12) addWall(rs, wH, wT, room.cx, zFar,  innerWallMat);
        if (Math.abs(xNear) <= 12) addWall(wT, wH, rs, xNear, room.cz, innerWallMat);
        if (Math.abs(xFar)  <= 12) addWall(wT, wH, rs, xFar,  room.cz, innerWallMat);
    });
}

// ═══════════════════════════════════════════════
// Room Simulations
// ═══════════════════════════════════════════════
// Helper: billboard a plane to face the camera horizontally (keeps it upright)
function billboardToCamera(mesh) {
    if (!bpCamera) return;
    mesh.lookAt(bpCamera.position.x, mesh.position.y, bpCamera.position.z);
}

// ── Room 1 — c01.png: burbujas subiendo de abajo hacia arriba ──
function initRoom1(scene) {
    const pRoom = roomData.find(r => r.id === "1");
    const texLoader = new THREE.TextureLoader();
    const tex = texLoader.load('assets/tex/c01.png');
    const count = 28;
    const r1Bubbles = [];
    for (let i = 0; i < count; i++) {
        const size = 0.5 + Math.random() * 1.0;
        const geo = new THREE.PlaneGeometry(size, size);
        const mat = new THREE.MeshBasicMaterial({
            map: tex, transparent: true, side: THREE.DoubleSide,
            opacity: 0.75 + Math.random() * 0.2, depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
            pRoom.cx + (Math.random() - 0.5) * 20,
            -0.5 + Math.random() * 11,   // spread along full vertical at start
            pRoom.cz + (Math.random() - 0.5) * 20
        );
        mesh.userData.speed  = 0.4 + Math.random() * 0.9;
        mesh.userData.wobble = Math.random() * Math.PI * 2;
        mesh.userData.baseX  = mesh.position.x;
        mesh.userData.baseZ  = mesh.position.z;
        scene.add(mesh);
        r1Bubbles.push(mesh);
    }
    simulations.push((time) => {
        r1Bubbles.forEach(b => {
            b.position.y += b.userData.speed * 0.016;
            b.position.x  = b.userData.baseX + Math.sin(time * 1.2 + b.userData.wobble) * 0.45;
            b.position.z  = b.userData.baseZ + Math.cos(time * 0.9 + b.userData.wobble) * 0.35;
            billboardToCamera(b);
            if (b.position.y > 11) {
                b.position.y = -0.6;
                b.userData.baseX = pRoom.cx + (Math.random() - 0.5) * 20;
                b.userData.baseZ = pRoom.cz + (Math.random() - 0.5) * 20;
            }
        });
    });
}

// Helper: sample an (x,z) point inside the room quadrant AND inside the
// circular floor of radius FLOOR_R centered at origin.
function sampleInsideFloor(pRoom, halfRange, floorR) {
    for (let i = 0; i < 40; i++) {
        const x = pRoom.cx + (Math.random() - 0.5) * 2 * halfRange;
        const z = pRoom.cz + (Math.random() - 0.5) * 2 * halfRange;
        if (Math.sqrt(x * x + z * z) <= floorR) return { x, z };
    }
    // fallback: pull toward room center
    return { x: pRoom.cx * 0.6, z: pRoom.cz * 0.6 };
}

// ── Room 2 — c02.png: 20 flores cerca del piso, dentro del círculo ──
function initRoom2(scene) {
    const pRoom = roomData.find(r => r.id === "2");
    const texLoader = new THREE.TextureLoader();
    const tex = texLoader.load('assets/tex/c02.png');
    const flowers = [];
    const FLOOR_R = 23.5;   // dentro del piso redondo (r=25)
    for (let i = 0; i < 20; i++) {
        // base 1.05–1.75, variación hasta +40% → multiplicador 1.0–1.4
        const baseSize = 1.05 + Math.random() * 0.7;
        const size = baseSize * (1.0 + Math.random() * 0.4);
        const geo = new THREE.PlaneGeometry(size, size);
        const mat = new THREE.MeshBasicMaterial({
            map: tex, transparent: true, side: THREE.DoubleSide,
            opacity: 0.92, depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        const p = sampleInsideFloor(pRoom, 7.5, FLOOR_R);
        // apoyar cerca del suelo: centro = size/2 + pequeño margen
        mesh.position.set(p.x, size * 0.5 + 0.05, p.z);
        mesh.userData.phase = Math.random() * Math.PI * 2;
        mesh.userData.baseY = mesh.position.y;
        scene.add(mesh);
        flowers.push(mesh);
    }
    bubbles = [];
    simulations.push((time) => {
        flowers.forEach(f => {
            // bob pequeño alrededor de baseY, nunca atraviesa el piso
            f.position.y = f.userData.baseY + Math.abs(Math.sin(time * 0.6 + f.userData.phase)) * 0.12;
            billboardToCamera(f);
        });
    });
}

// ── Room 3 — c03.png: 20 elementos cerca del piso (igual que room 2) ──
function initRoom3(scene) {
    const pRoom = roomData.find(r => r.id === "3");
    const texLoader = new THREE.TextureLoader();
    const tex = texLoader.load('assets/tex/c03.png');
    const items = [];
    const FLOOR_R = 23.5;
    for (let i = 0; i < 20; i++) {
        const baseSize = 1.05 + Math.random() * 0.7;
        const size = baseSize * (1.0 + Math.random() * 0.4);
        const geo = new THREE.PlaneGeometry(size, size);
        const mat = new THREE.MeshBasicMaterial({
            map: tex, transparent: true, side: THREE.DoubleSide,
            opacity: 0.92, depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        const p = sampleInsideFloor(pRoom, 7.5, FLOOR_R);
        mesh.position.set(p.x, size * 0.5 + 0.05, p.z);
        mesh.userData.phase = Math.random() * Math.PI * 2;
        mesh.userData.baseY = mesh.position.y;
        scene.add(mesh);
        items.push(mesh);
    }
    floatingImages = [];
    simulations.push((time) => {
        items.forEach(f => {
            f.position.y = f.userData.baseY + Math.abs(Math.sin(time * 0.6 + f.userData.phase)) * 0.12;
            billboardToCamera(f);
        });
    });
}

// ── Room 4 — c04.png: 2 elementos simétricos, más centrados y dentro del piso ──
function initRoom4(scene) {
    const pRoom = roomData.find(r => r.id === "4");
    const texLoader = new THREE.TextureLoader();
    const tex = texLoader.load('assets/tex/c04.png');
    // "Más centrados": reduzco el offset para que queden dentro del piso r=25
    const offset = 5;
    const items = [];
    [[-offset, 0], [offset, 0]].forEach(([dx, dz]) => {
        const size = 3.4;
        // Altura +40% respecto al último valor (1.3 → 1.82)
        const geo = new THREE.PlaneGeometry(size, size * 1.82);
        const mat = new THREE.MeshBasicMaterial({
            map: tex, transparent: true, side: THREE.DoubleSide,
            opacity: 0.95, depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pRoom.cx + dx, 2.8, pRoom.cz + dz);
        mesh.userData.phase = (dx < 0 ? 0 : Math.PI);  // desfase simétrico
        mesh.userData.baseY = mesh.position.y;
        scene.add(mesh);
        items.push(mesh);
    });
    simulations.push((time) => {
        items.forEach(f => {
            f.position.y = f.userData.baseY + Math.sin(time * 0.5 + f.userData.phase) * 0.22;
            billboardToCamera(f);
        });
    });
}

// ═══════════════════════════════════════════════
// Player Character
// ═══════════════════════════════════════════════
function createPlayer(scene) {
    playerGroup = new THREE.Group();
    playerGroup.position.set(orbitRadius, 0, 0);
    scene.add(playerGroup);
    const loader = new THREE.GLTFLoader();
    loader.load('assets/3D/walk.glb?v=5', (gltf) => {
        let clone;
        if (THREE.SkeletonUtils && THREE.SkeletonUtils.clone) {
            clone = THREE.SkeletonUtils.clone(gltf.scene);
        } else {
            clone = gltf.scene.clone();
        }
        clone.scale.set(4.25, 4.25, 4.25);
        clone.position.set(0, 0, 0);
        clone.traverse(child => {
            if (child.isMesh) {
                child.frustumCulled = false;
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(m => { const c = m.clone(); c.skinning = true; return c; });
                } else if (child.material) {
                    child.material = child.material.clone();
                    child.material.skinning = true;
                }
                child.castShadow = true;
            }
        });
        playerGroup.add(clone);
        if (gltf.animations && gltf.animations.length > 0) {
            playerMixer = new THREE.AnimationMixer(clone);
            walkAction = playerMixer.clipAction(gltf.animations[0]);
            walkAction.play();
            walkAction.paused = true;
        }
    }, undefined, (e) => console.error("BubblePicking: Error loading walk.glb", e));
}

// ═══════════════════════════════════════════════
// Room Detection
// ═══════════════════════════════════════════════
function detectRoom() {
    if (!playerGroup) return;
    const px = playerGroup.position.x;
    const pz = playerGroup.position.z;
    let detectedId = null;
    if (px < 0 && pz < 0) detectedId = "1";
    else if (px < 0 && pz >= 0) detectedId = "2";
    else if (px >= 0 && pz >= 0) detectedId = "3";
    else if (px >= 0 && pz < 0) detectedId = "4";

    if (detectedId && detectedId !== currentRoomId) {
        currentRoomId = detectedId;
        state.currentRoom = detectedId;
    }
}

// ═══════════════════════════════════════════════
// Bubble Mechanics
// ═══════════════════════════════════════════════
function attachNearestBubble() {
    if (!playerGroup || bubbles.length === 0) return;
    let closest = null, minDist = Infinity;
    bubbles.forEach(b => { if (!b.userData.attached) { const dd = playerGroup.position.distanceTo(b.position); if (dd < minDist) { minDist = dd; closest = b; } } });
    if (closest) {
        closest.userData.attached = true;
        state.bubbleAttached = true;
        attachedBubble = closest;
        const worldPos = new THREE.Vector3();
        closest.getWorldPosition(worldPos);
        bpScene.remove(closest);
        closest.position.set(0, 2.8, 0.1);
        playerGroup.add(closest);
        closest.scale.set(3, 3, 3);
        closest.material.opacity = 0.35;
    }
}

function fillPlayerBubbleWithImages() {
    if (!attachedBubble) return;
    const texLoader = new THREE.TextureLoader();
    const imgTex = texLoader.load('assets/CarouselFloor.png');
    for (let i = 0; i < 8; i++) {
        const geo = new THREE.PlaneGeometry(0.04, 0.04);
        const mat = new THREE.MeshBasicMaterial({ map: imgTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
        const plane = new THREE.Mesh(geo, mat);
        plane.userData.orbitPhase = i * (Math.PI * 2 / 8);
        attachedBubble.add(plane);
        playerBubbleImages.push(plane);
    }
}

// ═══════════════════════════════════════════════
// Public Interface
// ═══════════════════════════════════════════════
export const bubblepicking = {
    scene: null,
    camera: null,

    init(renderer, composer) {
        _composer = composer;
        _renderer = renderer;

        Object.assign(state, {
            currentRoom: null, bubbleAttached: false, bubbleHasImages: false,
            room2Entered: false, room3Entered: false, room4Entered: false
        });
        bubbles = [];
        floatingImages = [];
        absorbedImages = [];
        playerBubbleImages = [];
        attachedBubble = null;
        centralBubble = null;
        absorbing = false;
        absorbIndex = 0;
        absorbTimer = 0;
        _trailIntensity = 0.0;
        _lastTime = 0;
        _lastTrailDir = 1.0;

        // Camera-motion tracking
        _prevPVMatrix = new THREE.Matrix4();
        _currPVMatrix = new THREE.Matrix4();
        _motionVec = new THREE.Vector2(0, 0);
        _worldRef = new THREE.Vector3(0, 1, 0);
        _tmpV4 = new THREE.Vector4();
        _prevMatricesReady = false;
        _charProjScratch = new THREE.Vector3();

        bpScene = new THREE.Scene();
        // Beach-night lighting (matching World 06 Super_Me_Era)
        bpScene.background = new THREE.Color(0x020612);
        bpScene.fog = new THREE.Fog(0x001040, 8, 26);
        this.scene = bpScene;

        bpCamera = new THREE.PerspectiveCamera(120, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera = bpCamera;

        ambientLight = new THREE.AmbientLight(0x1a3a7a, 3.4);
        bpScene.add(ambientLight);

        dirLight = new THREE.DirectionalLight(0x9ab4ff, 2.4);
        dirLight.castShadow = deviceProfile.useShadows;
        dirLight.shadow.mapSize.width = deviceProfile.shadowMapSize;
        dirLight.shadow.mapSize.height = deviceProfile.shadowMapSize;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 80;
        const d = 30;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        bpScene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0x4466cc, 2.0);
        fillLight.position.set(-5, 3, 8);
        bpScene.add(fillLight);

        buildRooms(bpScene);
        simulations.length = 0;
        initRoom1(bpScene);
        initRoom2(bpScene);
        initRoom3(bpScene);
        initRoom4(bpScene);
        createPlayer(bpScene);

        // ── Datamosh pipeline (follows world06 pattern exactly) ──
        const W = Math.max(1, renderer.domElement.clientWidth  || 800);
        const H = Math.max(1, renderer.domElement.clientHeight || 600);

        _datamoshCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // rtCurrent carries a depth texture — enables per-pixel temporal
        // reprojection (parallax-correct motion vectors in the datamosh shader).
        const _depthTex = new THREE.DepthTexture(W, H);
        _depthTex.type = THREE.UnsignedShortType;
        _rtCurrent = new THREE.WebGLRenderTarget(W, H, {
            depthBuffer:  true,
            depthTexture: _depthTex,
            minFilter:    THREE.LinearFilter,
            magFilter:    THREE.LinearFilter
        });
        _rtTrailA  = new THREE.WebGLRenderTarget(W, H);
        _rtTrailB  = new THREE.WebGLRenderTarget(W, H);
        _trailRead  = _rtTrailA;
        _trailWrite = _rtTrailB;

        _datamoshMat = new THREE.ShaderMaterial({
            vertexShader: DatamoshShader.vertexShader,
            fragmentShader: DatamoshShader.fragmentShader,
            uniforms: {
                tCurrent:    { value: null },
                tTrail:      { value: null },
                tDepth:      { value: _depthTex },
                uInvCurrPV:  { value: new THREE.Matrix4() },
                uPrevPV:     { value: new THREE.Matrix4() },
                uHasPrev:    { value: false },
                uTime:       { value: 0 },
                uDecay:      { value: 0.94 },
                uDisplace:   { value: 0.018 },
                uBlockSize:  { value: 0.010 },
                uActive:     { value: 0.0 },
                uResolution: { value: new THREE.Vector2(W, H) },
                uCharacterPos: { value: new THREE.Vector2(0.5, 0.5) },
                uTrailDir:     { value: 1.0 }
            },
            depthWrite: false,
            depthTest: false
        });
        _datamoshScene = new THREE.Scene();
        _datamoshScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), _datamoshMat));

        _finalMat = new THREE.ShaderMaterial({
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
            fragmentShader: `
                uniform sampler2D tFinal;
                uniform float uGlowStrength;
                varying vec2 vUv;
                void main() {
                    vec4 color = texture2D(tFinal, vUv);
                    float spread = 0.003;
                    vec4 glow = vec4(0.0);
                    glow += texture2D(tFinal, vUv + vec2( spread,  0.0));
                    glow += texture2D(tFinal, vUv + vec2(-spread,  0.0));
                    glow += texture2D(tFinal, vUv + vec2(0.0,  spread));
                    glow += texture2D(tFinal, vUv + vec2(0.0, -spread));
                    glow += texture2D(tFinal, vUv + vec2( spread,  spread));
                    glow += texture2D(tFinal, vUv + vec2(-spread, -spread));
                    glow /= 6.0;
                    float brightness = dot(glow.rgb, vec3(0.2126, 0.7152, 0.0722));
                    float glowMask = smoothstep(0.3, 0.8, brightness);
                    color.rgb += glow.rgb * glowMask * uGlowStrength;
                    gl_FragColor = color;
                }
            `,
            uniforms: {
                tFinal:       { value: null },
                uGlowStrength: { value: 0.10 }
            },
            depthWrite: false,
            depthTest: false
        });
        _finalScene = new THREE.Scene();
        _finalScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), _finalMat));

        orbitAngle = Math.atan2(-12.5, -12.5);
        velocity = 0;
        currentRoomId = null;
        lastFacingRight = true;
    },

    update(time, keys) {
        if (!bpScene || !bpCamera || !playerGroup) return;

        // ── Delta time ──
        if (_lastTime === 0) _lastTime = time;
        let delta = time - _lastTime;
        if (delta > 0.1) delta = 0.016;
        _lastTime = time;

        // ── Movement ──
        const isMoving = keys.left || keys.right;
        // Wind ambience — fade in/out only on edges to avoid restarting the
        // gain ramp every frame.
        if (isMoving && !_windOn) { uiSound.startLoop('viento', 0.65, 0.6); _windOn = true; }
        else if (!isMoving && _windOn) { uiSound.stopLoop('viento', 0.8); _windOn = false; }
        // Velocity is now rad/s (was rad/frame). delta keeps it FPS-independent.
        // Previous per-frame values baselined at 60fps: accel 0.00024 → 0.0144 rad/s²,
        // cap 0.0032 → 0.192 rad/s, damping 0.95/frame → 0.95^60 per sec (≈ 0.046).
        // Original per-frame: v += 0.00024 rad/frame, cap 0.0032 rad/frame.
        // Convert to per-second by multiplying by 60^2 for accel and 60 for cap:
        //   accel = 0.00024 * 60 * 60 = 0.864 rad/s^2  (NOT 0.0144 — that was wrong)
        //   cap   = 0.0032 * 60       = 0.192 rad/s
        // Damping applied only when NOT moving (matches original).
        if (keys.left)  velocity += 1.08 * delta;
        if (keys.right) velocity -= 1.08 * delta;
        if (!isMoving) velocity *= Math.pow(0.95, delta * 60);
        velocity = Math.max(-0.24, Math.min(0.24, velocity));
        orbitAngle += velocity * delta;

        playerGroup.position.x = Math.cos(orbitAngle) * orbitRadius;
        playerGroup.position.z = Math.sin(orbitAngle) * orbitRadius;

        if (Math.abs(velocity) > 0.003) {  // scaled threshold (was 0.00005/frame)
            const sign = velocity > 0 ? 1 : -1;
            const dx = -Math.sin(orbitAngle) * sign;
            const dz =  Math.cos(orbitAngle) * sign;
            playerGroup.rotation.y = Math.atan2(dx, dz);
        }

        if (walkAction) {
            walkAction.paused = !isMoving;
            walkAction.timeScale = 0.4;
        }
        if (playerMixer) playerMixer.update(delta);

        // ── Camera ──
        const cameraDistance = 9;
        bpCamera.position.x = playerGroup.position.x + Math.cos(orbitAngle) * cameraDistance;
        bpCamera.position.z = playerGroup.position.z + Math.sin(orbitAngle) * cameraDistance;
        bpCamera.position.y = 6;
        bpCamera.lookAt(playerGroup.position.x, playerGroup.position.y + 1, playerGroup.position.z);
        dirLight.position.set(playerGroup.position.x + 5, playerGroup.position.y + 10, playerGroup.position.z + 5);

        detectRoom();
        // Run only simulations for the current room — rooms the player isn't
        // in don't need per-frame updates (big CPU win when not moving).
        if (currentRoomId !== null) {
            const simIdx = parseInt(currentRoomId, 10) - 1;
            if (simulations[simIdx]) simulations[simIdx](time);
        }

        // ── Progressive fade intensity (computed every frame) ──
        if (isMoving) {
            _trailIntensity = Math.min(1.0, _trailIntensity + delta / 0.8); // fast warmup
        } else {
            _trailIntensity = Math.max(0.0, _trailIntensity - delta / 4.0);
        }

        // ── Skip datamosh entirely when the effect is inactive ──
        // Renders the scene directly to screen → saves 2 fullscreen passes +
        // depth-texture sampling + ping-pong swap per frame.
        const datamoshActive = _trailIntensity > 0.002;
        if (!datamoshActive || !_rtCurrent || !_datamoshMat || !_finalMat) {
            _renderer.setRenderTarget(null);
            _renderer.render(bpScene, bpCamera);
            // Reset prev matrices so next activation starts clean (no stale smear)
            _prevMatricesReady = false;
            return;
        }

        // ── Datamosh render pipeline (world06 pattern) ──
        {
            const autoClear = _renderer.autoClear;
            _renderer.autoClear = false;

            // a. Render scene → rtCurrent
            _renderer.setRenderTarget(_rtCurrent);
            _renderer.clear();
            _renderer.render(bpScene, bpCamera);

            // Build current ProjView matrix and its inverse for per-pixel reprojection.
            _currPVMatrix.multiplyMatrices(bpCamera.projectionMatrix, bpCamera.matrixWorldInverse);

            const invCurrPV = _datamoshMat.uniforms.uInvCurrPV.value;
            invCurrPV.copy(_currPVMatrix);
            if (invCurrPV.invert) invCurrPV.invert();
            else invCurrPV.getInverse(_currPVMatrix);

            // uPrevPV: last frame's ProjView. On the very first frame we
            // gate with uHasPrev=false so the shader uses identity (no smear).
            _datamoshMat.uniforms.uPrevPV.value.copy(_prevPVMatrix);
            _datamoshMat.uniforms.uHasPrev.value = _prevMatricesReady;
            _prevPVMatrix.copy(_currPVMatrix);
            _prevMatricesReady = true;

            _datamoshMat.uniforms.tCurrent.value  = _rtCurrent.texture;
            _datamoshMat.uniforms.tTrail.value    = _trailRead.texture;
            _datamoshMat.uniforms.uTime.value     = time;
            _datamoshMat.uniforms.uActive.value   = _trailIntensity;
            _datamoshMat.uniforms.uDecay.value    = 0.88 + _trailIntensity * 0.08;
            _datamoshMat.uniforms.uDisplace.value = 0.002 + _trailIntensity * 0.012;

            // Track walk direction: left key → -1 (effect on right), right key → +1 (effect on left)
            if (keys.left)       _lastTrailDir = -1.0;
            else if (keys.right) _lastTrailDir =  1.0;
            _datamoshMat.uniforms.uTrailDir.value = _lastTrailDir;

            // Project character world position to screen UV [0..1]
            _charProjScratch.copy(playerGroup.position);
            _charProjScratch.y += 1.0;
            _charProjScratch.project(bpCamera);
            _datamoshMat.uniforms.uCharacterPos.value.set(
                (_charProjScratch.x + 1) * 0.5,
                (_charProjScratch.y + 1) * 0.5
            );

            // c. Accumulate: (rtCurrent + trailRead) → trailWrite
            _renderer.setRenderTarget(_trailWrite);
            _renderer.clear();
            _renderer.render(_datamoshScene, _datamoshCamera);

            // d. Swap ping-pong
            const tmp = _trailRead;
            _trailRead = _trailWrite;
            _trailWrite = tmp;

            // e. Final pass to screen (with glow)
            _finalMat.uniforms.tFinal.value = _trailRead.texture;
            _renderer.setRenderTarget(null);
            _renderer.clear();
            _renderer.render(_finalScene, _datamoshCamera);

            _renderer.autoClear = autoClear;
        }
    },

    getPixelPass() { return null; },

    dispose() {
        if (_windOn) { uiSound.stopLoop('viento', 0.4); _windOn = false; }
        if (playerMixer) {
            playerMixer.stopAllAction();
            if (playerGroup) playerMixer.uncacheRoot(playerGroup);
        }
        if (bpScene) {
            bpScene.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
            bpScene.clear();
            bpScene = null;
        }
        if (floorTex) floorTex.dispose();
        Object.values(wallTextures).forEach(t => t.dispose());
        wallTextures = {};

        if (_rtCurrent) { _rtCurrent.dispose(); _rtCurrent = null; }
        if (_rtTrailA)  { _rtTrailA.dispose();  _rtTrailA = null; }
        if (_rtTrailB)  { _rtTrailB.dispose();  _rtTrailB = null; }
        _trailRead = null;
        _trailWrite = null;
        if (_datamoshMat) { _datamoshMat.dispose(); _datamoshMat = null; }
        if (_finalMat) { _finalMat.dispose(); _finalMat = null; }
        _datamoshScene = null;
        _finalScene = null;
        _datamoshCamera = null;

        _prevPVMatrix = null;
        _currPVMatrix = null;
        _motionVec = null;
        _worldRef = null;
        _tmpV4 = null;
        _prevMatricesReady = false;

        this.scene = null;
        this.camera = null;
        bpCamera = null;
        playerGroup = null;
        playerMixer = null;
        walkAction = null;
        simulations.length = 0;
        orbitAngle = 0;
        velocity = 0;
        currentRoomId = null;
        _composer = null;
        _renderer = null;
        bubbles = [];
        floatingImages = [];
        absorbedImages = [];
        playerBubbleImages = [];
        attachedBubble = null;
        centralBubble = null;
    }
};

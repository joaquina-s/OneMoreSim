// worlds/world09.js
// BubblePicking world — 4 themed rooms with walk character,
// ascending bubbles, floating images, and bubble-picking mechanics.
// Datamosh melt trail behind the character while walking.
// Uses global THREE (r128 via CDN script tags).

import { deviceProfile } from '../core/deviceProfile.js';

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
    const floor = new THREE.Mesh(new THREE.CircleGeometry(25, 64), floorMat);
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
    const mat = new THREE.PointsMaterial({ size: 0.15, color: 0xcccccc, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(geo, mat);
    scene.add(particles);
    simulations.push((time) => {
        particles.rotation.y = time * 0.1;
        const positions = particles.geometry.attributes.position.array;
        for (let i = 0; i < count; i++) positions[i * 3 + 1] += Math.sin(time * 2 + i) * 0.01;
        particles.geometry.attributes.position.needsUpdate = true;
    });
}

function initRoom2(scene) {
    const pRoom = roomData.find(r => r.id === "2");
    bubbles = [];
    for (let i = 0; i < 20; i++) {
        const r = 0.17 + Math.random() * 0.40;
        const geo = new THREE.SphereGeometry(r, 16, 16);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.1,
            transparent: true, opacity: 0.3 + Math.random() * 0.2, roughness: 0.1, metalness: 0.1
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pRoom.cx + (Math.random() - 0.5) * 18, Math.random() * 10, pRoom.cz + (Math.random() - 0.5) * 18);
        mesh.userData.speed = 0.3 + Math.random() * 0.7;
        mesh.userData.baseX = mesh.position.x;
        mesh.userData.baseZ = mesh.position.z;
        mesh.userData.attached = false;
        mesh.userData.radius = r;
        scene.add(mesh);
        bubbles.push(mesh);
    }
    simulations.push((time) => {
        bubbles.forEach(b => {
            if (b.userData.attached) return;
            b.position.y += b.userData.speed * 0.016;
            b.position.x = b.userData.baseX + Math.sin(time * 2 + b.userData.speed * 10) * 0.3;
            if (b.position.y > 10) b.position.y = 0.2;
        });
    });
}

function initRoom3(scene) {
    const pRoom = roomData.find(r => r.id === "3");
    floatingImages = [];
    absorbedImages = [];
    absorbing = false;
    absorbIndex = 0;
    absorbTimer = 0;
    const texLoader = new THREE.TextureLoader();
    const imgTex = texLoader.load('assets/CarouselFloor.png');
    for (let i = 0; i < 15; i++) {
        const geo = new THREE.PlaneGeometry(0.15, 0.15);
        const mat = new THREE.MeshBasicMaterial({ map: imgTex, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pRoom.cx + (Math.random() - 0.5) * 16, 1 + Math.random() * 6, pRoom.cz + (Math.random() - 0.5) * 16);
        mesh.userData.homePos = mesh.position.clone();
        mesh.userData.phase = Math.random() * Math.PI * 2;
        mesh.userData.absorbed = false;
        scene.add(mesh);
        floatingImages.push(mesh);
    }
    const bubbleGeo = new THREE.SphereGeometry(4.0, 32, 32);
    const bubbleMat = new THREE.MeshStandardMaterial({
        color: 0xaaddff, emissive: 0x224466, emissiveIntensity: 0.2,
        transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.4
    });
    centralBubble = new THREE.Mesh(bubbleGeo, bubbleMat);
    centralBubble.position.set(pRoom.cx, 4, pRoom.cz);
    scene.add(centralBubble);
    simulations.push((time) => {
        floatingImages.forEach(img => {
            if (img.userData.absorbed) return;
            const h = img.userData.homePos;
            img.position.x = h.x + Math.sin(time * 0.8 + img.userData.phase) * 0.5;
            img.position.y = h.y + Math.cos(time * 1.2 + img.userData.phase) * 0.3;
            img.position.z = h.z + Math.sin(time * 0.6 + img.userData.phase + 1) * 0.4;
            img.rotation.y = time * 0.5 + img.userData.phase;
        });
        if (absorbing && absorbIndex < floatingImages.length) {
            absorbTimer += 0.016;
            if (absorbTimer > 0.3) {
                absorbTimer = 0;
                const img = floatingImages[absorbIndex];
                if (img && !img.userData.absorbed) {
                    img.userData.absorbed = true;
                    img.userData.orbitPhase = absorbIndex * (Math.PI * 2 / 15);
                    absorbedImages.push(img);
                }
                absorbIndex++;
            }
        }
        absorbedImages.forEach(img => {
            const orbitR = 3.0;
            const phase = img.userData.orbitPhase || 0;
            const targetX = centralBubble.position.x + Math.cos(time * 0.8 + phase) * orbitR;
            const targetY = centralBubble.position.y + Math.sin(time * 1.1 + phase) * orbitR * 0.6;
            const targetZ = centralBubble.position.z + Math.sin(time * 0.9 + phase + 1) * orbitR;
            img.position.x += (targetX - img.position.x) * 0.05;
            img.position.y += (targetY - img.position.y) * 0.05;
            img.position.z += (targetZ - img.position.z) * 0.05;
            img.rotation.y = time + phase;
        });
        const scale = 1 + Math.sin(time * 2) * 0.05;
        centralBubble.scale.set(scale, scale, scale);
    });
}

function initRoom4(scene) {
    const pRoom = roomData.find(r => r.id === "4");
    const texLoader = new THREE.TextureLoader();
    texLoader.load('assets/chars/8.webp', (charTex) => {
        const planeH = 8;
        const planeW = planeH * (charTex.image.width / charTex.image.height || 0.6);
        const geo = new THREE.PlaneGeometry(planeW, planeH);
        const mat = new THREE.MeshBasicMaterial({ map: charTex, transparent: true, side: THREE.DoubleSide });
        const charPlane = new THREE.Mesh(geo, mat);
        charPlane.position.set(pRoom.cx - 5, planeH / 2, pRoom.cz);
        scene.add(charPlane);
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
    loader.load('assets/3D/walk.glb', (gltf) => {
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

        bpScene = new THREE.Scene();
        // Beach-night lighting (matching World 06 Super_Me_Era)
        bpScene.background = new THREE.Color(0x020612);
        bpScene.fog = new THREE.Fog(0x001040, 8, 26);
        this.scene = bpScene;

        bpCamera = new THREE.PerspectiveCamera(120, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera = bpCamera;

        ambientLight = new THREE.AmbientLight(0x334466, 3.4);
        bpScene.add(ambientLight);

        dirLight = new THREE.DirectionalLight(0xffffff, 2.4);
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

        const fillLight = new THREE.DirectionalLight(0x7d85b4, 2.0);
        fillLight.position.set(-5, 3, 8);
        bpScene.add(fillLight);

        buildRooms(bpScene);
        simulations.length = 0;
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
        if (keys.left) velocity += 0.00024;
        if (keys.right) velocity -= 0.00024;
        if (!isMoving) velocity *= 0.95;
        velocity = Math.max(-0.0032, Math.min(0.0032, velocity));
        orbitAngle += velocity;

        playerGroup.position.x = Math.cos(orbitAngle) * orbitRadius;
        playerGroup.position.z = Math.sin(orbitAngle) * orbitRadius;

        if (Math.abs(velocity) > 0.00005) {
            const sign = velocity > 0 ? 1 : -1;
            const dx = -Math.sin(orbitAngle) * sign;
            const dz =  Math.cos(orbitAngle) * sign;
            playerGroup.rotation.y = Math.atan2(dx, dz);
        }

        if (walkAction) {
            walkAction.paused = !isMoving;
            walkAction.timeScale = 0.4;
        }
        if (playerMixer) playerMixer.update(0.016);

        // ── Camera ──
        const cameraDistance = 9;
        bpCamera.position.x = playerGroup.position.x + Math.cos(orbitAngle) * cameraDistance;
        bpCamera.position.z = playerGroup.position.z + Math.sin(orbitAngle) * cameraDistance;
        bpCamera.position.y = 6;
        bpCamera.lookAt(playerGroup.position.x, playerGroup.position.y + 1, playerGroup.position.z);
        dirLight.position.set(playerGroup.position.x + 5, playerGroup.position.y + 10, playerGroup.position.z + 5);

        detectRoom();
        simulations.forEach(sim => sim(time));

        // ── Datamosh render pipeline (world06 pattern) ──
        if (_rtCurrent && _datamoshMat && _finalMat && _trailRead && _trailWrite) {
            const autoClear = _renderer.autoClear;
            _renderer.autoClear = false;

            // a. Render scene → rtCurrent
            _renderer.setRenderTarget(_rtCurrent);
            _renderer.clear();
            _renderer.render(bpScene, bpCamera);

            // b. Progressive fade intensity
            if (isMoving) {
                _trailIntensity = Math.min(1.0, _trailIntensity + delta / 3.0);
            } else {
                _trailIntensity = Math.max(0.0, _trailIntensity - delta / 4.0);
            }

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
            const _charProj = playerGroup.position.clone();
            _charProj.y += 1.0;
            _charProj.project(bpCamera);
            _datamoshMat.uniforms.uCharacterPos.value.set(
                (_charProj.x + 1) * 0.5,
                (_charProj.y + 1) * 0.5
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
        } else {
            // Fallback: direct render
            _renderer.render(bpScene, bpCamera);
        }
    },

    getPixelPass() { return null; },

    dispose() {
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

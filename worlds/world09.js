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
        // Motion-based datamosh effect (inspired by shadertoy/tlsSRs):
        // - detects motion via current-vs-trail difference
        // - displaces macroblocks by random vectors (P-frame-style corruption)
        // - freezes some blocks randomly (compression glitch)
        // - RGB channel split on moving blocks
        // - where static: trail quickly tracks current (clean image)
        uniform sampler2D tCurrent;
        uniform sampler2D tTrail;
        uniform float     uTime;
        uniform float     uDecay;
        uniform float     uDisplace;
        uniform float     uBlockSize;
        uniform float     uActive;
        uniform vec2      uResolution;
        varying vec2 vUv;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
            vec2 blockUv     = floor(vUv / uBlockSize) * uBlockSize;
            vec2 blockCenter = blockUv + vec2(uBlockSize * 0.5);

            vec3 curColor   = texture2D(tCurrent, vUv).rgb;
            vec3 trailColor = texture2D(tTrail,   vUv).rgb;

            // Motion detection: current vs trail (both per-pixel and per-block)
            float pixMotion   = length(curColor - trailColor);
            vec3  curBlock    = texture2D(tCurrent, blockCenter).rgb;
            vec3  trailBlock  = texture2D(tTrail,   blockCenter).rgb;
            float blockMotion = length(curBlock - trailBlock);
            float motion      = max(pixMotion, blockMotion);

            // Motion mask with smooth threshold, scaled by uActive
            float moshMask = smoothstep(0.015, 0.12, motion) * uActive;

            // Per-block random motion vector (P-frame style),
            // biased slightly downward to suggest melt/drift
            vec2 blockDir;
            blockDir.x = hash(blockUv + 0.11) - 0.5;
            blockDir.y = abs(hash(blockUv + 0.73) - 0.5) + 0.15;
            blockDir *= uDisplace * (0.5 + moshMask * 1.8);

            // Sample trail at displaced position
            vec2 displacedUv    = clamp(vUv + blockDir, 0.0, 1.0);
            vec3 displacedTrail = texture2D(tTrail, displacedUv).rgb;

            // RGB channel split (stronger where motion is high)
            float shift = uDisplace * moshMask * 1.4;
            vec3  split;
            split.r = texture2D(tTrail, displacedUv + vec2( shift, 0.0)).r;
            split.g = displacedTrail.g;
            split.b = texture2D(tTrail, displacedUv + vec2(-shift, 0.0)).b;

            // Block freeze: some blocks stop updating (compression artifact)
            float freezeBlock  = step(0.75, hash(blockUv + floor(uTime * 2.0) * 0.17));
            vec3  frozenSample = texture2D(tTrail, blockCenter + blockDir * 0.5).rgb;
            vec3  corrupted    = mix(split, frozenSample, freezeBlock * moshMask * 0.55);

            // Feedback blend:
            //   static regions (moshMask≈0) → track current quickly (no persistence)
            //   moving regions (moshMask≈1) → heavy persistence of corrupted trail
            float decay  = mix(0.08, uDecay, moshMask);
            vec3  result = mix(curColor, corrupted, decay);

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

        bpScene = new THREE.Scene();
        bpScene.background = new THREE.Color(0x010814);
        bpScene.fog = new THREE.FogExp2(0x020d1f, 0.018);
        this.scene = bpScene;

        bpCamera = new THREE.PerspectiveCamera(120, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera = bpCamera;

        ambientLight = new THREE.AmbientLight(0x0a1a3f, 0.8);
        bpScene.add(ambientLight);

        dirLight = new THREE.DirectionalLight(0xc8d8ff, 1.8);
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

        const hemiLight = new THREE.HemisphereLight(0x0a1a4a, 0x001133, 0.6);
        bpScene.add(hemiLight);

        buildRooms(bpScene);
        simulations.length = 0;
        initRoom4(bpScene);
        createPlayer(bpScene);

        // ── Datamosh pipeline (follows world06 pattern exactly) ──
        const W = Math.max(1, renderer.domElement.clientWidth  || 800);
        const H = Math.max(1, renderer.domElement.clientHeight || 600);

        _datamoshCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        _rtCurrent = new THREE.WebGLRenderTarget(W, H);
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
                uTime:       { value: 0 },
                uDecay:      { value: 0.94 },
                uDisplace:   { value: 0.018 },
                uBlockSize:  { value: 0.022 },
                uActive:     { value: 0.0 },
                uResolution: { value: new THREE.Vector2(W, H) }
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
                    float spread = 0.008;
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
                uGlowStrength: { value: 0.35 }
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

            _datamoshMat.uniforms.tCurrent.value  = _rtCurrent.texture;
            _datamoshMat.uniforms.tTrail.value    = _trailRead.texture;
            _datamoshMat.uniforms.uTime.value     = time;
            _datamoshMat.uniforms.uActive.value   = _trailIntensity;
            _datamoshMat.uniforms.uDecay.value    = 0.72 + _trailIntensity * 0.22;
            _datamoshMat.uniforms.uDisplace.value = 0.004 + _trailIntensity * 0.018;

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

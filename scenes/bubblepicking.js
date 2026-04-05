// scenes/bubblepicking.js
// BubblePicking world — 4 themed rooms with walk character,
// ascending bubbles, floating images, and bubble-picking mechanics.
// Uses global THREE (r128 via CDN script tags).

import { deviceProfile } from '../core/deviceProfile.js';

// ─── Private state ───
let bpScene = null;
let bpCamera = null;

let ambientLight = null;
let dirLight = null;

let playerGroup = null;   // THREE.Group containing the GLB clone
let playerMixer = null;   // AnimationMixer for the walk character
let walkAction = null;    // AnimationAction
let orbitAngle = 0;
let velocity = 0;
const orbitRadius = 16;
let lastFacingRight = true; // track last facing direction

let currentRoomId = null;
let roomOverlayTimeout = null;

const simulations = [];

// Shader passes
let blurPass = null;
let pixelPass = null;
let hazePass = null;
let renderPass = null;

let _composer = null;
let _renderer = null;

// ─── Textures ───
let floorTex = null;
let wallTextures = {};  // { '1': tex, '2': tex, ... }

// ─── Wall meshes per room (for dynamic texture swap) ───
const roomWalls = {};   // { '1': [mesh, mesh], '2': ... }

// ─── State machine ───
const state = {
    currentRoom: null,
    bubbleAttached: false,
    bubbleHasImages: false,
    room2Entered: false,
    room3Entered: false,
    room4Entered: false
};

// ─── Room 2: Bubbles ───
let bubbles = [];
let attachedBubble = null;   // The bubble mesh stuck to the player

// ─── Room 3: Floating images + central bubble ───
let floatingImages = [];
let centralBubble = null;
let absorbedImages = [];     // Images inside the central bubble
let absorbing = false;
let absorbIndex = 0;
let absorbTimer = 0;

// ─── Room 4: Player bubble with images ───
let playerBubbleImages = [];  // Mini-planes orbiting inside the attached bubble

// ─── Room Data (ordered so ArrowRight = 1→2→3→4 clockwise) ───
const roomData = [
    { id: "1", name: "Sala 1 — Nebulosa", color: 0xffffff, emissive: 0xffffff, cx: -12.5, cz: -12.5, wallTex: 'Wall1.png' },
    { id: "2", name: "Sala 2 — Burbujas", color: 0xffffff, emissive: 0xffffff, cx: -12.5, cz: 12.5,  wallTex: 'Wall2.png' },
    { id: "3", name: "Sala 3 — Imágenes", color: 0xffffff, emissive: 0xffffff, cx: 12.5,  cz: 12.5,  wallTex: 'Wall3.png' },
    { id: "4", name: "Sala 4 — Fusión",   color: 0xffffff, emissive: 0xffffff, cx: 12.5,  cz: -12.5, wallTex: 'Wall4.png' }
];

// ═══════════════════════════════════════════════
// Shader Definitions (kept from carousel)
// ═══════════════════════════════════════════════

const BlurShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "amount": { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
        void main() {
            vec4 color = vec4(0.0); float offset = amount * 0.005;
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

const PixelateShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "pixelSize": { value: 0.0 },
        "resolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse; uniform float pixelSize; uniform vec2 resolution; varying vec2 vUv;
        void main() {
            if (pixelSize <= 0.0) { gl_FragColor = texture2D(tDiffuse, vUv); }
            else {
                vec2 curPixelSize = vec2(pixelSize) / resolution;
                vec2 uvPixelated = floor(vUv / curPixelSize) * curPixelSize;
                gl_FragColor = texture2D(tDiffuse, uvPixelated);
            }
        }
    `
};

const HazeShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "time": { value: 0.0 },
        "intensity": { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse; uniform float time; uniform float intensity; varying vec2 vUv;
        void main() {
            if (intensity <= 0.0) { gl_FragColor = texture2D(tDiffuse, vUv); }
            else {
                vec2 distortedUv = vUv;
                distortedUv.x += sin(vUv.y * 10.0 + time * 2.5) * 0.0025 * intensity;
                distortedUv.y += cos(vUv.x * 10.0 + time * 2.0) * 0.0025 * intensity;
                vec4 color = texture2D(tDiffuse, distortedUv);
                gl_FragColor = color;
            }
        }
    `
};

// ═══════════════════════════════════════════════
// Room Construction
// ═══════════════════════════════════════════════

function buildRooms(scene) {
    const texLoader = new THREE.TextureLoader();

    // ── Floor ──
    floorTex = texLoader.load('assets/CarouselFloor.png');
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 4);

    const floorMat = new THREE.MeshStandardMaterial({
        map: floorTex, roughness: 0.8, metalness: 0.2
    });
    // Circular floor — radius = diagonal/2 so the edge touches the wall corners
    const floorRadius = Math.sqrt(25 * 25 + 25 * 25); // ~35.36
    const floor = new THREE.Mesh(new THREE.CircleGeometry(floorRadius, 64), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // ── Walls per room ──
    roomData.forEach(room => {
        // Load this room's wall texture (stretched, no tiling)
        const wTex = texLoader.load('assets/' + room.wallTex);
        wTex.wrapS = THREE.ClampToEdgeWrapping;
        wTex.wrapT = THREE.ClampToEdgeWrapping;
        wallTextures[room.id] = wTex;

        const pLight = new THREE.PointLight(room.emissive, 2.5, 40);
        pLight.position.set(room.cx, 5, room.cz);
        scene.add(pLight);

        // Inner wall material — with texture, stretched to fit, no color tint
        const innerWallMat = new THREE.MeshStandardMaterial({
            map: wTex,
            color: 0xffffff,
            emissive: 0x000000, emissiveIntensity: 0.0,
            transparent: true, opacity: 0.85, side: THREE.DoubleSide
        });

        // Outer wall material — plain, no texture
        const outerWallMat = new THREE.MeshStandardMaterial({
            color: 0x111118,
            emissive: room.emissive, emissiveIntensity: 0.03,
            transparent: true, opacity: 0.15, side: THREE.DoubleSide
        });

        const wT = 0.5, wH = 10, rs = 24.5; // slightly smaller to add gap between walls
        roomWalls[room.id] = [];

        const addWall = (w, h, d, px, pz, mat) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat.clone());
            wall.position.set(px, h / 2, pz);
            wall.receiveShadow = true;
            wall.castShadow = true;
            scene.add(wall);
            roomWalls[room.id].push(wall);
        };

        // Determine which walls are inner (near center 0) vs outer (at scene edge ±25)
        const zNear = room.cz - rs / 2; // e.g. -25 or 0
        const zFar  = room.cz + rs / 2; // e.g. 0 or 25
        const xNear = room.cx - rs / 2;
        const xFar  = room.cx + rs / 2;

        // Z-walls (horizontal, span along X)
        addWall(rs, wH, wT, room.cx, zNear, Math.abs(zNear) > 12 ? outerWallMat : innerWallMat);
        addWall(rs, wH, wT, room.cx, zFar,  Math.abs(zFar)  > 12 ? outerWallMat : innerWallMat);
        // X-walls (vertical, span along Z)
        addWall(wT, wH, rs, xNear, room.cz, Math.abs(xNear) > 12 ? outerWallMat : innerWallMat);
        addWall(wT, wH, rs, xFar,  room.cz, Math.abs(xFar)  > 12 ? outerWallMat : innerWallMat);
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

// ═══════════════════════════════════════════════
// Room Simulations
// ═══════════════════════════════════════════════

// ─── Room 1: Nebulosa displacement particles ───
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
        size: 0.15, color: 0xcccccc, transparent: true,
        opacity: 0.5, blending: THREE.AdditiveBlending
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

// ─── Room 2: Ascending bubbles ───
function initRoom2(scene) {
    const pRoom = roomData.find(r => r.id === "2");
    bubbles = [];

    for (let i = 0; i < 20; i++) {
        const r = 0.17 + Math.random() * 0.40;  // 15% bigger than previous 0.15-0.5
        const geo = new THREE.SphereGeometry(r, 16, 16);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.1,
            transparent: true,
            opacity: 0.3 + Math.random() * 0.2,
            roughness: 0.1,
            metalness: 0.1
        });
        const mesh = new THREE.Mesh(geo, mat);

        mesh.position.set(
            pRoom.cx + (Math.random() - 0.5) * 18,
            Math.random() * 10,
            pRoom.cz + (Math.random() - 0.5) * 18
        );

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
            // Gentle horizontal wobble
            b.position.x = b.userData.baseX + Math.sin(time * 2 + b.userData.speed * 10) * 0.3;

            if (b.position.y > 10) {
                b.position.y = 0.2;
            }
        });
    });
}

// ─── Room 3: Floating images + central bubble ───
function initRoom3(scene) {
    const pRoom = roomData.find(r => r.id === "3");
    floatingImages = [];
    absorbedImages = [];
    absorbing = false;
    absorbIndex = 0;
    absorbTimer = 0;

    const texLoader = new THREE.TextureLoader();
    const imgTex = texLoader.load('assets/CarouselFloor.png');

    // 15 small floating planes
    for (let i = 0; i < 15; i++) {
        const geo = new THREE.PlaneGeometry(0.15, 0.15);
        const mat = new THREE.MeshBasicMaterial({
            map: imgTex, transparent: true, opacity: 0.9, side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);

        mesh.position.set(
            pRoom.cx + (Math.random() - 0.5) * 16,
            1 + Math.random() * 6,
            pRoom.cz + (Math.random() - 0.5) * 16
        );
        mesh.userData.homePos = mesh.position.clone();
        mesh.userData.phase = Math.random() * Math.PI * 2;
        mesh.userData.absorbed = false;

        scene.add(mesh);
        floatingImages.push(mesh);
    }

    // Central bubble (5x larger: radius 4.0)
    const bubbleGeo = new THREE.SphereGeometry(4.0, 32, 32);
    const bubbleMat = new THREE.MeshStandardMaterial({
        color: 0xaaddff,
        emissive: 0x224466,
        emissiveIntensity: 0.2,
        transparent: true,
        opacity: 0.25,
        roughness: 0.05,
        metalness: 0.4
    });
    centralBubble = new THREE.Mesh(bubbleGeo, bubbleMat);
    centralBubble.position.set(pRoom.cx, 4, pRoom.cz);
    scene.add(centralBubble);

    simulations.push((time) => {
        // Float unabsorbed images
        floatingImages.forEach(img => {
            if (img.userData.absorbed) return;

            const h = img.userData.homePos;
            img.position.x = h.x + Math.sin(time * 0.8 + img.userData.phase) * 0.5;
            img.position.y = h.y + Math.cos(time * 1.2 + img.userData.phase) * 0.3;
            img.position.z = h.z + Math.sin(time * 0.6 + img.userData.phase + 1) * 0.4;
            img.rotation.y = time * 0.5 + img.userData.phase;
        });

        // Absorb animation
        if (absorbing && absorbIndex < floatingImages.length) {
            absorbTimer += 0.016;
            if (absorbTimer > 0.3) { // one every 0.3s
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

        // Images absorbed orbit inside the central bubble
        absorbedImages.forEach((img, i) => {
            const orbitR = 3.0; // orbit inside the larger bubble
            const phase = img.userData.orbitPhase || 0;
            const targetX = centralBubble.position.x + Math.cos(time * 0.8 + phase) * orbitR;
            const targetY = centralBubble.position.y + Math.sin(time * 1.1 + phase) * orbitR * 0.6;
            const targetZ = centralBubble.position.z + Math.sin(time * 0.9 + phase + 1) * orbitR;

            // Smooth lerp towards target
            img.position.x += (targetX - img.position.x) * 0.05;
            img.position.y += (targetY - img.position.y) * 0.05;
            img.position.z += (targetZ - img.position.z) * 0.05;
            img.rotation.y = time + phase;
        });

        // Central bubble gentle pulse
        const scale = 1 + Math.sin(time * 2) * 0.05;
        centralBubble.scale.set(scale, scale, scale);
    });
}

// ─── Room 4: Character webp plane + bubble effects ───
function initRoom4(scene) {
    const pRoom = roomData.find(r => r.id === "4");

    // Load character webp as a texture on a standing plane
    const texLoader = new THREE.TextureLoader();
    texLoader.load('assets/chars/8.webp', (charTex) => {
        const planeH = 8;  // similar height to the player character
        const planeW = planeH * (charTex.image.width / charTex.image.height || 0.6);
        const geo = new THREE.PlaneGeometry(planeW, planeH);
        const mat = new THREE.MeshBasicMaterial({
            map: charTex, transparent: true, side: THREE.DoubleSide
        });
        const charPlane = new THREE.Mesh(geo, mat);
        charPlane.position.set(pRoom.cx - 5, planeH / 2, pRoom.cz);
        scene.add(charPlane);
    });
}

// ═══════════════════════════════════════════════
// Player Character (walk.glb)
// ═══════════════════════════════════════════════

function createPlayer(scene) {
    playerGroup = new THREE.Group();
    playerGroup.position.set(orbitRadius, 0, 0);
    scene.add(playerGroup);

    const loader = new THREE.GLTFLoader();
    loader.load('assets/walk.glb', (gltf) => {
        let clone;
        if (THREE.SkeletonUtils && THREE.SkeletonUtils.clone) {
            clone = THREE.SkeletonUtils.clone(gltf.scene);
        } else {
            clone = gltf.scene.clone();
        }

        clone.scale.set(4.25, 4.25, 4.25); // 5 * 0.85 = 4.25 (15% smaller than previous 5)
        clone.position.set(0, 0, 0);

        // Apply materials
        clone.traverse(child => {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                    color: 0x7d85b4,
                    emissive: 0x2a2d4a,
                    roughness: 0.8,
                    metalness: 0.2,
                    skinning: true
                });
                child.castShadow = true;
            }
        });

        playerGroup.add(clone);

        // Animation
        if (gltf.animations && gltf.animations.length > 0) {
            playerMixer = new THREE.AnimationMixer(clone);
            walkAction = playerMixer.clipAction(gltf.animations[0]);
            walkAction.play();
            walkAction.paused = true; // Start idle
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
    // Quadrant detection matching new roomData positions
    if (px < 0 && pz < 0)  detectedId = "1";  // Sala 1: (-12.5, -12.5)
    else if (px < 0 && pz >= 0) detectedId = "2";  // Sala 2: (-12.5, 12.5)
    else if (px >= 0 && pz >= 0) detectedId = "3"; // Sala 3: (12.5, 12.5)
    else if (px >= 0 && pz < 0) detectedId = "4";  // Sala 4: (12.5, -12.5)

    if (detectedId && detectedId !== currentRoomId) {
        currentRoomId = detectedId;
        state.currentRoom = detectedId;

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

        // ── State triggers on room entry ──
        if (detectedId === "2" && !state.room2Entered) {
            state.room2Entered = true;
            // Attach nearest bubble to player
            attachNearestBubble();
        }

        if (detectedId === "3" && !state.room3Entered) {
            state.room3Entered = true;
            absorbing = true; // Start absorb animation
        }

        if (detectedId === "4" && !state.room4Entered) {
            state.room4Entered = true;
            state.bubbleHasImages = true;
            fillPlayerBubbleWithImages();
        }
    }
}

// ═══════════════════════════════════════════════
// Bubble Mechanics
// ═══════════════════════════════════════════════

function attachNearestBubble() {
    if (!playerGroup || bubbles.length === 0) return;

    let closest = null;
    let minDist = Infinity;

    bubbles.forEach(b => {
        if (b.userData.attached) return;
        const d = playerGroup.position.distanceTo(b.position);
        if (d < minDist) { minDist = d; closest = b; }
    });

    if (closest) {
        closest.userData.attached = true;
        state.bubbleAttached = true;
        attachedBubble = closest;

        // Reparent to playerGroup
        const worldPos = new THREE.Vector3();
        closest.getWorldPosition(worldPos);
        bpScene.remove(closest);
        closest.position.set(0, 2.8, 0.1); // Chest height offset
        playerGroup.add(closest);

        // Make it a bit bigger so it's visible
        closest.scale.set(3, 3, 3);
        closest.material.opacity = 0.35;
    }
}

function fillPlayerBubbleWithImages() {
    if (!attachedBubble) return;

    const texLoader = new THREE.TextureLoader();
    const imgTex = texLoader.load('assets/CarouselFloor.png');

    // Create small planes orbiting inside the attached bubble
    for (let i = 0; i < 8; i++) {
        const geo = new THREE.PlaneGeometry(0.04, 0.04);
        const mat = new THREE.MeshBasicMaterial({
            map: imgTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide
        });
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

        // Reset state
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

        // Scene
        bpScene = new THREE.Scene();
        bpScene.background = new THREE.Color(0x050510);
        bpScene.fog = new THREE.FogExp2(0x050510, 0.015);
        this.scene = bpScene;

        // Camera
        bpCamera = new THREE.PerspectiveCamera(
            75, window.innerWidth / window.innerHeight, 0.1, 1000
        );
        this.camera = bpCamera;

        // Lighting
        ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        bpScene.add(ambientLight);

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
        bpScene.add(dirLight);

        // Build rooms and simulations
        buildRooms(bpScene);
        simulations.length = 0;
        initRoom1(bpScene);
        initRoom2(bpScene);
        initRoom3(bpScene);
        initRoom4(bpScene);

        // Player
        createPlayer(bpScene);

        // Post-processing
        if (composer) {
            renderPass = new THREE.RenderPass(bpScene, bpCamera);
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

        // Reset navigation state — start at Sala 1 center angle
        // Sala 1 is at (-12.5, -12.5), angle from origin = atan2(-12.5, -12.5) = -3π/4
        orbitAngle = Math.atan2(-12.5, -12.5);
        velocity = 0;
        currentRoomId = null;
        lastFacingRight = true;
    },

    update(time, keys) {
        if (!bpScene || !bpCamera || !playerGroup) return;

        // ── Movement ──
        const isMoving = keys.left || keys.right;

        if (keys.left) velocity += 0.0003;    // 50% slower than previous 0.0006
        if (keys.right) velocity -= 0.0003;

        if (!isMoving) {
            velocity *= 0.95;
        }

        velocity = Math.max(-0.004, Math.min(0.004, velocity)); // 50% of previous 0.008
        orbitAngle += velocity;

        playerGroup.position.x = Math.cos(orbitAngle) * orbitRadius;
        playerGroup.position.z = Math.sin(orbitAngle) * orbitRadius;

        // Fixed rotation: only face left or right along the orbit tangent
        if (keys.left) {
            lastFacingRight = false;
        } else if (keys.right) {
            lastFacingRight = true;
        }
        // Tangent angle: perpendicular to the radius vector
        const tangentAngle = orbitAngle + Math.PI / 2;
        playerGroup.rotation.y = lastFacingRight ? tangentAngle + Math.PI : tangentAngle;

        // ── Walk animation control ──
        if (walkAction) {
            if (isMoving) {
                walkAction.paused = false;
            } else {
                walkAction.paused = true;
            }
        }

        if (playerMixer) {
            playerMixer.update(0.016);
        }

        // ── Camera ──
        const cameraDistance = 18;
        bpCamera.position.x = playerGroup.position.x + Math.cos(orbitAngle) * cameraDistance;
        bpCamera.position.z = playerGroup.position.z + Math.sin(orbitAngle) * cameraDistance;
        bpCamera.position.y = 6;

        bpCamera.lookAt(
            playerGroup.position.x,
            playerGroup.position.y + 1,
            playerGroup.position.z
        );
        dirLight.position.set(
            playerGroup.position.x + 5,
            playerGroup.position.y + 10,
            playerGroup.position.z + 5
        );

        // ── Post-processing distance blending ──
        if (_composer) {
            const px = playerGroup.position.x;
            const pz = playerGroup.position.z;

            // Room 1 blur (Nebulosa displacement)
            const distR1 = Math.sqrt(Math.pow(px - (-12.5), 2) + Math.pow(pz - (-12.5), 2));
            const weightR1 = Math.max(0, 1.0 - (distR1 / 20.0));
            blurPass.uniforms.amount.value = THREE.MathUtils.lerp(
                blurPass.uniforms.amount.value, weightR1 * 0.5, 0.05  // 80% less than previous 2.5
            );

            // Room 4 pixelate
            const distR4 = Math.sqrt(Math.pow(px - (-12.5), 2) + Math.pow(pz - 12.5, 2));
            const weightR4 = Math.max(0, 1.0 - (distR4 / 20.0));
            // Room 4: pixelate disabled
            pixelPass.uniforms.pixelSize.value = 0.0;

            // Room 3 haze
            const distR3 = Math.sqrt(Math.pow(px - 12.5, 2) + Math.pow(pz - 12.5, 2));
            const weightR3 = Math.max(0, 1.0 - (distR3 / 20.0));
            hazePass.uniforms.intensity.value = THREE.MathUtils.lerp(
                hazePass.uniforms.intensity.value, weightR3 * 1.25, 0.05
            );
            hazePass.uniforms.time.value = time;
        }

        // ── Player bubble images orbiting ──
        if (state.bubbleHasImages && playerBubbleImages.length > 0) {
            playerBubbleImages.forEach(p => {
                const phase = p.userData.orbitPhase || 0;
                const r = 0.25;
                p.position.set(
                    Math.cos(time * 1.2 + phase) * r,
                    Math.sin(time * 1.5 + phase) * r * 0.6,
                    Math.sin(time * 0.9 + phase + 1) * r
                );
                p.rotation.y = time + phase;
            });
        }

        // Room detection and simulations
        detectRoom();
        simulations.forEach(sim => sim(time));

        // Render
        if (_composer) {
            _composer.render();
        } else {
            _renderer.render(bpScene, bpCamera);
        }
    },

    getPixelPass() {
        return pixelPass;
    },

    dispose() {
        if (_composer) {
            if (renderPass) _composer.removePass(renderPass);
            if (blurPass) _composer.removePass(blurPass);
            if (pixelPass) _composer.removePass(pixelPass);
            if (hazePass) _composer.removePass(hazePass);
        }

        if (playerMixer) {
            playerMixer.stopAllAction();
            if (playerGroup) playerMixer.uncacheRoot(playerGroup);
        }

        if (bpScene) {
            bpScene.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            bpScene.clear();
            bpScene = null;
        }

        // Dispose textures
        if (floorTex) floorTex.dispose();
        Object.values(wallTextures).forEach(t => t.dispose());
        wallTextures = {};

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
        blurPass = null;
        pixelPass = null;
        hazePass = null;
        renderPass = null;
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

// --- Initialization ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);
scene.fog = new THREE.FogExp2(0x050510, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// --- Post-Processing Setup ---
const composer = new THREE.EffectComposer(renderer);
const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);

// 1. Blur Shader (Room 1)
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
        
        // Basic 9-tap gaussian blur
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
const blurPass = new THREE.ShaderPass(BlurShader);
blurPass.uniforms.amount.value = 0.0;
composer.addPass(blurPass);

// 2. Pixelate Shader (Room 4)
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
const pixelPass = new THREE.ShaderPass(PixelateShader);
pixelPass.uniforms.pixelSize.value = 0.0;
composer.addPass(pixelPass);

// 3. Heat Haze / Depth Simulation Shader (Room 3)
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
                // Heat tint logic
                color.r += 0.1 * intensity;
                color.b -= 0.1 * intensity;
                gl_FragColor = color;
            }
        }
    `
};
const hazePass = new THREE.ShaderPass(HazeShader);
hazePass.uniforms.intensity.value = 0.0;
composer.addPass(hazePass);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 50;
const d = 20;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

// --- Rooms Data ---
const roomData = [
    {
        id: "1", name: "Nebulosa Cósmica", color: 0x6a0dad, emissive: 0x9c27b0, cx: -12.5, cz: -12.5
    },
    {
        id: "2", name: "Océano Digital", color: 0x0077be, emissive: 0x00bcd4, cx: 12.5, cz: -12.5
    },
    {
        id: "4", name: "Bosque de Cristal", color: 0x00c853, emissive: 0x4caf50, cx: -12.5, cz: 12.5
    },
    {
        id: "3", name: "Volcán Eléctrico", color: 0xff5722, emissive: 0xff9800, cx: 12.5, cz: 12.5
    }
];

// --- Environment Construction ---
const buildRooms = () => {
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

        addWall(rs, wH, wT, room.cx, room.cz - rs / 2); // Top
        addWall(rs, wH, wT, room.cx, room.cz + rs / 2); // Bottom
        addWall(wT, wH, rs, room.cx - rs / 2, room.cz); // Left
        addWall(wT, wH, rs, room.cx + rs / 2, room.cz); // Right
    });

    // Cross Dividers to prevent Z-fighting at center
    const crossMat = new THREE.MeshStandardMaterial({ color: 0x222222, transparent: true, opacity: 0.3 });
    const wall1 = new THREE.Mesh(new THREE.BoxGeometry(50, 10, 0.5), crossMat);
    wall1.position.set(0, 5, 0);
    scene.add(wall1);
    const wall2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10, 50), crossMat);
    wall2.position.set(0, 5, 0);
    scene.add(wall2);
};
buildRooms();

// --- Room Simulations ---
const simulations = [];

const initRoom1 = () => {
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
};

const initRoom2 = () => {
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
};

const initRoom3 = () => {
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
        mesh.position.set(pRoom.cx + Math.cos(angle) * radius, 1 + Math.random() * 5, pRoom.cz + Math.sin(angle) * radius);
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
};

const initRoom4 = () => {
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
};

initRoom1();
initRoom2();
initRoom3();
initRoom4();

// --- Player Character ---
const playerGroup = new THREE.Group();
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


// --- Movement System ---
let orbitAngle = 0;
let velocity = 0;
const orbitRadius = 12.5;
let lastDir = 1;

const keys = { left: false, right: false };

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
});

// --- UI & Room Detection ---
let currentRoomId = null;
const roomNameDisplay = document.getElementById('room-name-display');
const currentRoomText = document.getElementById('current-room-name');
let roomOverlayTimeout = null;

const detectRoom = () => {
    const px = playerGroup.position.x;
    const pz = playerGroup.position.z;

    let detectedId = null;
    if (px >= 0 && pz >= 0) detectedId = "3"; // Volcán
    else if (px < 0 && pz >= 0) detectedId = "4"; // Bosque
    else if (px < 0 && pz < 0) detectedId = "1"; // Nebulosa
    else if (px >= 0 && pz < 0) detectedId = "2"; // Océano

    if (detectedId && detectedId !== currentRoomId) {
        currentRoomId = detectedId;
        const room = roomData.find(r => r.id === currentRoomId);

        currentRoomText.innerText = room.name;
        currentRoomText.style.color = '#' + room.emissive.toString(16).padStart(6, '0');

        roomNameDisplay.innerText = room.name;
        roomNameDisplay.style.color = '#' + room.emissive.toString(16).padStart(6, '0');
        roomNameDisplay.classList.add('visible');

        clearTimeout(roomOverlayTimeout);
        roomOverlayTimeout = setTimeout(() => {
            roomNameDisplay.classList.remove('visible');
        }, 2000);
    }
};

// --- Landing Scene Setup ---
const landingScene = new THREE.Scene();
landingScene.background = new THREE.Color(0x020205);
landingScene.fog = new THREE.FogExp2(0x020205, 0.02);

const landingCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
landingCamera.position.set(0, 5, 30);

const lLight1 = new THREE.PointLight(0x9c27b0, 2, 40); // Purple
const lLight2 = new THREE.PointLight(0x00bcd4, 2, 40); // Cyan
const lLight3 = new THREE.PointLight(0xff9800, 2, 40); // Orange
const lLight4 = new THREE.PointLight(0x4caf50, 2, 40); // Green
landingScene.add(lLight1, lLight2, lLight3, lLight4);
landingScene.add(new THREE.AmbientLight(0xffffff, 0.3));

const numObjects = 2000;
const dummy = new THREE.Object3D();

const geoSphere = new THREE.SphereGeometry(1.5, 32, 32);
const matSphere = new THREE.MeshStandardMaterial({ color: 0x0077be, metalness: 0.8, roughness: 0.2 });
const meshSpheres = new THREE.InstancedMesh(geoSphere, matSphere, Math.floor(numObjects / 4));

const geoOcta = new THREE.OctahedronGeometry(1.8);
const matOcta = new THREE.MeshStandardMaterial({ color: 0x00c853, transparent: true, opacity: 0.8 });
const meshOctas = new THREE.InstancedMesh(geoOcta, matOcta, Math.floor(numObjects / 4));

const geoTorus = new THREE.TorusGeometry(1.5, 0.5, 16, 32);
const matTorus = new THREE.MeshStandardMaterial({ color: 0xff5722, metalness: 1.0, roughness: 0.1 });
const meshToruses = new THREE.InstancedMesh(geoTorus, matTorus, Math.floor(numObjects / 4));

const geoParticle = new THREE.DodecahedronGeometry(1.2);
const matParticle = new THREE.MeshStandardMaterial({ color: 0x9c27b0, emissive: 0x6a0dad, emissiveIntensity: 0.5 });
const meshParticles = new THREE.InstancedMesh(geoParticle, matParticle, Math.floor(numObjects / 4));

const instancedData = [];

const setupGridInstancedMesh = (mesh, count, typeOffset) => {
    // Distribute objects across a massive grid layout
    const gridDimension = Math.ceil(Math.sqrt(count));
    const spacing = 15;

    // Offset the start position so the grid is centered around the origin
    const startX = -((gridDimension * spacing) / 2);
    const startZ = -((gridDimension * spacing) / 2);

    for (let i = 0; i < count; i++) {
        const row = Math.floor(i / gridDimension);
        const col = i % gridDimension;

        let x = startX + (col * spacing);
        let z = startZ + (row * spacing);
        let y = (Math.random() - 0.5) * 5; // Slight height variation

        switch (typeOffset) {
            case 0: x -= spacing / 4; z -= spacing / 4; break;
            case 1: x += spacing / 4; z -= spacing / 4; break;
            case 2: x -= spacing / 4; z += spacing / 4; break;
            case 3: x += spacing / 4; z += spacing / 4; break;
        }

        const rx = 0;
        const ry = 0;
        const scale = 1.0;

        dummy.position.set(x, y, z);
        dummy.rotation.set(rx, ry, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        instancedData.push({
            mesh, index: i, x, y, z, rx, ry, scale
        });
    }
    landingScene.add(mesh);
};

setupGridInstancedMesh(meshSpheres, Math.floor(numObjects / 4), 0);
setupGridInstancedMesh(meshOctas, Math.floor(numObjects / 4), 1);
setupGridInstancedMesh(meshToruses, Math.floor(numObjects / 4), 2);
setupGridInstancedMesh(meshParticles, Math.floor(numObjects / 4), 3);


// --- Transition Logic ---
let isLandingPage = true;

document.getElementById('enter-button').addEventListener('click', () => {
    gsap.to('#landing-ui', { opacity: 0, duration: 0.5 });

    gsap.to(renderer.domElement, {
        opacity: 0,
        duration: 0.8,
        delay: 0.3,
        onComplete: () => {
            document.getElementById('landing-container').style.display = 'none';
            document.getElementById('carousel-container').style.display = 'block';

            // Target the Carousel CSS constraints
            const carouselContainer = document.getElementById('carousel-container');
            carouselContainer.insertBefore(renderer.domElement, carouselContainer.firstChild);

            // Strip lingering full-screen inline widths from initial renderer setup
            renderer.domElement.style.position = 'absolute';
            renderer.domElement.style.left = '0';
            renderer.domElement.style.top = '0';
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';

            isLandingPage = false;

            // Reset keys immediately upon entering
            keys.up = false;
            keys.down = false;
            keys.left = false;
            keys.right = false;

            // Buffer sync to localized DOM box bounds
            const w = carouselContainer.clientWidth;
            const h = carouselContainer.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h, false);
            composer.setSize(w, h);

            gsap.to(renderer.domElement, { opacity: 1, duration: 1.0 });
            gsap.to('#carousel-container', { opacity: 1, duration: 1.0 });
        }
    });

    gsap.to('#landing-container', { opacity: 0, duration: 0.8, delay: 0.3 });
});

// Expanded Keys for Landing Grid traversing
// Make sure window listeners update these as well
keys.up = false;
keys.down = false;

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'ArrowUp') keys.up = true;
    if (e.key === 'ArrowDown') keys.down = true;
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'ArrowUp') keys.up = false;
    if (e.key === 'ArrowDown') keys.down = false;
});


// --- Animation Loop ---
const clock = new THREE.Clock();

let landingCamPx = 0;
let landingCamPz = 0;

const animate = () => {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();

    if (isLandingPage) {
        // Camera Navigation over the Grid
        const moveSpeed = 1.2;
        if (keys.up) landingCamPz -= moveSpeed;
        if (keys.down) landingCamPz += moveSpeed;
        if (keys.left) landingCamPx -= moveSpeed;
        if (keys.right) landingCamPx += moveSpeed;

        // Smooth camera follow
        landingCamera.position.x += (landingCamPx - landingCamera.position.x) * 0.1;
        landingCamera.position.z += (landingCamPz + 30 - landingCamera.position.z) * 0.1;

        // Gentle global sway
        landingCamera.position.y = 15 + Math.sin(time * 0.5) * 2;

        // Look ahead
        landingCamera.lookAt(landingCamera.position.x, 0, landingCamera.position.z - 30);

        // Float Lights
        lLight1.position.set(landingCamera.position.x + Math.sin(time) * 40, 20, landingCamera.position.z + Math.cos(time) * 40);
        lLight2.position.set(landingCamera.position.x + Math.cos(time * 1.2) * 40, 20, landingCamera.position.z + Math.sin(time * 1.2) * 40);
        lLight3.position.set(landingCamera.position.x - Math.sin(time * 0.8) * 40, 20, landingCamera.position.z - Math.cos(time * 0.8) * 40);
        lLight4.position.set(landingCamera.position.x - Math.cos(time * 1.1) * 40, 20, landingCamera.position.z - Math.sin(time * 1.1) * 40);

        // Animate Instanced Meshes (Gently turning)
        instancedData.forEach(data => {
            dummy.position.set(data.x, data.y + Math.sin(time * 2 + data.x) * 1.5, data.z);
            dummy.rotation.set(0, time * 0.5 + data.index, 0); // unified rotation
            dummy.scale.set(data.scale, data.scale, data.scale);
            dummy.updateMatrix();
            data.mesh.setMatrixAt(data.index, dummy.matrix);
        });

        meshSpheres.instanceMatrix.needsUpdate = true;
        meshOctas.instanceMatrix.needsUpdate = true;
        meshToruses.instanceMatrix.needsUpdate = true;
        meshParticles.instanceMatrix.needsUpdate = true;

        renderer.render(landingScene, landingCamera);

        renderer.render(landingScene, landingCamera);

    } else {
        // Carousel Rendering Logic
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

        const cameraDistance = 18;
        camera.position.x = playerGroup.position.x + Math.cos(orbitAngle) * cameraDistance;
        camera.position.z = playerGroup.position.z + Math.sin(orbitAngle) * cameraDistance;
        camera.position.y = 6;

        camera.lookAt(playerGroup.position.x, playerGroup.position.y + 1, playerGroup.position.z);
        dirLight.position.set(playerGroup.position.x + 5, playerGroup.position.y + 10, playerGroup.position.z + 5);

        const px = playerGroup.position.x;
        const pz = playerGroup.position.z;

        const distR1 = Math.sqrt(Math.pow(px - (-12.5), 2) + Math.pow(pz - (-12.5), 2));
        const weightR1 = Math.max(0, 1.0 - (distR1 / 20.0));
        blurPass.uniforms.amount.value = THREE.MathUtils.lerp(blurPass.uniforms.amount.value, weightR1 * 5.0, 0.05);

        const distR4 = Math.sqrt(Math.pow(px - (-12.5), 2) + Math.pow(pz - 12.5, 2));
        const weightR4 = Math.max(0, 1.0 - (distR4 / 20.0));
        pixelPass.uniforms.pixelSize.value = THREE.MathUtils.lerp(pixelPass.uniforms.pixelSize.value, weightR4 * 16.0, 0.05);

        const distR3 = Math.sqrt(Math.pow(px - 12.5, 2) + Math.pow(pz - 12.5, 2));
        const weightR3 = Math.max(0, 1.0 - (distR3 / 20.0));
        hazePass.uniforms.intensity.value = THREE.MathUtils.lerp(hazePass.uniforms.intensity.value, weightR3 * 2.5, 0.05);
        hazePass.uniforms.time.value = time;

        detectRoom();
        simulations.forEach(sim => sim(time));

        composer.render();
    }
};

// Window resize
// Window resize
window.addEventListener('resize', () => {
    if (isLandingPage) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h);
        landingCamera.aspect = w / h;
        landingCamera.updateProjectionMatrix();
    } else {
        const carouselContainer = document.getElementById('carousel-container');
        const w = carouselContainer.clientWidth;
        const h = carouselContainer.clientHeight;

        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        composer.setSize(w, h);
        pixelPass.uniforms.resolution.value.set(w, h);
    }
});

animate();

// worlds/world-07-godrays.js
// Custom volumetric God Rays shader and WebGL morph targets.
// 100% compatible with Three.js r128.

const _screenPos = new THREE.Vector3();

// ── God Rays Shader (Volumetric Light / Radial Blur) ──
const GodRaysShader = {
    defines: {
        SAMPLES: 60
    },
    uniforms: {
        tDiffuse: { value: null },
        lightPositionOnScreen: { value: new THREE.Vector2(0.5, 0.5) },
        exposure: { value: 0.3 },
        decay: { value: 0.96 },
        density: { value: 0.8 },
        weight: { value: 0.4 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform vec2 lightPositionOnScreen;
        uniform float exposure;
        uniform float decay;
        uniform float density;
        uniform float weight;

        void main() {
            vec2 texCoord = vUv;
            vec2 deltaTextCoord = texCoord - lightPositionOnScreen;
            deltaTextCoord *= 1.0 / float(SAMPLES) * density;
            
            float illuminationDecay = 1.0;
            vec4 color = vec4(0.0);
            
            for(int i = 0; i < SAMPLES; i++) {
                texCoord -= deltaTextCoord;
                vec4 texSample = texture2D(tDiffuse, texCoord);
                texSample *= illuminationDecay * weight;
                color += texSample;
                illuminationDecay *= decay;
            }
            
            gl_FragColor = texture2D(tDiffuse, vUv) + color * exposure;
        }
    `
};

export default {
    scene: null,
    camera: null,
    renderer: null,
    _localComposer: null,
    _godRaysPass: null,
    _renderPass: null,
    _sunMesh: null,
    _sunLight: null,
    _objects: [],

    init(renderer, composer) {
        this.renderer = renderer;

        // ── Scene ──
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.FogExp2(0x000000, 0.008);

        const ambient = new THREE.AmbientLight(0x111111);
        this.scene.add(ambient);

        // ── Camera ──
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 3, 25);
        this.camera.lookAt(0, 0, 0);

        // ── Local Composer (for God Rays) ──
        this._localComposer = new THREE.EffectComposer(renderer);
        this._renderPass = new THREE.RenderPass(this.scene, this.camera);
        this._localComposer.addPass(this._renderPass);

        this._godRaysPass = new THREE.ShaderPass(GodRaysShader);

        // Adjust samples for mobile performance
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            this._godRaysPass.material.defines.SAMPLES = 30;
            this._godRaysPass.material.needsUpdate = true;
            this._godRaysPass.uniforms.density.value = 0.5;
        }

        this._localComposer.addPass(this._godRaysPass);

        // ── Sun (Light Source) ──
        const sunGeo = new THREE.SphereGeometry(1.5, 32, 32);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this._sunMesh = new THREE.Mesh(sunGeo, sunMat);
        this.scene.add(this._sunMesh);

        this._sunLight = new THREE.PointLight(0xffffff, 3, 50);
        this.scene.add(this._sunLight);

        // ── Morph Target Geometry ──
        // Base geometry: Icosahedron (subdivided to look like a sphere)
        const baseGeo = new THREE.IcosahedronGeometry(1.5, 8); // High vertex count for smooth morphs
        const posArr = baseGeo.attributes.position.array;

        const cubeArr = new Float32Array(posArr.length);
        const starArr = new Float32Array(posArr.length);

        const v = new THREE.Vector3();
        for (let i = 0; i < posArr.length; i += 3) {
            v.set(posArr[i], posArr[i + 1], posArr[i + 2]);

            // Map to Cube
            const maxCoord = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
            cubeArr[i] = v.x / maxCoord * 1.5; // Scale to match radius
            cubeArr[i + 1] = v.y / maxCoord * 1.5;
            cubeArr[i + 2] = v.z / maxCoord * 1.5;

            // Map to Spiky/Star
            const noise = Math.sin(v.x * 12) * Math.cos(v.y * 12) * Math.sin(v.z * 12);
            const r = 1.0 + (noise * 0.8);
            starArr[i] = v.x * r;
            starArr[i + 1] = v.y * r;
            starArr[i + 2] = v.z * r;
        }

        baseGeo.morphAttributes.position = [
            new THREE.BufferAttribute(cubeArr, 3),
            new THREE.BufferAttribute(starArr, 3)
        ];

        // ── Morph Objects Distribution ──
        this._objects = [];
        const colors = [0xff0044, 0x00ffaa, 0x4444ff, 0xffcc00];

        for (let i = 0; i < 20; i++) {
            const mat = new THREE.MeshStandardMaterial({
                color: colors[i % colors.length],
                emissive: colors[i % colors.length],
                emissiveIntensity: 0.3,
                metalness: 0.6,
                roughness: 0.2,
                morphTargets: true
            });

            const mesh = new THREE.Mesh(baseGeo, mat);

            // Position in a sphere around the sun
            const phi = Math.acos(-1 + (2 * i) / 20);
            const theta = Math.sqrt(20 * Math.PI) * phi;
            const radius = 8 + Math.random() * 2;

            mesh.position.x = radius * Math.cos(theta) * Math.sin(phi);
            mesh.position.y = radius * Math.sin(theta) * Math.sin(phi);
            mesh.position.z = radius * Math.cos(phi);

            // User data for animation
            mesh.userData = {
                offset: Math.random() * Math.PI * 2,
                rotSpeed: {
                    x: (Math.random() - 0.5) * 0.02,
                    y: (Math.random() - 0.5) * 0.02,
                    z: (Math.random() - 0.5) * 0.02
                }
            };

            mesh.morphTargetInfluences = [0, 0];

            this.scene.add(mesh);
            this._objects.push(mesh);
        }
    },

    update(time) {
        if (!this.scene || !this.camera || !this._localComposer) return;

        // ── Camera orbit ──
        this.camera.position.x = Math.sin(time * 0.08) * 25;
        this.camera.position.z = Math.cos(time * 0.08) * 25;
        this.camera.position.y = 3 + Math.sin(time * 0.05) * 5;
        this.camera.lookAt(0, 0, 0);

        // ── God Rays Light Position Calculation ──
        // Project 3D sun position to 2D screen space coordinates
        _screenPos.setFromMatrixPosition(this._sunMesh.matrixWorld);
        _screenPos.project(this.camera);

        // Map from [-1, 1] to [0, 1]
        this._godRaysPass.uniforms.lightPositionOnScreen.value.set(
            (_screenPos.x + 1) / 2,
            (_screenPos.y + 1) / 2
        );

        // ── Morph Targets & Object Rotation ──
        for (const obj of this._objects) {
            obj.rotation.x += obj.userData.rotSpeed.x;
            obj.rotation.y += obj.userData.rotSpeed.y;
            obj.rotation.z += obj.userData.rotSpeed.z;

            // Cyclic morphing: Sphere (0,0) -> Cube (1,0) -> Star (0,1) -> Sphere
            const t = (time * 0.3 + obj.userData.offset) % 1.0;

            if (t < 0.33) {
                // Sphere to Cube
                const phase = t / 0.33;
                obj.morphTargetInfluences[0] = phase;
                obj.morphTargetInfluences[1] = 0;
            } else if (t < 0.66) {
                // Cube to Star
                const phase = (t - 0.33) / 0.33;
                obj.morphTargetInfluences[0] = 1.0 - phase;
                obj.morphTargetInfluences[1] = phase;
            } else {
                // Star to Sphere
                const phase = (t - 0.66) / 0.34;
                obj.morphTargetInfluences[0] = 0;
                obj.morphTargetInfluences[1] = 1.0 - phase;
            }
        }

        // Render with local composer
        this._localComposer.render();
    },

    dispose() {
        // Dispose post-processing
        if (this._localComposer) {
            this._localComposer.passes.forEach(p => {
                if (p.dispose) p.dispose();
            });
            this._localComposer = null;
        }
        this._godRaysPass = null;
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
        this._sunMesh = null;
        this._sunLight = null;
        this._objects = [];
    }
};

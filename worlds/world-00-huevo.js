// worlds/world-00-huevo.js
// Custom volumetric God Rays shader and WebGL morph targets replaced by a GLB.
// 100% compatible with Three.js r128.

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
    _huevoMesh: null,
    _sunLight: null,
    _video: null,
    _videoTex: null,
    _orbitControls: null,

    init(renderer, composer) {
        this.renderer = renderer;

        // ── Scene ──
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        this.scene.fog = new THREE.FogExp2(0x000000, 0.015);

        const ambient = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambient);

        // ── Camera ──
        const W = window.innerWidth;
        const H = window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100);
        this.camera.position.set(0, 0, 5); // Centered, looking at origin

        // ── Controls ──
        this._orbitControls = new THREE.OrbitControls(this.camera, renderer.domElement);
        this._orbitControls.enableDamping = true;
        this._orbitControls.dampingFactor = 0.05;
        this._orbitControls.enablePan = false;
        this._orbitControls.minDistance = 2;
        this._orbitControls.maxDistance = 15;
        this._orbitControls.target.set(0, 0, 0);

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
        } else {
            this._godRaysPass.uniforms.density.value = 0.8;
            this._godRaysPass.uniforms.weight.value = 0.5;
            this._godRaysPass.uniforms.decay.value = 0.95;
            this._godRaysPass.uniforms.exposure.value = 0.4;
        }

        this._localComposer.addPass(this._godRaysPass);

        // ── Video Texture ──
        this._video = document.createElement('video');
        this._video.src = 'assets/videos/Seq01.mp4';
        this._video.crossOrigin = 'anonymous';
        this._video.loop = true;
        this._video.muted = true; // Necessario para autoplay sin interacción
        this._video.playsInline = true;
        this._video.play().catch(e => console.warn("Autoplay prevent detectado:", e));

        this._videoTex = new THREE.VideoTexture(this._video);
        this._videoTex.minFilter = THREE.LinearFilter;
        this._videoTex.magFilter = THREE.LinearFilter;
        this._videoTex.format = THREE.RGBAFormat;

        // ── Light Source for God Rays (Hidden sun behind egg) ──
        // We place it exactly AT the origin so the rays emanate FROM the egg
        const sunGeo = new THREE.SphereGeometry(0.5, 32, 32);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this._sunMesh = new THREE.Mesh(sunGeo, sunMat);
        this._sunMesh.position.set(0, 0, 0); 
        this._sunMesh.visible = false; // Hidden, only its coordinate is used for rays projection
        this.scene.add(this._sunMesh);

        this._sunLight = new THREE.PointLight(0xffeebb, 2, 50);
        this._sunLight.position.set(0, 0, 0);
        this.scene.add(this._sunLight);

        // ── Load GLB ──
        const loader = new THREE.GLTFLoader();
        loader.load('assets/huevo.glb', (gltf) => {
            this._huevoMesh = gltf.scene;

            // Optional: apply video texture globally or to a specific material name
            this._huevoMesh.traverse((child) => {
                if (child.isMesh) {
                    // Try to preserve original material props but map video
                    child.material = new THREE.MeshStandardMaterial({
                        map: this._videoTex,
                        emissiveMap: this._videoTex,
                        emissive: new THREE.Color(0x333333),
                        roughness: 0.3,
                        metalness: 0.1
                    });
                }
            });

            // Center the model properly
            const box = new THREE.Box3().setFromObject(this._huevoMesh);
            const center = new THREE.Vector3();
            box.getCenter(center);
            this._huevoMesh.position.sub(center);

            this.scene.add(this._huevoMesh);
            this._sunMesh.position.copy(center); // Or origin if egg is centered
        }, undefined, (e) => console.error("Error loading huevo.glb", e));
    },

    update(time, keys) {
        if (!this.scene || !this.camera || !this._localComposer) return;

        if (this._orbitControls) {
            this._orbitControls.update();
        }

        // Slight hovering motion for the egg
        if (this._huevoMesh) {
            this._huevoMesh.position.y = Math.sin(time * 1.5) * 0.1;
            // The sun center origin point for the God Rays moves with the egg
            this._sunMesh.position.y = this._huevoMesh.position.y;
        }

        // ── God Rays Light Position Calculation ──
        // Project 3D sun position to 2D screen space coordinates
        const screenPos = new THREE.Vector3();
        screenPos.setFromMatrixPosition(this._sunMesh.matrixWorld);
        screenPos.project(this.camera);

        // Map from [-1, 1] to [0, 1]
        this._godRaysPass.uniforms.lightPositionOnScreen.value.set(
            (screenPos.x + 1) / 2,
            (screenPos.y + 1) / 2
        );

        // Render with local composer manually
        this._localComposer.render();
    },

    dispose() {
        if (this._orbitControls) {
            this._orbitControls.dispose();
        }
        if (this._localComposer) {
            this._localComposer.passes.forEach(p => {
                if (p.dispose) p.dispose();
            });
            this._localComposer = null;
        }
        this._godRaysPass = null;
        this._renderPass = null;

        if (this._video) {
            this._video.pause();
            this._video.removeAttribute('src');
            this._video.load();
        }
        if (this._videoTex) {
            this._videoTex.dispose();
        }

        if (this.scene) {
            this.scene.clear();
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this._sunMesh = null;
        this._sunLight = null;
        this._huevoMesh = null;
    }
};

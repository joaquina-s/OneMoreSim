// worlds/world06.js  —  CHASE  (Nighttime Beach)
const WorldChase = {
  scene: null,
  camera: null,
  _renderer: null,
  _mixer: null,
  _clock: null,
  _character: null,
  _lancha: null,
  _waterMat: null,
  _speedLines: null,
  _terrain: null,
  _foamMat: null,
  _foam: null,
  _stars: null,
  _palmModels: [],

  // Postprocessing Ping-Pong
  _rtScene: null,
  _rtAccumOld: null,
  _rtAccumNew: null,
  _accumScene: null,
  _accumCamera: null,
  _accumMat: null,
  _finalScene: null,
  _finalMat: null,

  // Terrain constants
  _TERRAIN_WIDTH: 30,
  _TERRAIN_DEPTH: 80,
  _TERRAIN_SPEED: 0.08,

  init(renderer, composer) {
    this._renderer = renderer;
    this._clock = new THREE.Clock();

    const W = renderer.domElement.clientWidth;
    const H = renderer.domElement.clientHeight;

    // ── FISHEYE CAMERA — FOV 120, very close to character ──
    this.camera = new THREE.PerspectiveCamera(120, W / H, 0.05, 300);
    this.camera.position.set(0, 1.8, 4.5);
    this.camera.lookAt(0, 1.2, 0);
    this.camera.updateProjectionMatrix();

    // ── SCENE ──
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x010814);
    this.scene.fog = new THREE.FogExp2(0x020d1f, 0.022);

    // ── NIGHT LIGHTING ──
    this._setupLighting();

    // ── MOON ──
    this._createMoon();

    // ── STARS ──
    this._createStars();

    // ── WATER ──
    this._createWater();

    // ── TERRAIN ──
    this._createTerrain();

    // ── FOAM ──
    this._createFoam();

    // ── PALM TREES ──
    this._loadPalms();

    // ── SPEED LINES ──
    this._createSpeedLines();

    // ── LANCHA ──
    this._loadLancha();

    // ── CHARACTER ──
    this._loadCharacter();

    // ── POSTPROCESSING ──
    this._setupPostProcessing(W, H);

    // Enable shadows on renderer
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  },

  /* ════════════════════════════════════════════
     LIGHTING — Nighttime beach
     ════════════════════════════════════════════ */
  _setupLighting() {
    // 1. Deep blue ambient — base
    const ambient = new THREE.AmbientLight(0x0a1a3f, 0.8);
    this.scene.add(ambient);

    // 2. Moonlight — directional, white-blue, shadows
    const moonLight = new THREE.DirectionalLight(0xc8d8ff, 1.8);
    moonLight.position.set(8, 12, -5);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far = 80;
    moonLight.shadow.camera.left = -20;
    moonLight.shadow.camera.right = 20;
    moonLight.shadow.camera.top = 20;
    moonLight.shadow.camera.bottom = -20;
    this.scene.add(moonLight);

    // 3. Bioluminescent water rim light from below
    const rimLight = new THREE.PointLight(0x0044ff, 1.2, 30);
    rimLight.position.set(0, -0.5, 2);
    this.scene.add(rimLight);

    // 4. Hemisphere for subtle warm/cool split
    const hemiLight = new THREE.HemisphereLight(0x0a1a4a, 0x001133, 0.6);
    this.scene.add(hemiLight);

    // 5. Dedicated lancha fill light (dimmer, blue-tinted)
    const lanchaLight = new THREE.DirectionalLight(0x8899cc, 1.0);
    lanchaLight.position.set(0, 5, 5);
    this.scene.add(lanchaLight);
  },

  /* ════════════════════════════════════════════
     MOON + GLOW HALOS
     ════════════════════════════════════════════ */
  _createMoon() {
    // Solid moon sphere
    const moonGeo = new THREE.SphereGeometry(1.2, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeeeff });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(12, 10, -25);
    this.scene.add(moon);

    // Inner glow halo
    const glowGeo1 = new THREE.SphereGeometry(1.8, 32, 32);
    const glowMat1 = new THREE.MeshBasicMaterial({
      color: 0x8899cc,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide
    });
    const glow1 = new THREE.Mesh(glowGeo1, glowMat1);
    glow1.position.copy(moon.position);
    this.scene.add(glow1);

    // Outer glow halo
    const glowGeo2 = new THREE.SphereGeometry(2.8, 32, 32);
    const glowMat2 = new THREE.MeshBasicMaterial({
      color: 0x4455aa,
      transparent: true,
      opacity: 0.07,
      side: THREE.BackSide
    });
    const glow2 = new THREE.Mesh(glowGeo2, glowMat2);
    glow2.position.copy(moon.position);
    this.scene.add(glow2);
  },

  /* ════════════════════════════════════════════
     STARFIELD
     ════════════════════════════════════════════ */
  _createStars() {
    const count = 800;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 120;
      positions[i * 3 + 1] = Math.random() * 40 + 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.12,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true
    });

    this._stars = new THREE.Points(geo, mat);
    this.scene.add(this._stars);
  },

  /* ════════════════════════════════════════════
     WATER — bioluminescent night ocean
     ════════════════════════════════════════════ */
  _createWater() {
    this._waterMat = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0.0 },
        u_waveHeight: { value: 0.25 },
        u_waveFreq: { value: 0.3 },
        u_waveSpeed: { value: 4.8 },
        u_depthColor: { value: new THREE.Color(0x040d1f) },
        u_surfaceColor: { value: new THREE.Color(0x0a3388) }
      },
      vertexShader: `
        uniform float u_time;
        uniform float u_waveHeight;
        uniform float u_waveFreq;
        uniform float u_waveSpeed;
        varying vec2 vUv;
        varying float vElevation;

        void main() {
          vUv = uv;
          vec4 modelPosition = modelMatrix * vec4(position, 1.0);

          float elevation =
            sin(modelPosition.x * u_waveFreq + u_time * 0.3) *
            sin(modelPosition.z * u_waveFreq - u_time * u_waveSpeed) *
            u_waveHeight;

          elevation +=
            sin(modelPosition.x * u_waveFreq * 1.8 + u_time * 0.5) *
            sin(modelPosition.z * u_waveFreq * 1.2 - u_time * u_waveSpeed * 1.4) *
            u_waveHeight * 0.35;

          modelPosition.y += elevation;
          vElevation = elevation;

          gl_Position = projectionMatrix * viewMatrix * modelPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 u_depthColor;
        uniform vec3 u_surfaceColor;
        uniform float u_time;
        varying float vElevation;
        varying vec2 vUv;

        void main() {
          float baseStrength = (vElevation + 0.15) * 3.0;
          float mixStrength = baseStrength + sin((vUv.y + u_time * 0.4) * 20.0) * 0.15;
          vec3 color = mix(u_depthColor, u_surfaceColor, clamp(mixStrength, 0.0, 1.0));

          // Bioluminescent sparkle highlights
          float sparkle = sin(vUv.x * 80.0 + u_time * 3.0) * sin(vUv.y * 60.0 - u_time * 2.0);
          sparkle = pow(max(sparkle, 0.0), 8.0) * 0.4;
          color += vec3(0.1, 0.3, 0.8) * sparkle;

          gl_FragColor = vec4(color, 0.92);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    });

    const waterGeo = new THREE.PlaneGeometry(200, 200, 128, 128);
    const water = new THREE.Mesh(waterGeo, this._waterMat);
    water.rotation.x = -Math.PI / 2;
    this.scene.add(water);
  },

  /* ════════════════════════════════════════════
     TERRAIN — procedural beach + mountains
     ════════════════════════════════════════════ */
  _createTerrain() {
    const TW = this._TERRAIN_WIDTH;
    const TD = this._TERRAIN_DEPTH;

    const geo = new THREE.PlaneGeometry(TW, TD, 30, 60);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      // xNorm: +1 = water edge (right), -1 = far from water (left)
      const xNorm = x / (TW / 2);

      let finalY = 0;

      if (xNorm > 0.3) {
        // ZONE 1: Shoreline — flat, sinks gently below water
        finalY = -(xNorm - 0.3) * 0.8;
        finalY += Math.sin(x * 1.5 + z * 0.8) * 0.04;

      } else if (xNorm > -0.2) {
        // ZONE 2: Beach → dune transition
        const t = (0.3 - xNorm) / 0.5;
        finalY = t * 1.2;
        finalY += Math.sin(x * 0.8 + z * 0.5) * 0.3 * t;
        finalY += Math.sin(x * 1.8 + z * 1.2) * 0.15 * t;

      } else {
        // ZONE 3: Dunes — soft rolling hills, not sharp mountains
        const t = (-0.2 - xNorm) / 0.8;
        const duneHeight = t * 2.5;
        const duneNoise =
          Math.sin(x * 0.25 + z * 0.15) * 1.0 +
          Math.sin(x * 0.5  + z * 0.3 ) * 0.5 +
          Math.sin(x * 0.1  + z * 0.08) * 1.2;
        finalY = duneHeight + duneNoise * 0.4;

        // Background dunes (far Z)
        const bgDune = Math.max(0, Math.abs(z) / (TD / 2) - 0.4) * 3.0;
        finalY += bgDune;
      }

      positions.setY(i, finalY);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a,
      roughness: 0.95,
      metalness: 0.0
    });

    this._terrain = new THREE.Mesh(geo, mat);
    this._terrain.receiveShadow = true;
    this._terrain.position.set(-TW / 2 - 8, 0, 0);
    this.scene.add(this._terrain);
  },

  /* ════════════════════════════════════════════
     PALM TREES — loaded from GLBs
     ════════════════════════════════════════════ */
  _loadPalms() {
    // Absolute positions in world space (terrain is at X ≈ -23)
    const palmPositions = [
      { x: -14, z:  -5, scale: 1.0, model: 0 },
      { x: -18, z: -12, scale: 1.3, model: 1 },
      { x: -13, z: -20, scale: 0.9, model: 0 },
      { x: -20, z:  -8, scale: 1.1, model: 1 },
      { x: -15, z: -28, scale: 1.4, model: 0 },
      { x: -19, z: -35, scale: 0.85, model: 1 },
      { x: -14, z: -16, scale: 1.0, model: 0 },
      { x: -21, z: -22, scale: 1.2, model: 1 },
      { x: -16, z: -30, scale: 0.95, model: 0 },
      { x: -18, z:  -3, scale: 1.15, model: 1 },
      { x: -13, z: -38, scale: 1.0, model: 0 },
      { x: -22, z: -14, scale: 0.9, model: 1 },
    ];

    const loader = new THREE.GLTFLoader();
    let palm1Proto = null;
    let palm2Proto = null;
    let placed = false;

    const placePalms = () => {
      if (!palm1Proto || !palm2Proto || placed) return;
      placed = true;

      palmPositions.forEach(pos => {
        const proto = pos.model === 0 ? palm1Proto : palm2Proto;
        const palm = proto.clone();

        palm.position.set(pos.x, 0, pos.z);
        palm.rotation.y = Math.random() * Math.PI * 2;

        // Apply bounding-box-based scale so palm is ~4 units tall
        const box = new THREE.Box3().setFromObject(palm);
        const size = box.getSize(new THREE.Vector3());
        const baseScale = 4.0 / Math.max(size.x, size.y, size.z, 0.01);
        palm.scale.setScalar(baseScale * pos.scale);

        palm.traverse(child => {
          if (child.isMesh) {
            child.frustumCulled = false;
            child.visible = true;
            child.castShadow = true;
            child.receiveShadow = true;
            // Force visible material (dark green silhouette)
            child.material = new THREE.MeshStandardMaterial({
              color: pos.model === 0 ? 0x2d5a1b : 0x3a6b22,
              roughness: 0.8,
              metalness: 0.1
            });
          }
        });

        // Add directly to scene, NOT to terrain
        this.scene.add(palm);
        this._palmModels.push(palm);

        // Debug BoxHelper (green wireframe)
        const helper = new THREE.BoxHelper(palm, 0x00ff00);
        this.scene.add(helper);
        // Store helper ref for disposal
        if (!this._palmHelpers) this._palmHelpers = [];
        this._palmHelpers.push(helper);
      });

      console.log('CHASE: placed', this._palmModels.length, 'palms in scene');
    };

    loader.load('assets/palm1.glb', (gltf) => {
      palm1Proto = gltf.scene;
      const box = new THREE.Box3().setFromObject(palm1Proto);
      const size = box.getSize(new THREE.Vector3());
      console.log('palm1 raw size:', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));
      placePalms();
    }, undefined, (e) => console.warn('palm1 load error:', e));

    loader.load('assets/palm2.glb', (gltf) => {
      palm2Proto = gltf.scene;
      const box = new THREE.Box3().setFromObject(palm2Proto);
      const size = box.getSize(new THREE.Vector3());
      console.log('palm2 raw size:', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));
      placePalms();
    }, undefined, (e) => console.warn('palm2 load error:', e));
  },

  /* ════════════════════════════════════════════
     SHORE FOAM
     ════════════════════════════════════════════ */
  _createFoam() {
    const geo = new THREE.PlaneGeometry(60, 1.5, 40, 1);
    geo.rotateX(-Math.PI / 2);

    this._foamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        u_time: { value: 0 },
        u_opacity: { value: 0.7 }
      },
      vertexShader: `
        uniform float u_time;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 pos = modelMatrix * vec4(position, 1.0);
          pos.y += sin(pos.x * 2.0 + u_time * 2.0) * 0.05;
          gl_Position = projectionMatrix * viewMatrix * pos;
        }
      `,
      fragmentShader: `
        uniform float u_time;
        uniform float u_opacity;
        varying vec2 vUv;
        void main() {
          float foam = sin(vUv.x * 20.0 + u_time * 3.0) * 0.5 + 0.5;
          foam *= sin(vUv.x * 7.0 - u_time * 1.5) * 0.5 + 0.5;
          foam = pow(foam, 2.0);

          float edgeFade = smoothstep(0.0, 0.3, vUv.y) *
                           smoothstep(1.0, 0.7, vUv.y);

          vec3 foamColor = vec3(0.8, 0.9, 1.0);
          gl_FragColor = vec4(foamColor, foam * edgeFade * u_opacity);
        }
      `
    });

    this._foam = new THREE.Mesh(geo, this._foamMat);
    this._foam.position.set(-8, 0.05, 0);
    this.scene.add(this._foam);
  },

  /* ════════════════════════════════════════════
     SPEED LINES
     ════════════════════════════════════════════ */
  _createSpeedLines() {
    const geo = new THREE.BufferGeometry();
    const count = 800;
    const pos = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 1.5 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = Math.max(-0.5, Math.sin(theta) * r);
      pos[i * 3 + 2] = -20 - Math.random() * 80;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x6688cc,
      size: 0.2,
      transparent: true,
      opacity: 0.5
    });

    this._speedLines = new THREE.Points(geo, mat);
    this.scene.add(this._speedLines);
  },

  /* ════════════════════════════════════════════
     LANCHA
     ════════════════════════════════════════════ */
  _loadLancha() {
    const loader = new THREE.GLTFLoader();
    loader.load('assets/lancha.glb', (gltf) => {
      this._lancha = gltf.scene;

      this._lancha.scale.setScalar(1);
      this._lancha.position.set(0, 0.5, -6);
      this._lancha.rotation.y = -Math.PI / 2;

      this._lancha.traverse((child) => {
        if (child.isMesh && child.material) {
          if (child.material.metalness !== undefined) {
            child.material.metalness = 0.0;
            child.material.roughness = 0.9;
          }
          if (child.material.map) {
            child.material.map.encoding = THREE.sRGBEncoding;
            child.material.map.needsUpdate = true;
          }
          child.material.needsUpdate = true;
        }
      });

      this.scene.add(this._lancha);

      // Wake (Estela)
      const wakeGeo = new THREE.PlaneGeometry(0.5, 4);
      const wakeMat = new THREE.MeshBasicMaterial({
        color: 0x4466aa,
        transparent: true,
        opacity: 0.5
      });

      const wake1 = new THREE.Mesh(wakeGeo, wakeMat);
      wake1.rotation.x = -Math.PI / 2;
      wake1.position.set(-0.8, -0.1, 2);
      this._lancha.add(wake1);

      const wake2 = new THREE.Mesh(wakeGeo, wakeMat);
      wake2.rotation.x = -Math.PI / 2;
      wake2.position.set(0.8, -0.1, 2);
      this._lancha.add(wake2);

      this._wakePlanes = [wake1, wake2];
    }, undefined, (e) => console.error(e));
  },

  /* ════════════════════════════════════════════
     CHARACTER
     ════════════════════════════════════════════ */
  _loadCharacter() {
    const loader = new THREE.GLTFLoader();
    loader.load('assets/walkloop.glb', (gltf) => {
      this._character = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(gltf.scene) : gltf.scene;
      this._character.position.set(0, 0, 2);
      this._character.scale.setScalar(0.5);
      this._character.rotation.y = Math.PI;

      this.scene.add(this._character);

      this._mixer = new THREE.AnimationMixer(this._character);
      if (gltf.animations.length > 0) {
        const action = this._mixer.clipAction(gltf.animations[0]);
        action.play();
        this._walkAction = action;
        this._walkAction.paused = true;
      }
    }, undefined, (e) => console.error(e));
  },

  /* ════════════════════════════════════════════
     POSTPROCESSING — Motion blur + Vignette + Barrel Distortion
     ════════════════════════════════════════════ */
  _setupPostProcessing(W, H) {
    this._accumCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this._rtScene = new THREE.WebGLRenderTarget(W, H);
    this._rtAccumOld = new THREE.WebGLRenderTarget(W, H);
    this._rtAccumNew = new THREE.WebGLRenderTarget(W, H);

    // Accumulation blend pass (motion blur)
    this._accumMat = new THREE.ShaderMaterial({
      uniforms: {
        tOld: { value: this._rtAccumOld.texture },
        tNew: { value: this._rtScene.texture },
        damp: { value: 0.965 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tOld;
        uniform sampler2D tNew;
        uniform float damp;
        varying vec2 vUv;
        void main() {
          vec4 texelOld = texture2D(tOld, vUv);
          vec4 texelNew = texture2D(tNew, vUv);
          gl_FragColor = mix(texelNew, texelOld, damp);
        }
      `,
      depthWrite: false, depthTest: false
    });

    this._accumScene = new THREE.Scene();
    this._accumScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._accumMat));

    // Final pass: Vignette (dark blue tint) + Barrel distortion (fisheye)
    // Zoom compensation (0.75) ensures barrel distortion never samples
    // outside texture bounds — no black corners
    this._finalMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this._rtAccumNew.texture },
        uBarrelStrength: { value: 0.22 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uBarrelStrength;
        varying vec2 vUv;
        void main() {
          // Barrel distortion with zoom compensation — no black edges
          vec2 uv = vUv * 2.0 - 1.0;
          float r = length(uv);
          uv *= (1.0 + uBarrelStrength * r * r) * 0.75;
          uv = uv * 0.5 + 0.5;

          vec4 color = texture2D(tDiffuse, clamp(uv, 0.0, 1.0));

          // Vignette — dark blue-black tint for night atmosphere
          vec2 vigUv = vUv * 2.0 - 1.0;
          float dist = length(vigUv);
          float vignette = smoothstep(0.5, 1.3, dist);
          color.rgb = mix(color.rgb, vec3(0.01, 0.03, 0.08), vignette * 0.65);

          gl_FragColor = color;
        }
      `,
      depthWrite: false, depthTest: false
    });

    this._finalScene = new THREE.Scene();
    this._finalScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._finalMat));
  },

  /* ════════════════════════════════════════════
     UPDATE LOOP
     ════════════════════════════════════════════ */
  update(time, keys) {
    const delta = this._clock.getDelta();

    // 1. Water
    if (this._waterMat) {
      this._waterMat.uniforms.u_time.value = time;
    }

    // 2. Terrain scrolling (infinite loop)
    if (this._terrain) {
      this._terrain.position.z += this._TERRAIN_SPEED;
      if (this._terrain.position.z > this._TERRAIN_DEPTH / 2) {
        this._terrain.position.z -= this._TERRAIN_DEPTH;
      }
    }

    // 2b. Palm trees scroll independently (not children of terrain)
    if (this._palmModels && this._palmModels.length > 0) {
      this._palmModels.forEach(palm => {
        palm.position.z += this._TERRAIN_SPEED;
        if (palm.position.z > this._TERRAIN_DEPTH / 2) {
          palm.position.z -= this._TERRAIN_DEPTH;
        }
      });
      // Update debug helpers
      if (this._palmHelpers) {
        this._palmHelpers.forEach(h => h.update());
      }
    }

    // 3. Foam synced with terrain
    if (this._foam && this._terrain) {
      this._foam.position.z = this._terrain.position.z;
      this._foamMat.uniforms.u_time.value = time;
    }

    // 4. Lancha bobbing & swaying
    if (this._lancha) {
      this._lancha.position.y = Math.sin(time * 1.8) * 0.12;
      this._lancha.rotation.x = Math.sin(time * 0.9) * 0.02;

      const sway = Math.sin(time * 0.4) * 2.5;
      const prevSway = Math.sin((time - delta) * 0.4) * 2.5;
      this._lancha.position.x = sway;
      this._lancha.rotation.z = Math.sin(time * 1.2) * 0.04 + (sway - prevSway) * 0.15;

      if (this._wakePlanes) {
        const opacity = 0.3 + (Math.sin(time * 10) + 1.0) * 0.2;
        this._wakePlanes.forEach(w => w.material.opacity = opacity);
      }
    }

    // 5. Speed Lines
    if (this._speedLines) {
      const pos = this._speedLines.geometry.attributes.position.array;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 2] += 180 * delta;
        pos[i * 3] += pos[i * 3] * 0.02;
        pos[i * 3 + 1] += pos[i * 3 + 1] * 0.02;

        if (pos[i * 3 + 2] > 10 || Math.abs(pos[i * 3]) > 15 || Math.abs(pos[i * 3 + 1]) > 15) {
          const r = 1.5 + Math.random() * 6;
          const theta = Math.random() * Math.PI * 2;
          pos[i * 3] = Math.cos(theta) * r;
          pos[i * 3 + 1] = Math.max(-0.5, Math.sin(theta) * r);
          pos[i * 3 + 2] = -80 - Math.random() * 20;
        }
      }
      this._speedLines.geometry.attributes.position.needsUpdate = true;
    }

    // 6. Character movement
    if (this._character) {
      let isMoving = false;
      const speed = 0.05;

      if (keys.left) {
        this._character.position.x -= speed;
        isMoving = true;
      } else if (keys.right) {
        this._character.position.x += speed;
        isMoving = true;
      }

      this._character.position.x = Math.max(-4, Math.min(4, this._character.position.x));

      if (this._walkAction) {
        if (isMoving) {
          this._walkAction.paused = false;
          if (this._mixer) this._mixer.update(delta);
        } else {
          this._walkAction.paused = true;
        }
      }
    }

    // 7. Star twinkle (subtle opacity variation)
    if (this._stars) {
      this._stars.material.opacity = 0.7 + Math.sin(time * 2.0) * 0.2;
    }

    // 8. Postprocessing Render
    const autoClear = this._renderer.autoClear;
    this._renderer.autoClear = false;

    // a. Render scene -> rtScene
    this._renderer.setRenderTarget(this._rtScene);
    this._renderer.clear();
    this.camera.position.x += ((this._character ? this._character.position.x * 0.5 : 0) - this.camera.position.x) * 0.05;
    this.camera.position.y = 1.8 + Math.sin(time * 30.0) * 0.015;
    this._renderer.render(this.scene, this.camera);

    // b. Accumulate (rtScene + rtAccumOld) -> rtAccumNew
    this._accumMat.uniforms.tOld.value = this._rtAccumOld.texture;
    this._accumMat.uniforms.tNew.value = this._rtScene.texture;
    this._renderer.setRenderTarget(this._rtAccumNew);
    this._renderer.clear();
    this._renderer.render(this._accumScene, this._accumCamera);

    // c. Swap targets
    const temp = this._rtAccumOld;
    this._rtAccumOld = this._rtAccumNew;
    this._rtAccumNew = temp;

    // d. Final pass to screen (vignette + barrel distortion)
    this._finalMat.uniforms.tDiffuse.value = this._rtAccumOld.texture;
    this._renderer.setRenderTarget(null);
    this._renderer.render(this._finalScene, this._accumCamera);

    this._renderer.autoClear = autoClear;
  },

  /* ════════════════════════════════════════════
     DISPOSE
     ════════════════════════════════════════════ */
  dispose() {
    if (this._rtScene) {
      this._rtScene.dispose();
      this._rtAccumOld.dispose();
      this._rtAccumNew.dispose();
      this._accumMat.dispose();
      this._finalMat.dispose();
    }
    if (this._waterMat) this._waterMat.dispose();
    if (this._foamMat) this._foamMat.dispose();
    if (this._speedLines) {
      this._speedLines.geometry.dispose();
      this._speedLines.material.dispose();
    }
    if (this._stars) {
      this._stars.geometry.dispose();
      this._stars.material.dispose();
    }
    if (this.scene) {
      this.scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => m.dispose());
        }
      });
      this.scene.clear();
    }
    this._palmModels = [];
  }
};

export default WorldChase;

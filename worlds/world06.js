// worlds/world06.js
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
  
  // Postprocessing Ping-Pong
  _rtScene: null,
  _rtAccumOld: null,
  _rtAccumNew: null,
  _accumScene: null,
  _accumCamera: null,
  _accumMat: null,
  _finalScene: null,
  _finalMat: null,

  init(renderer, composer) {
    this._renderer = renderer;
    this._clock = new THREE.Clock();
    
    // Auto-clear false para poder hacer ping pong si quisieramos, 
    // pero con RenderTargets explicitos no es estrictamente necesario,
    // salvo asegurarnos de limpiar el de escena.
    const W = renderer.domElement.clientWidth;
    const H = renderer.domElement.clientHeight;

    this.camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 300);
    this.camera.position.set(0, 2.5, 6);
    this.camera.lookAt(0, 1, 0);
    this.camera.updateProjectionMatrix();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe8f0ff);
    this.scene.fog = new THREE.FogExp2(0xe8f0ff, 0.018);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    const lanchaLight = new THREE.DirectionalLight(0xffffff, 2.0);
    lanchaLight.position.set(0, 5, 5);
    this.scene.add(lanchaLight);

    // ── WATER ──
    this._createWater();

    // ── SPEED LINES ──
    this._createSpeedLines();

    // ── LANCHA ──
    this._loadLancha();

    // ── CHARACTER ──
    this._loadCharacter();

    // ── POSTPROCESSING (Custom Motion Blur + Vignette) ──
    this._setupPostProcessing(W, H);
  },

  _createWater() {
    this._waterMat = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0.0 },
        u_waveHeight: { value: 0.25 },
        u_waveFreq: { value: 0.3 },
        u_waveSpeed: { value: 2.5 },
        u_depthColor: { value: new THREE.Color(0x0a1a3a) },
        u_surfaceColor: { value: new THREE.Color(0x4488cc) }
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

          // Las ondas viajan en Z positivo (hacia la camara)
          // El signo negativo en u_time hace el flujo haca adelante en Z
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

  _createSpeedLines() {
    const geo = new THREE.BufferGeometry();
    const count = 300;
    const pos = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      // Tunnel distribution
      const r = 3 + Math.random() * 8;
      const theta = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = Math.max(0, Math.sin(theta) * r); // Above water mainly
      pos[i * 3 + 2] = -20 - Math.random() * 60; // Initial Z spread
    }
    
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.3
    });
    
    this._speedLines = new THREE.Points(geo, mat);
    this.scene.add(this._speedLines);
  },

  _loadLancha() {
    const loader = new THREE.GLTFLoader();
    loader.load('assets/lancha.glb', (gltf) => {
      this._lancha = gltf.scene;
      
      this._lancha.scale.setScalar(1); // El modelo ya viene 3x mas grande
      this._lancha.position.set(0, 0.5, -6);
      this._lancha.rotation.y = -Math.PI / 2; // Rotado -90 grados para mirar al horizonte verdadero
      
      // Aplicar arreglo de textura (reducir metalness y asegurar sRGB)
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
      const wakeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
      
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

  _loadCharacter() {
    const loader = new THREE.GLTFLoader();
    loader.load('assets/walkloop.glb', (gltf) => {
      // Usar clone para no referenciar datos mutados globalmente, similar a otros mundos
      this._character = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(gltf.scene) : gltf.scene;
      this._character.position.set(0, 0, 2); // Personaje mas cerca
      this._character.scale.setScalar(0.5); // Escala habitual en este proyecto
      this._character.rotation.y = Math.PI; // Fijar mirando de espaldas a la camara
      
      this.scene.add(this._character);

      this._mixer = new THREE.AnimationMixer(this._character);
      if (gltf.animations.length > 0) {
        const action = this._mixer.clipAction(gltf.animations[0]);
        action.play();
        this._walkAction = action;
        this._walkAction.paused = true; // Inicia quieto
      }
    }, undefined, (e) => console.error(e));
  },

  _setupPostProcessing(W, H) {
    this._accumCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Render targets for ping-pong
    this._rtScene = new THREE.WebGLRenderTarget(W, H);
    this._rtAccumOld = new THREE.WebGLRenderTarget(W, H);
    this._rtAccumNew = new THREE.WebGLRenderTarget(W, H);

    // Accumulation blend pass
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

    // Final Vignette pass to screen
    this._finalMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this._rtAccumNew.texture } },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          vec2 uv = vUv * 2.0 - 1.0;
          float dist = length(uv);
          float vignette = smoothstep(0.55, 1.2, dist);
          color.rgb = mix(color.rgb, vec3(1.0), vignette * 0.55);
          gl_FragColor = color;
        }
      `,
      depthWrite: false, depthTest: false
    });

    this._finalScene = new THREE.Scene();
    this._finalScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._finalMat));
  },

  update(time, keys) {
    const delta = this._clock.getDelta();

    // 1. Water
    if (this._waterMat) {
      this._waterMat.uniforms.u_time.value = time;
    }

    // 2. Lancha bobbing & swaying
    if (this._lancha) {
      this._lancha.position.y = Math.sin(time * 1.8) * 0.12;
      this._lancha.rotation.x = Math.sin(time * 0.9) * 0.02;
      
      const sway = Math.sin(time * 0.4) * 2.5;
      const prevSway = Math.sin((time - delta) * 0.4) * 2.5;
      this._lancha.position.x = sway;
      this._lancha.rotation.z = Math.sin(time * 1.2) * 0.04 + (sway - prevSway) * 0.15;
      
      // Wake anim
      if (this._wakePlanes) {
        const opacity = 0.3 + (Math.sin(time * 10) + 1.0) * 0.2; // 0.3 a 0.7
        this._wakePlanes.forEach(w => w.material.opacity = opacity);
      }
    }

    // 3. Speed Lines
    if (this._speedLines) {
      const pos = this._speedLines.geometry.attributes.position.array;
      for (let i = 0; i < pos.length / 3; i++) {
        pos[i * 3 + 2] += 60 * delta; // move toward camera (+Z)
        if (pos[i * 3 + 2] > 10) {
          pos[i * 3 + 2] = -60; // reset
        }
      }
      this._speedLines.geometry.attributes.position.needsUpdate = true;
    }

    // 4 & 5. Character Animation & Control
    if (this._character) {
      let isMoving = false;
      const speed = 0.05; // 0.05 per frame as requested (using direct scalar instead of delta for crisp feel, but let's stick to simple addition just scaled)
      // The prompt actually says: "a velocidad 0.05 por frame"
      
      if (keys.left) {
        this._character.position.x -= speed;
        isMoving = true;
      } else if (keys.right) {
        this._character.position.x += speed;
        isMoving = true;
      }

      // Limits
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

    // 6. Postprocessing Render
    const autoClear = this._renderer.autoClear;
    this._renderer.autoClear = false;

    // a. Render scene -> rtScene
    this._renderer.setRenderTarget(this._rtScene);
    this._renderer.clear();
    // La cámara debe seguir mirando a la lancha si es necesario, 
    // pero configuré la cámara para que mire fijo. El jugador se mueve solo en X.
    this.camera.position.x += ( (this._character ? this._character.position.x * 0.5 : 0) - this.camera.position.x ) * 0.05;
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

    // d. Render to Screen with Vignette
    this._finalMat.uniforms.tDiffuse.value = this._rtAccumOld.texture;
    this._renderer.setRenderTarget(null);
    this._renderer.render(this._finalScene, this._accumCamera);

    this._renderer.autoClear = autoClear;
  },

  dispose() {
    if (this._rtScene) {
      this._rtScene.dispose();
      this._rtAccumOld.dispose();
      this._rtAccumNew.dispose();
      this._accumMat.dispose();
      this._finalMat.dispose();
    }
    if (this._waterMat) this._waterMat.dispose();
    if (this._speedLines) {
      this._speedLines.geometry.dispose();
      this._speedLines.material.dispose();
    }
    if (this.scene) {
      this.scene.clear();
    }
  }
};

export default WorldChase;

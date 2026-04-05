const WorldTeatro = {
  scene: null,
  camera: null,
  _renderer: null,
  _orbitControls: null,
  _video: null,
  _videoTex: null,
  _chairs: [],              // all raycasting targets (mesh descendants of sillas)
  _chairGroupOf: null,      // Map<Mesh, Object3D> → mesh → its silla parent
  _chairGroupMeshes: null,  // Map<Object3D, Mesh[]> → silla parent → all its meshes
  _chairOriginalEmissive: null, // Map<Mesh, {emissive, intensity}>
  _hoveredChairGroup: null,
  _pizarra: null,
  _raycaster: new THREE.Raycaster(),
  _mouse: new THREE.Vector2(),
  _handlers: {},
  _btnVolver: null,
  _loadingText: null,
  _isSeated: false,
  _initialCameraPos: new THREE.Vector3(4, 3.5, 10),
  _initialTargetPos: new THREE.Vector3(0, 1.0, 0),

  init(renderer, _composer) {
    this._renderer = renderer;
    this._chairGroupOf = new Map();
    this._chairGroupMeshes = new Map();
    this._chairOriginalEmissive = new Map();
    this._chairs = [];
    this._hoveredChairGroup = null;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x010814);
    this.scene.fog = new THREE.FogExp2(0x020d1f, 0.035);

    const W = renderer.domElement.clientWidth;
    const H = renderer.domElement.clientHeight;

    this.camera = new THREE.PerspectiveCamera(100, W / H, 0.1, 100);
    this.camera.position.copy(this._initialCameraPos);

    this._orbitControls = new THREE.OrbitControls(this.camera, renderer.domElement);
    this._orbitControls.enableDamping = true;
    this._orbitControls.dampingFactor = 0.05;
    this._orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
    this._orbitControls.target.copy(this._initialTargetPos);

    // ── NIGHTTIME BEACH LIGHTING (imitates WorldChase) ──
    // 1. Deep blue ambient
    const ambient = new THREE.AmbientLight(0x0a1a3f, 0.8);
    this.scene.add(ambient);

    // 2. Moonlight — directional, white-blue
    const moonLight = new THREE.DirectionalLight(0xc8d8ff, 1.8);
    moonLight.position.set(8, 12, -5);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 1024;
    moonLight.shadow.mapSize.height = 1024;
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far = 60;
    moonLight.shadow.camera.left = -15;
    moonLight.shadow.camera.right = 15;
    moonLight.shadow.camera.top = 15;
    moonLight.shadow.camera.bottom = -15;
    this.scene.add(moonLight);

    // 3. Cool rim light from screen side (imitates bioluminescent water)
    const rimLight = new THREE.PointLight(0x0044ff, 1.2, 25);
    rimLight.position.set(0, 1.5, -6);
    this.scene.add(rimLight);

    // 4. Hemisphere — warm/cool split
    const hemiLight = new THREE.HemisphereLight(0x0a1a4a, 0x001133, 0.6);
    this.scene.add(hemiLight);

    // 5. Screen glow fill (blue-tinted, facing audience)
    const screenFill = new THREE.DirectionalLight(0x8899cc, 0.9);
    screenFill.position.set(0, 4, 4);
    this.scene.add(screenFill);

    // ── LOAD VIDEO ──
    this._video = document.createElement('video');
    this._video.src = 'assets/videos/Seq01.mp4';
    this._video.crossOrigin = 'anonymous';
    this._video.loop = true;
    this._video.muted = true;
    this._video.playsInline = true;
    this._video.play().catch(e => console.warn("Autoplay prevent detectado:", e));

    this._videoTex = new THREE.VideoTexture(this._video);
    this._videoTex.minFilter = THREE.LinearFilter;
    this._videoTex.magFilter = THREE.LinearFilter;
    this._videoTex.format = THREE.RGBAFormat;

    const screenMaterial = new THREE.MeshBasicMaterial({ map: this._videoTex });

    // ── LOADING INDICATOR (visible while GLB loads) ──
    this._loadingText = document.createElement('div');
    this._loadingText.style.cssText = `
      position:absolute; top:50%; left:50%;
      transform:translate(-50%,-50%);
      color:#8899cc; font-family:'Orbitron','Share Tech Mono',monospace;
      font-size:13px; letter-spacing:0.15em;
      pointer-events:none; z-index:5;
      text-shadow: 0 0 10px #8899cc;
    `;
    this._loadingText.textContent = 'CARGANDO TEATRO...';
    const canvasArea = document.getElementById('canvas-area');
    if (canvasArea) canvasArea.appendChild(this._loadingText);

    // ── LOAD GLB ──
    const loader = new THREE.GLTFLoader();
    loader.load('assets/teatro.glb', (gltf) => {
      // Remove loading indicator
      if (this._loadingText) { this._loadingText.remove(); this._loadingText = null; }

      this.scene.add(gltf.scene);

      gltf.scene.traverse((child) => {
        const name = child.name.toLowerCase();

        // Identify Pizarra
        if (child.isMesh && (name.includes('pizarra') || name.includes('board') || name.includes('screen'))) {
          this._pizarra = child;
          child.material = screenMaterial;
        }

        // Identify silla groups — register group + clone materials for hover
        if (name.includes('silla') || name.includes('chair')) {
          const meshes = [];
          child.traverse((descendant) => {
            if (!descendant.isMesh) return;

            // Clone material so we can modify emissive independently
            descendant.material = descendant.material.clone();

            // Upgrade to MeshStandardMaterial if needed so emissive works
            if (!descendant.material.isMeshStandardMaterial && !descendant.material.isMeshPhysicalMaterial) {
              const orig = descendant.material;
              const upgraded = new THREE.MeshStandardMaterial({
                color: orig.color ? orig.color.clone() : new THREE.Color(0x666666),
                roughness: 0.8,
                metalness: 0.1
              });
              orig.dispose();
              descendant.material = upgraded;
            }

            // Store original emissive so we can restore after hover
            this._chairOriginalEmissive.set(descendant, {
              emissive: descendant.material.emissive.clone(),
              intensity: descendant.material.emissiveIntensity || 0
            });

            meshes.push(descendant);
            if (!this._chairs.includes(descendant)) {
              this._chairs.push(descendant);
            }
            this._chairGroupOf.set(descendant, child);
          });
          this._chairGroupMeshes.set(child, meshes);
        }

        // Apply night environment to all standard materials
        if (child.isMesh && child.material && child.material.isMeshStandardMaterial) {
          child.material.envMapIntensity = 0.5;
          child.material.needsUpdate = true;
        }
      });

    }, undefined, (e) => {
      console.error("Error loading teatro.glb", e);
      if (this._loadingText) { this._loadingText.remove(); this._loadingText = null; }
    });

    // ── GOD VIEW BUTTON — anchored to canvas-area top-left ──
    this._btnVolver = document.createElement('button');
    this._btnVolver.id = 'btn-volver-teatro';
    this._btnVolver.textContent = '◀ GOD VIEW';
    this._btnVolver.style.cssText = `
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 10;
      padding: 6px 12px;
      background: rgba(29, 21, 43, 0.9);
      color: #e0d8f0;
      border: 1px solid #8899cc;
      border-radius: 6px;
      cursor: pointer;
      display: none;
      font-family: 'Orbitron','Share Tech Mono',monospace;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 0.05em;
    `;
    if (canvasArea) {
      canvasArea.appendChild(this._btnVolver);
    } else {
      document.body.appendChild(this._btnVolver);
    }

    // ── EVENT HANDLERS ──
    this._handlers.down = (e) => {
      if (e.target && e.target.closest && e.target.closest('#btn-volver-teatro')) return;
      this._isDragging = false;
      this._dragStart = { x: e.clientX, y: e.clientY };
    };

    this._handlers.move = (e) => {
      try {
        if (this._dragStart) {
          const dx = e.clientX - this._dragStart.x;
          const dy = e.clientY - this._dragStart.y;
          if (Math.sqrt(dx * dx + dy * dy) > 4) this._isDragging = true;
        }

        const rect = this._renderer.domElement.getBoundingClientRect();
        this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this._raycaster.setFromCamera(this._mouse, this.camera);

        // Hover detection on chairs
        if (this._chairs.length > 0) {
          const intersects = this._raycaster.intersectObjects(this._chairs, false);
          let hitGroup = null;
          if (intersects.length > 0) {
            hitGroup = this._chairGroupOf.get(intersects[0].object) || null;
          }
          if (hitGroup !== this._hoveredChairGroup) {
            if (this._hoveredChairGroup) this._setChairGlow(this._hoveredChairGroup, false);
            if (hitGroup) this._setChairGlow(hitGroup, true);
            this._hoveredChairGroup = hitGroup;
          }
        }
      } catch (err) {
        console.warn("MOVE ERROR:", err.message);
      }
    };

    this._handlers.up = (e) => {
      if (!this._isDragging && this._dragStart) {
        try { this._onClick(e); } catch (err) { console.warn("CLICK ERROR:", err.message); }
      }
      this._dragStart = null;
    };

    this._handlers.btnClick = () => this._onVolver();
    this._handlers.touch = (e) => {
      if (e.touches.length > 0 && !this._isDragging) {
        this._onClick(e.touches[0]);
        this._handlers.move(e.touches[0]);
      }
    };

    window.addEventListener('mousedown', this._handlers.down);
    window.addEventListener('mousemove', this._handlers.move);
    window.addEventListener('mouseup', this._handlers.up);
    window.addEventListener('touchstart', this._handlers.touch, { passive: false });
    this._btnVolver.addEventListener('click', this._handlers.btnClick);
  },

  // Apply or remove emissive glow from all meshes in a chair group
  _setChairGlow(chairGroup, glowing) {
    const meshes = this._chairGroupMeshes.get(chairGroup);
    if (!meshes) return;
    meshes.forEach(mesh => {
      if (!mesh.material) return;
      if (glowing) {
        mesh.material.emissive.set(0x00aaff);
        mesh.material.emissiveIntensity = 2.0;
      } else {
        const orig = this._chairOriginalEmissive.get(mesh);
        if (orig) {
          mesh.material.emissive.copy(orig.emissive);
          mesh.material.emissiveIntensity = orig.intensity;
        } else {
          mesh.material.emissive.set(0x000000);
          mesh.material.emissiveIntensity = 0;
        }
      }
      mesh.material.needsUpdate = true;
    });
  },

  _onClick(e) {
    const rect = this._renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this.camera);
    const intersects = this._raycaster.intersectObjects(this.scene.children, true);

    for (let i = 0; i < intersects.length; i++) {
      let obj = intersects[i].object;
      let isChair = false;
      let current = obj;
      while (current) {
        const n = current.name.toLowerCase();
        if (n.includes('silla') || n.includes('chair')) { isChair = true; break; }
        current = current.parent;
      }
      if (isChair) {
        this._sitOnChair(obj);
        return;
      }
    }
  },

  _sitOnChair(chairMesh) {
    this._isSeated = true;
    this._btnVolver.style.display = 'block';

    if (this._video) {
      this._video.muted = false;
      this._video.volume = 0.5;
      if (this._video.paused) this._video.play().catch(e => console.log(e));
    }

    const box = new THREE.Box3().setFromObject(chairMesh);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const chairPos = center.clone();
    chairPos.y += 0.8;
    chairPos.z += 0.8;
    if (chairPos.y < 1.0) chairPos.y = 1.0;

    const lookPos = new THREE.Vector3();
    if (this._pizarra) {
      this._pizarra.getWorldPosition(lookPos);
    } else {
      lookPos.set(0, 1.5, -5);
    }

    this._orbitControls.enabled = false;

    if (window.gsap) {
      window.gsap.killTweensOf(this.camera.position);
      window.gsap.killTweensOf(this._orbitControls.target);
      window.gsap.to(this.camera.position, {
        x: chairPos.x, y: chairPos.y, z: chairPos.z,
        duration: 2.2, ease: 'power2.inOut'
      });
      window.gsap.to(this._orbitControls.target, {
        x: lookPos.x, y: lookPos.y, z: lookPos.z,
        duration: 2.2, ease: 'power2.inOut',
        onUpdate: () => this._orbitControls.update(),
        onComplete: () => {
          this._orbitControls.enabled = true;
          this._orbitControls.minDistance = 0.1;
          this._orbitControls.maxDistance = 8;
        }
      });
    } else {
      this.camera.position.copy(chairPos);
      this._orbitControls.target.copy(lookPos);
      this._orbitControls.update();
      this._orbitControls.enabled = true;
    }
  },

  _onVolver() {
    this._btnVolver.style.display = 'none';
    this._orbitControls.enabled = false;

    if (window.gsap) {
      window.gsap.killTweensOf(this.camera.position);
      window.gsap.killTweensOf(this._orbitControls.target);
      window.gsap.to(this.camera.position, {
        x: this._initialCameraPos.x, y: this._initialCameraPos.y, z: this._initialCameraPos.z,
        duration: 2.0, ease: 'power2.inOut'
      });
      window.gsap.to(this._orbitControls.target, {
        x: this._initialTargetPos.x, y: this._initialTargetPos.y, z: this._initialTargetPos.z,
        duration: 2.0, ease: 'power2.inOut',
        onUpdate: () => this._orbitControls.update(),
        onComplete: () => {
          this._orbitControls.enabled = true;
          this._isSeated = false;
        }
      });
    } else {
      this.camera.position.copy(this._initialCameraPos);
      this._orbitControls.target.copy(this._initialTargetPos);
      this._orbitControls.update();
      this._orbitControls.enabled = true;
      this._isSeated = false;
    }
  },

  update(_time) {
    if (this._orbitControls) this._orbitControls.update();
    if (this._renderer) {
      this._renderer.clear();
      this._renderer.render(this.scene, this.camera);
    }
  },

  dispose() {
    window.removeEventListener('mousedown', this._handlers.down);
    window.removeEventListener('mousemove', this._handlers.move);
    window.removeEventListener('mouseup', this._handlers.up);
    window.removeEventListener('touchstart', this._handlers.touch);

    if (this._btnVolver) {
      this._btnVolver.removeEventListener('click', this._handlers.btnClick);
      this._btnVolver.remove();
      this._btnVolver = null;
    }
    if (this._loadingText) {
      this._loadingText.remove();
      this._loadingText = null;
    }
    if (this._orbitControls) this._orbitControls.dispose();
    if (this._video) {
      this._video.pause();
      this._video.removeAttribute('src');
      this._video.load();
    }
    if (this._videoTex) this._videoTex.dispose();
    if (this.scene) this.scene.clear();

    this._chairs = [];
    this._chairGroupOf = new Map();
    this._chairGroupMeshes = new Map();
    this._chairOriginalEmissive = new Map();
    this._hoveredChairGroup = null;
    this._isSeated = false;
  }
};

export default WorldTeatro;

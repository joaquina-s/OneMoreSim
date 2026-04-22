import { uiSound } from '../audio/uiSounds.js?v=3';

const WorldTeatro = {
  scene: null,
  camera: null,
  // Disable the global arrow-key camera rotation — in Presentation_Club only
  // chair tap should navigate. Read by core/worldManager.js tick().
  _disableArrowRotate: true,
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
  _isAnimating: false,
  _initialCameraPos: new THREE.Vector3(3, 2.5, 7),
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
    // Per-device shadow size (mobile: 512² → 4× cheaper)
    const _shadowSize = (window.innerWidth < 768) ? 512 : 1024;
    moonLight.shadow.mapSize.width  = _shadowSize;
    moonLight.shadow.mapSize.height = _shadowSize;
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
    // Vertical flip del video (alineado al nuevo orientado del Plane del GLB)
    this._videoTex.wrapS = THREE.RepeatWrapping;
    this._videoTex.wrapT = THREE.RepeatWrapping;
    this._videoTex.repeat.y = -1;
    this._videoTex.offset.y = 1;

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
    this._loadingText.textContent = 'LOADING PRESENTATION CLUB...';
    const canvasArea = document.getElementById('canvas-area');
    if (canvasArea) canvasArea.appendChild(this._loadingText);

    // ── LOAD GLB ──
    const loader = new THREE.GLTFLoader();
    loader.load('assets/3D/teatro.glb?v=4', (gltf) => {
      // Remove loading indicator
      if (this._loadingText) { this._loadingText.remove(); this._loadingText = null; }

      this.scene.add(gltf.scene);

      gltf.scene.traverse((child) => {
        const name = child.name.toLowerCase();

        // Identify video screen mesh — now called "Plane" in the new GLB
        // (replaces the old "Pizarra" node). Keep legacy names for safety.
        if (child.isMesh && (
              name === 'plane' || name.startsWith('plane') ||
              name.includes('pizarra') || name.includes('board') || name.includes('screen'))) {
          this._pizarra = child;
          child.material = screenMaterial;
        }

        // Identify silla groups — accept any chair-named node.
        // Skip if the node is a Mesh AND has a chair-named ancestor: that
        // ancestor is a better chair group (prevents clicks from snapping to
        // a sub-mesh's tiny bounding box).
        if (name.includes('silla') || name.includes('chair')) {
          if (child.isMesh) {
            let anc = child.parent;
            let hasChairAnc = false;
            while (anc) {
              const an = (anc.name || '').toLowerCase();
              if (an.includes('silla') || an.includes('chair')) { hasChairAnc = true; break; }
              anc = anc.parent;
            }
            if (hasChairAnc) return; // let the ancestor be the chair group
          }

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

            // Store original emissive so we can restore after hover (only once)
            if (!this._chairOriginalEmissive.has(descendant)) {
              this._chairOriginalEmissive.set(descendant, {
                emissive: descendant.material.emissive.clone(),
                intensity: descendant.material.emissiveIntensity || 0
              });
            }

            meshes.push(descendant);
            if (!this._chairs.includes(descendant)) {
              this._chairs.push(descendant);
            }
            // Innermost chair-named ancestor (last write in traverse order wins)
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
      z-index: 9999;
      padding: 6px 12px;
      background: rgba(29, 21, 43, 0.9);
      color: #e0d8f0;
      border: 1px solid #8899cc;
      pointer-events: auto;
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
      // GOD VIEW button: handle here as fallback in case click event is swallowed
      if (e.target && e.target.closest && e.target.closest('#btn-volver-teatro')) {
        this._onVolver();
        this._dragStart = null;
        return;
      }
      if (!this._isDragging && this._dragStart) {
        try { this._onClick(e); } catch (err) { console.warn("CLICK ERROR:", err.message); }
      }
      this._dragStart = null;
    };

    this._handlers.btnClick = (e) => {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      this._onVolver();
    };
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
    this._btnVolver.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    this._btnVolver.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    this._btnVolver.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this._onVolver();
    }, { passive: false });
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
    // Only raycast against registered chair meshes to avoid hitting floor/walls
    if (this._chairs.length === 0) return;
    const intersects = this._raycaster.intersectObjects(this._chairs, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      const hitPoint = intersects[0].point.clone();
      // Find the chair group this mesh belongs to
      const chairGroup = this._chairGroupOf.get(hitMesh);
      if (chairGroup) {
        uiSound.chair();
        this._sitOnChair(chairGroup, hitPoint);
      }
    }
  },

  _sitOnChair(chairGroup, hitPoint) {
    this._isSeated = true;
    this._btnVolver.style.display = 'block';

    if (this._video) {
      this._video.muted = false;
      this._video.volume = 0.5;
      if (this._video.paused) this._video.play().catch(e => console.log(e));
    }

    // Use the chair's BOUNDING BOX (world space) to compute the seat position.
    // chairGroup.getWorldPosition() returns the transform origin, which in the
    // new teatro.glb is baked to different spots per chair (causing back-row
    // clicks to land on middle-row and middle-row to jump upward). The bbox
    // centroid is stable regardless of the group's local pivot.
    const bbox = new THREE.Box3().setFromObject(chairGroup);
    const bboxCenter = bbox.getCenter(new THREE.Vector3());
    const seatTopY   = bbox.max.y;           // top of the chair
    const seatBaseY  = bbox.min.y;           // floor the chair sits on
    // Seated eye height ≈ seat surface + 0.9. Approximate seat surface as
    // 55% up the chair height (typical chair proportion seat/backrest).
    const seatSurfaceY = seatBaseY + (seatTopY - seatBaseY) * 0.55;
    const chairPos = new THREE.Vector3(bboxCenter.x, seatSurfaceY + 0.9, bboxCenter.z);
    if (chairPos.y < 1.0) chairPos.y = 1.0;

    // Fixed look target — avoids inconsistent OrbitControls behaviour caused
    // by varying pizarra world positions per row/chair.
    const lookPos = new THREE.Vector3(0, 1.5, -5);

    this._orbitControls.enabled = false;
    this._isAnimating = true;

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
        onUpdate: () => { this.camera.lookAt(this._orbitControls.target); },
        onComplete: () => {
          this._isAnimating = false;
          // Explicitly pin camera to the computed seat position and re-derive
          // OrbitControls' internal spherical from the new camera/target pair
          // so the first update() after re-enabling doesn't snap the camera.
          this.camera.position.copy(chairPos);
          this.camera.lookAt(lookPos);
          this._orbitControls.target.copy(lookPos);
          this._orbitControls.update();
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
      this._isAnimating = false;
    }
  },

  _onVolver() {
    this._btnVolver.style.display = 'none';
    this._orbitControls.enabled = false;
    this._isAnimating = true;

    // Restore orbit distance limits before animating back
    this._orbitControls.minDistance = 0.1;
    this._orbitControls.maxDistance = 100;

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
        onUpdate: () => { this.camera.lookAt(this._orbitControls.target); },
        onComplete: () => {
          this._isAnimating = false;
          this._orbitControls.enabled = true;
          this._isSeated = false;
          // Sync orbit internal state with the new camera/target
          this._orbitControls.update();
        }
      });
    } else {
      this.camera.position.copy(this._initialCameraPos);
      this._orbitControls.target.copy(this._initialTargetPos);
      this._orbitControls.update();
      this._orbitControls.enabled = true;
      this._isSeated = false;
      this._isAnimating = false;
    }
  },

  update(_time) {
    // Skip orbit update during GSAP camera transitions —
    // OrbitControls.update() recalculates camera position from internal
    // spherical state, which fights with GSAP animating camera.position.
    if (this._orbitControls && !this._isAnimating) this._orbitControls.update();
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

/* ═══════════════════════════════════════════════════
   WORLD 02 — ARRAY-3D  (PROCESIÓN)
   50 SkinnedMesh figures marching in formation.
   Uses THREE.SkeletonUtils for proper skeletal cloning.
   ═══════════════════════════════════════════════════ */

const COUNT = 50;

export default {
  id: '2',
  scene: null,
  camera: null,

  _renderer: null,
  _orbitControls: null,
  _handlers: {},
  _raycaster: null,
  _mouse: null,
  
  _instances: [], // Array of { id, group, mixer, meshes }
  _lastHovered: -1,

  _textImages: [
    'assets/texto/text1.png',
    'assets/texto/text2.png',
    'assets/texto/text3.png'
  ],
  _spawnedTexts: [],

  _active: false,

  /* ────────────────────── INIT ────────────────────── */
  init(renderer, composer) {
    this._renderer = renderer;
    this._handlers = {};
    this._instances = [];
    this._hitboxes = [];
    this._lastHovered = -1;
    this._spawnedTexts = [];
    this._active = true;

    const W = renderer.domElement.clientWidth;
    const H = renderer.domElement.clientHeight;

    // ── Scene ──
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06080f);
    this.scene.fog = new THREE.Fog(0x06080f, 18, 40);

    // ── Camera ──
    this.camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    this.camera.position.set(0, 3, 12);
    this.camera.lookAt(0, 1, 0);

    // ── Lighting ──
    this.scene.add(new THREE.AmbientLight(0x334466, 1.5));
    const dirLight = new THREE.DirectionalLight(0x7d85b4, 1.2);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    // ── Floor ──
    const floorGeo = new THREE.PlaneGeometry(30, 60);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x080c14, roughness: 0.9, metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    this.scene.add(floor);

    // ── Raycaster ──
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();

    // ── OrbitControls ──
    this._orbitControls = new THREE.OrbitControls(this.camera, renderer.domElement);
    this._orbitControls.enableDamping   = true;
    this._orbitControls.dampingFactor   = 0.06;
    this._orbitControls.enableZoom      = false;
    this._orbitControls.enablePan       = false;
    this._orbitControls.minPolarAngle   = Math.PI * 0.1;
    this._orbitControls.maxPolarAngle   = Math.PI * 0.55;
    this._orbitControls.autoRotate      = true;
    this._orbitControls.autoRotateSpeed = 0.3;
    this._orbitControls.target.set(0, 1, 0);

    // ── Event handlers ──
    this._handlers.down = () => {
      if (!this._active) return;
      if (this._orbitControls) this._orbitControls.autoRotate = false;
    };

    this._handlers.up = (e) => {
      if (!this._active) return;
      
      // Auto-rotate restore
      setTimeout(() => { if (this._orbitControls && this._active) this._orbitControls.autoRotate = true; }, 3000);

      // Igniting only when clicking directly on one of the 50 characters
      if (e.target.closest('#world-nav') || e.target.closest('#character-panel')) return;
      
      if (!this.scene || this._instances.length === 0) return;
      
      const rect = renderer.domElement.getBoundingClientRect();
      let clientX = e.clientX;
      let clientY = e.clientY;

      if (e.touches && e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      } else if (e.changedTouches && e.changedTouches.length > 0) {
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
      }
      
      this._mouse.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
      this._mouse.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
      
      this._raycaster.setFromCamera(this._mouse, this.camera);
      
      const hits = this._raycaster.intersectObjects(this._hitboxes, false);
      
      if (hits.length > 0) {
         this._spawnText();
      }
    };

    this._handlers.pointermove = (e) => {
      if (!this._active || !this.scene || this._instances.length === 0) return;
      
      const rect = renderer.domElement.getBoundingClientRect();
      let clientX = e.clientX;
      let clientY = e.clientY;
      
      // Handle touch move as well
      if (e.touches && e.touches.length > 0) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
      }

      this._mouse.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
      this._mouse.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
      
      this._raycaster.setFromCamera(this._mouse, this.camera);
      
      const hits = this._raycaster.intersectObjects(this._hitboxes, false);

      let hoveredId = -1;
      if (hits.length > 0 && hits[0].object.userData) {
        hoveredId = hits[0].object.userData.instanceId;
      }

      // Update hover states
      if (this._lastHovered !== hoveredId) {
          // Restore previous
          if (this._lastHovered !== -1 && this._lastHovered !== undefined) {
              const prevInst = this._instances[this._lastHovered];
              if (prevInst) {
                  prevInst.group.scale.set(1, 1, 1);
                  prevInst.mixer.timeScale = 1.0; // Unfreeze
                  prevInst.meshes.forEach(m => {
                      if (m.material.emissive) m.material.emissive.setHex(0x2a2d4a);
                      if (m.material.color) m.material.color.setHex(0x7d85b4);
                  });
              }
          }
          
          // Apply new hover
          if (hoveredId !== -1 && hoveredId !== undefined) {
              const newInst = this._instances[hoveredId];
              if (newInst) {
                  newInst.group.scale.set(1.08, 1.08, 1.08); // Scale slightly
                  newInst.mixer.timeScale = 0.0; // Freeze animation strictly
                  newInst.meshes.forEach(m => {
                      if (m.material.emissive) m.material.emissive.setHex(0xaaddff); // Super bright flash
                      if (m.material.color) m.material.color.setHex(0xffffff);
                  });
              }
              document.body.style.cursor = 'pointer';
          } else {
              document.body.style.cursor = 'default';
          }
          
          this._lastHovered = hoveredId;
      }
    };

    // Attach to document globally to guarantee capture despite DOM overlays
    document.addEventListener('pointerdown', this._handlers.down);
    document.addEventListener('pointerup',   this._handlers.up);
    document.addEventListener('touchend',    this._handlers.up, {passive: false}); // mobile click support
    document.addEventListener('pointermove', this._handlers.pointermove);

    // ── Load GLB ──
    const loader = new THREE.GLTFLoader();
    loader.load(
      'assets/walkloop.glb',
      (gltf) => { this._setupRealInstances(gltf); },
      undefined,
      (err) => {
        console.warn('WorldParade: GLTF failed, using fallback configuration:', err);
      }
    );
  },

  /* ──────────── Proper SkinnedMesh Cloning ──────────── */
  _setupRealInstances(gltf) {
    if (!gltf.scene || !gltf.animations || !gltf.animations.length) {
        console.warn("WorldParade: Model is missing scene or animation tracks.");
        return;
    }

    const clip = gltf.animations[0];
    const baseScene = gltf.scene;
    
    // Normalize and prepare materials on the base template to ensure standard interactions
    baseScene.traverse(child => {
        if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
                color: 0x7d85b4,
                emissive: 0x2a2d4a,
                roughness: 0.8,
                metalness: 0.2,
                skinning: true // Crucial for SkinnedMesh animations
            });
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    const hitboxGeo = new THREE.CylinderGeometry(0.5, 0.5, 2.5, 8);
    hitboxGeo.translate(0, 1.25, 0); // elevate from feet to body center
    const hitboxMat = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0,
        depthWrite: false
    });

    for (let i = 0; i < COUNT; i++) {
        // THREE.SkeletonUtils strictly required for deep clone of bones + skinned meshes
        let clone;
        if (THREE.SkeletonUtils && THREE.SkeletonUtils.clone) {
            clone = THREE.SkeletonUtils.clone(baseScene);
        } else {
            console.error("THREE.SkeletonUtils not found! Ensure it is included in index.html.");
            return;
        }
      
        const row = Math.floor(i / 10);
        const col = i % 10;
        const x = (col - 4.5) * 2.0 + (Math.random() - 0.5) * 0.5;
        const z = (row - 2.5) * 2.5 + (Math.random() - 0.5) * 0.8;
      
        clone.position.set(x, 0, z);
      
        // Setup isolated animation mixer
        const mixer = new THREE.AnimationMixer(clone);
        const action = mixer.clipAction(clip);
      
        // Start at random phase to avoid sync stepping out of 50 models
        action.startAt(Math.random() * 2);
        action.play();
      
        this.scene.add(clone);
      
        const instanceData = {
            id: i,
            group: clone,
            mixer: mixer,
            meshes: []
        };
      
        // Map meshes for individual raycast tagging
        clone.traverse(child => {
           if (child.isMesh) {
               child.userData.instanceId = i; 
               instanceData.meshes.push(child);
           } 
        });
        
        // Inject invisible Hitbox
        const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
        hitbox.userData.instanceId = i;
        clone.add(hitbox);
        this._hitboxes.push(hitbox);
      
        this._instances.push(instanceData);
    }
    
    console.log('WorldParade: 50 SkinnedMeshes cloned and animated.');
  },

  /* ──────────── Spawn text overlay ──────────── */
  _spawnText() {
    let container = document.getElementById('text-overlay-container');
    
    // Si no existe, crearlo y agregarlo al canvas-area
    if (!container) {
      container = document.createElement('div');
      container.id = 'text-overlay-container';
      container.style.cssText = `
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 10;
        overflow: hidden;
      `;
      const canvasArea = document.getElementById('canvas-area') 
        || document.getElementById('carousel-container') 
        || document.body;
      canvasArea.appendChild(container);
    }

    const src = this._textImages[Math.floor(Math.random() * this._textImages.length)];
    const img = document.createElement('img');
    img.src       = src;
    img.className = 'floating-text';

    // Random viewport position
    const randX = (5 + Math.random() * 40);
    const randY = (10 + Math.random() * 70);
    img.style.left = randX + '%';
    img.style.top  = randY + '%';

    // Subtle random rotation
    const rotation = (Math.random() - 0.5) * 6;
    img.style.transform = 'rotate(' + rotation + 'deg)';

    container.appendChild(img);
    this._spawnedTexts.push(img);
    console.log('[WorldParade] texto spawneado:', src, 'en', randX.toFixed(1), randY.toFixed(1));
  },

  /* ──────────── UPDATE ──────────── */
  update(time, keys) {
    if (!this.scene || !this.camera) return;

    if (this._orbitControls) this._orbitControls.update();

    // Calculate real deltaTime instead of fixed 1/60 to prevent jumpiness
    if (this._lastTime === undefined) this._lastTime = time;
    let dt = time - this._lastTime;
    
    // Safety cap for delta time if resuming tab
    if (dt > 0.1) dt = 0.016; 
    this._lastTime = time;

    const ADVANCE_SPEED = 1.2;
    const LOOP_DEPTH = 30; // 30 units total depth
    const START_Z = -15;

    for (let i = 0; i < this._instances.length; i++) {
        const inst = this._instances[i];
        if (inst && inst.mixer) {
            inst.mixer.update(dt);
        }
        
        // Physically translate them forward to match the "marching" intent
        if (inst && inst.group) {
            inst.group.position.z += ADVANCE_SPEED * dt;
            if (inst.group.position.z > START_Z + LOOP_DEPTH) {
                inst.group.position.z -= LOOP_DEPTH;
            }
        }
    }

    // Render our scene natively
    if (this._renderer) {
      this._renderer.render(this.scene, this.camera);
    }
  },

  /* ──────────── DISPOSE ──────────── */
  dispose() {
    this._active = false;
    if (this._handlers) {
      if (this._handlers.down)        document.removeEventListener('pointerdown', this._handlers.down);
      if (this._handlers.click)       document.removeEventListener('click',       this._handlers.click);
      if (this._handlers.click)       document.removeEventListener('touchstart',  this._handlers.click);
      if (this._handlers.pointermove) document.removeEventListener('pointermove', this._handlers.pointermove);
      document.body.style.cursor = 'default';
    }

    if (this._orbitControls) {
      this._orbitControls.dispose();
      this._orbitControls = null;
    }

    // Clean up spawned text DOM elements
    const container = document.getElementById('text-overlay-container');
    if (container) {
      this._spawnedTexts.forEach(img => {
        if (img.parentNode) img.parentNode.removeChild(img);
      });
    }
    this._spawnedTexts = [];

    // Dispose Three.js objects
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

    this.scene = null;
    this.camera = null;
    
    if (this._instances) {
        this._instances.forEach(inst => {
            if (inst.mixer) {
                inst.mixer.stopAllAction();
                if (inst.group) {
                    inst.mixer.uncacheRoot(inst.group);
                }
            }
        });
    }
    this._instances = [];
  }
};

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
    this.scene.background = new THREE.Color(0x020612);
    this.scene.fog = new THREE.Fog(0x00061a, 10, 32);

    // ── Camera — FOV 50, pulled back, 28° extra X tilt for lower angle ──
    this.camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    this.camera.position.set(0, 6, 10);
    this.camera.lookAt(0, 0.5, 0);
    // Extra 28° downward pitch for lower camera angle
    this.camera.rotateX(-THREE.MathUtils.degToRad(28));

    // ── Lighting ──
    this.scene.add(new THREE.AmbientLight(0x334466, 2.0));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x7d85b4, 0.8);
    fillLight.position.set(-5, 3, 8);
    this.scene.add(fillLight);

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

    // ── OrbitControls — disabled, camera is fixed ──
    this._orbitControls = new THREE.OrbitControls(this.camera, renderer.domElement);
    this._orbitControls.enabled       = false;
    this._orbitControls.enableZoom    = false;
    this._orbitControls.enablePan     = false;
    this._orbitControls.enableRotate  = false;
    this._orbitControls.autoRotate    = false;
    this._orbitControls.target.set(0, 1.5, 0);

    // ── Event handlers ──
    this._handlers.down = () => {};

    this._handlers.up = (e) => {
      if (!this._active) return;

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

      // Update hover states — freeze animation + electric blue glow
      if (this._lastHovered !== hoveredId) {
          // Restore previous
          if (this._lastHovered !== -1 && this._lastHovered !== undefined) {
              const prevInst = this._instances[this._lastHovered];
              if (prevInst) {
                  prevInst.mixer.timeScale = 1.0;
                  prevInst.origEmissive.forEach(o => {
                      if (o.mat.emissive) o.mat.emissive.copy(o.emissive);
                      o.mat.emissiveIntensity = o.intensity;
                  });
              }
          }

          // Apply new hover — freeze + electric blue emissive
          if (hoveredId !== -1 && hoveredId !== undefined) {
              const newInst = this._instances[hoveredId];
              if (newInst) {
                  newInst.mixer.timeScale = 0.0;
                  newInst.origEmissive.forEach(o => {
                      if (o.mat.emissive) o.mat.emissive.setHex(0x00aaff);
                      o.mat.emissiveIntensity = 2.0;
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
    document.addEventListener('pointermove', this._handlers.pointermove);

    // ── Load GLB ──
    const loader = new THREE.GLTFLoader();
    loader.load(
      'assets/walk.glb',
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

    // Ensure shadows on the base template — do NOT replace materials (preserve GLB textures)
    baseScene.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    const hitboxGeo = new THREE.CylinderGeometry(0.38, 0.38, 1.6, 8);
    hitboxGeo.translate(0, 0.8, 0); // elevate from feet to mid-body
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

        // Clone materials per instance so hover on one doesn't affect others
        clone.traverse(child => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(m => m.clone());
                } else {
                    child.material = child.material.clone();
                }
            }
        });

        // Store original emissive per mesh for hover restore
        const origEmissive = [];
        clone.traverse(child => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => {
                    origEmissive.push({
                        mat: m,
                        emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0),
                        intensity: m.emissiveIntensity || 0
                    });
                });
            }
        });
      
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
            meshes: [],
            origEmissive
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

    // Only update animation mixers — characters stay in place (in-place animation only)
    for (let i = 0; i < this._instances.length; i++) {
        const inst = this._instances[i];
        if (inst && inst.mixer) {
            inst.mixer.update(dt);
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
      if (this._handlers.up)          document.removeEventListener('pointerup',   this._handlers.up);
      if (this._handlers.up)          document.removeEventListener('touchend',    this._handlers.up);
      if (this._handlers.click)       document.removeEventListener('click',       this._handlers.click);
      if (this._handlers.click)       document.removeEventListener('touchstart',  this._handlers.click);
      if (this._handlers.pointermove) document.removeEventListener('pointermove', this._handlers.pointermove);
      this._handlers = {};
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

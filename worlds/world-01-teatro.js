const WorldTeatro = {
  scene: null,
  camera: null,
  _renderer: null,
  _orbitControls: null,
  _video: null,
  _videoTex: null,
  _chairs: [],
  _pizarra: null,
  _raycaster: new THREE.Raycaster(),
  _mouse: new THREE.Vector2(),
  _handlers: {},
  _btnVolver: null,
  _isSeated: false,
  _initialCameraPos: new THREE.Vector3(6, 5, 10),
  _initialTargetPos: new THREE.Vector3(0, 1.0, 0),

  init(renderer, composer) {
    this._renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x110d17);
    this.scene.fog = new THREE.FogExp2(0x110d17, 0.05);

    const W = renderer.domElement.clientWidth;
    const H = renderer.domElement.clientHeight;

    this.camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    this.camera.position.copy(this._initialCameraPos);

    this._orbitControls = new THREE.OrbitControls(this.camera, renderer.domElement);
    this._orbitControls.enableDamping = true;
    this._orbitControls.dampingFactor = 0.05;
    this._orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
    this._orbitControls.target.copy(this._initialTargetPos);

    // Luces
    this.scene.add(new THREE.AmbientLight(0x333344, 2.0));
    const dirLight = new THREE.DirectionalLight(0xb0d8ee, 1.5);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);
    
    // Fill light
    const fillLight = new THREE.PointLight(0x8899cc, 1.2, 20);
    fillLight.position.set(0, 3, 2);
    this.scene.add(fillLight);

    // Load Video
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

    // Material para la pizarra
    const screenMaterial = new THREE.MeshBasicMaterial({ map: this._videoTex });

    // Load GLB
    const loader = new THREE.GLTFLoader();
    loader.load('assets/teatro.glb', (gltf) => {
      this.scene.add(gltf.scene);
      
      // Ajustar escala y posición del teatro (si es necesario)
      // gltf.scene.scale.set(1.5, 1.5, 1.5);
      
      let screenFound = false;

      gltf.scene.traverse((child) => {
          const name = child.name.toLowerCase();
          
          // Identify Pizarra
          if (child.isMesh && (name.includes('pizarra') || name.includes('board') || name.includes('screen'))) {
            this._pizarra = child;
            child.material = screenMaterial;
            screenFound = true;
          }
          
          // Identify Chairs & mark ALL descendants
          if (name.includes('silla') || name.includes('chair')) {
            child.traverse((descendant) => {
               if (descendant.isMesh && !this._chairs.includes(descendant)) {
                   this._chairs.push(descendant);
               }
            });
          }
          
          // Add environment reflections or material tweaks
          if (child.isMesh && child.material && child.material.isMeshStandardMaterial) {
              child.material.envMapIntensity = 1.0;
              child.material.needsUpdate = true;
          }
      });

      // Si no encontró algo llamado 'pizarra', usamos el primer mesh grande como fallback
      if (!screenFound && gltf.scene.children.length > 0) {
         console.warn("No 'pizarra' found in GLB by name. You may need to verify mesh names.");
      }
      
    }, undefined, (e) => console.error("Error loading teatro.glb", e));

    // UI Button
    this._btnVolver = document.createElement('button');
    this._btnVolver.id = 'btn-volver-teatro';
    this._btnVolver.textContent = '◀ GOD VIEW';
    this._btnVolver.style.padding = '6px 12px';
    this._btnVolver.style.background = 'rgba(29, 21, 43, 0.9)';
    this._btnVolver.style.color = '#e0d8f0';
    this._btnVolver.style.border = '1px solid #8899cc';
    this._btnVolver.style.borderRadius = '6px';
    this._btnVolver.style.cursor = 'pointer';
    this._btnVolver.style.display = 'none';
    this._btnVolver.style.fontFamily = "'Orbitron', 'Share Tech Mono', monospace";
    this._btnVolver.style.fontSize = '11px';
    this._btnVolver.style.fontWeight = 'bold';
    this._btnVolver.style.marginLeft = '8px';
    // Insertar botón dentro de #world-nav
    const worldNav = document.getElementById('world-nav');
    if (worldNav) {
        worldNav.appendChild(this._btnVolver);
    } else {
        document.body.appendChild(this._btnVolver);
    }

    this._handlers.down = (e) => {
        if(e.target && e.target.closest && (e.target.closest('#hud-header') || e.target.closest('#hud-footer') || e.target.closest('#btn-volver-teatro'))) return;
        this._isDragging = false;
        this._dragStart = { x: e.clientX, y: e.clientY };
    };
    this._handlers.move = (e) => {
        try {
            if (this._dragStart) {
                const dx = e.clientX - this._dragStart.x;
                const dy = e.clientY - this._dragStart.y;
                if (Math.sqrt(dx*dx + dy*dy) > 4) {
                    this._isDragging = true;
                }
            }
            // Retiramos el check de _isSeated para que pueda ver la info (y cambiar de silla) sentado
            const rect = this._renderer.domElement.getBoundingClientRect();
            this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            this._raycaster.setFromCamera(this._mouse, this.camera);
            
            const intersects = this._raycaster.intersectObjects(this.scene.children, true);
            if (intersects.length > 0) {
                let obj = intersects[0].object;
                let parentChain = [];
                let current = obj;
                while(current) { parentChain.push(current.name); current = current.parent; }
            }
        } catch(err) {
            console.warn("MOVE ERROR:", err.message);
        }
    };
    this._handlers.up = (e) => {
        if (!this._isDragging && this._dragStart) {
            try { this._onClick(e); } catch(err) { console.warn("CLICK ERROR:", err.message); }
        }
        this._dragStart = null;
    };
    
    this._handlers.btnClick = () => this._onVolver();
    this._handlers.touch = (e) => { if(e.touches.length > 0 && !this._isDragging) { this._onClick(e.touches[0]); this._handlers.move(e.touches[0]); }};
    
    window.addEventListener('mousedown', this._handlers.down);
    window.addEventListener('mousemove', this._handlers.move);
    window.addEventListener('mouseup', this._handlers.up);
    window.addEventListener('touchstart', this._handlers.touch, {passive: false});
    this._btnVolver.addEventListener('click', this._handlers.btnClick);
  },

  _onClick(e) {    
    const rect = this._renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, this.camera);
    
    // Check against the WHOLE SCENE to see everything
    const intersects = this._raycaster.intersectObjects(this.scene.children, true);

    for (let i = 0; i < intersects.length; i++) {
        let obj = intersects[i].object;
        let isChair = false;
        let current = obj;
        while(current) {
            let n = current.name.toLowerCase();
            if (n.includes('silla') || n.includes('chair')) {
                isChair = true;
                break;
            }
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

    // Desmuteamos video una vez que el usuario iteractúa para respetar autoplay poliicies
    if (this._video) {
        this._video.muted = false;
        this._video.volume = 0.5;
        if (this._video.paused) {
          this._video.play().catch(e => console.log(e));
        }
    }

    // Usar Box3 para obtener el centro exacto de la silla, por si el origen del Mesh es (0,0,0)
    const box = new THREE.Box3().setFromObject(chairMesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    // Offset típico: altura de la cabeza (Y) y ligeramente atrás (Z)
    const chairPos = center.clone();
    chairPos.y += 0.8; 
    
    // Movemos Z en dirección a la cámara inicialmente para asegurarnos de estar "frente" al pizarrón
    // Asumiendo que la pizarra está en z negativo, sumamos Z para sentarnos.
    chairPos.z += 0.8;
    
    if (chairPos.y < 1.0) chairPos.y = 1.0;

    const lookPos = new THREE.Vector3();
    if (this._pizarra) {
      this._pizarra.getWorldPosition(lookPos);
    } else {
      lookPos.set(0, 1.5, -5);
    }

    this._orbitControls.enabled = false;

    // Si ya hay una animación en curso de GSAP para la cámara, la sobrescribimos
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
          // Restringimos movimiento para q no salga de la silla pero pueda observar
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
    
    // Al sentarnos en cualquier silla, aseguremos que el cursor no esté restringido si no es necesario,
    // pero OrbitControls ya restringe maxDistance.
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

  update(time) {
    if (this._orbitControls) this._orbitControls.update();
    if (this._renderer) {
      // Clear manual para evitar sobre-escritura con el composer u otros contextos
      this._renderer.clear();
      this._renderer.render(this.scene, this.camera);
    }
  },

  dispose() {
    if (this._renderer) {
        window.removeEventListener('mousedown', this._handlers.down);
        window.removeEventListener('mousemove', this._handlers.move);
        window.removeEventListener('mouseup', this._handlers.up);
        window.removeEventListener('touchstart', this._handlers.touch);
    }
    if (this._btnVolver) {
        this._btnVolver.removeEventListener('click', this._handlers.btnClick);
        this._btnVolver.remove();
        this._btnVolver = null;
    }
    if (this._orbitControls) {
        this._orbitControls.dispose();
    }
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
    this._chairs = [];
    this._isSeated = false;
  }
};

export default WorldTeatro;

import { uiSound } from '../audio/uiSounds.js?v=2'

const WorldBanera = {

  scene:          null,
  bloomScene:     null,
  camera:         null,
  _renderer:      null,
  _localComposer: null,
  _orbitControls: null,
  _waterUniforms: null,
  _wordMaterial:  null,
  _wordPlaneMesh: null,
  _eggLight:      null,
  _eggs:          [],
  _handlers:      {},
  _volLightMesh:  null,
  _volLightUniforms: null,
  _floorMesh:     null,
  _floorTex:      null,

  // ─────────────────────────────────────────
  init(renderer, composer) {
    this._renderer = renderer
    this._eggs = []
    this._handlers = {}

    // Extra ambient bubble layer — quieter than the main music layers.
    uiSound.startLoop('bubbles78', 0.18, 1.6)

    const W = renderer.domElement.clientWidth
    const H = renderer.domElement.clientHeight

    // ── CÁMARA — moderate fisheye, closer to bathtub ──
    // FOV: 80 | position: (0, 1.4, 1.4) | lookAt: (0, 0.0, 0)
    this.camera = new THREE.PerspectiveCamera(80, W / H, 0.1, 100)
    // Rotada 180° alrededor de la bañera: ahora desde -z mirando hacia +z.
    this.camera.position.set(0, 1.4, -1.4)
    this.camera.lookAt(0, 0.0, 0)

    // ── ESCENA BASE ──
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x04080f)
    this.scene.fog = new THREE.FogExp2(0x04080f, 0.09)

    // ── ILUMINACIÓN EN ESCENA BASE ──
    this.scene.add(new THREE.AmbientLight(0x445566, 2.0))

    const dirLight = new THREE.DirectionalLight(0x6699bb, 0.8)
    dirLight.position.set(3, 6, 4)
    this.scene.add(dirLight)

    // ── AREA LIGHTS alrededor de la bañera (iluminan el exterior) ──
    const areaColor = 0x99aabb
    const areaIntensity = 6
    const areaW = 3, areaH = 2

    // Frontal
    const areaFront = new THREE.RectAreaLight(areaColor, areaIntensity, areaW, areaH)
    areaFront.position.set(0, 1.5, 3)
    areaFront.lookAt(0, 0.2, 0)
    this.scene.add(areaFront)

    // Trasera
    const areaBack = new THREE.RectAreaLight(areaColor, areaIntensity, areaW, areaH)
    areaBack.position.set(0, 1.5, -3)
    areaBack.lookAt(0, 0.2, 0)
    this.scene.add(areaBack)

    // Izquierda
    const areaLeft = new THREE.RectAreaLight(areaColor, areaIntensity, areaW, areaH)
    areaLeft.position.set(-3, 1.5, 0)
    areaLeft.lookAt(0, 0.2, 0)
    this.scene.add(areaLeft)

    // Derecha
    const areaRight = new THREE.RectAreaLight(areaColor, areaIntensity, areaW, areaH)
    areaRight.position.set(3, 1.5, 0)
    areaRight.lookAt(0, 0.2, 0)
    this.scene.add(areaRight)

    // ── Luz superior cenital ──
    const topLight = new THREE.RectAreaLight(0xaabbcc, 4, 4, 3)
    topLight.position.set(0, 4, 0)
    topLight.lookAt(0, 0, 0)
    this.scene.add(topLight)

    // PointLight en posición central entre los dos huevos
    this._eggLight = new THREE.PointLight(0x88ccff, 3.0, 6)
    this._eggLight.position.set(-0.02, 0.24, 0)
    this.scene.add(this._eggLight)

    // ── COMPOSER LOCAL (sin bloom — godrays eliminados) ──
    this._localComposer = new THREE.EffectComposer(renderer)
    this._localComposer.addPass(new THREE.RenderPass(this.scene, this.camera))

    // ── CARGAR GLB ──
    const loader = new THREE.GLTFLoader()
    loader.load(
      'assets/3D/baneraLow.glb?v=2',
      (gltf) => {
        // Add the whole scene to the base scene
        this.scene.add(gltf.scene)
        
        const toMove = []
        gltf.scene.traverse((child) => {
          if (!child.isMesh) return

          const name = (child.name || '').toLowerCase()
          const parentName = (child.parent?.name || '').toLowerCase()

          if (name.includes('huevo') || parentName.includes('huevo')) {
            // ── HUEVO: material emisivo para bloom ──
            child.material = new THREE.MeshStandardMaterial({
              color: 0x000000,
              emissive: new THREE.Color(0x88ccff),
              emissiveIntensity: 3.5,
              roughness: 0.1,
              metalness: 0.0
            })
            
            toMove.push(child)
            this._eggs.push(child)

          } else if (
            name.includes('plane') || name.includes('plano') ||
            name.includes('agua')  || name.includes('water') ||
            name.includes('surface') || name.includes('sup') ||
            name.includes('liquid') || name.includes('wave')
          ) {
            // ── WATER SURFACE: aplicar textura de palabras en movimiento ──
            if (this._wordMaterial) {
              child.material = this._wordMaterial
              this._wordPlaneMesh = child
            }
          } else {
            // ── BAÑERA u otros: mantener texturas baked del GLB ──
            if (child.material) {
              child.material.roughness = 0.18
              child.material.metalness = 0.08
              child.material.envMapIntensity = 1.2
            }
          }
        })
        
        toMove.forEach(egg => {
            // Keep them in the base scene since we're using threshold bloom now
            this.scene.add(egg)
        })

        // Log del mesh donde se aplicó el shader del agua (para debug)
        if (this._wordPlaneMesh) {
          console.log('[Fetal] water shader aplicado a mesh:', this._wordPlaneMesh.name)
        } else {
          console.warn('[Fetal] no se encontró mesh de agua en el GLB — listado de meshes:')
          gltf.scene.traverse(c => { if (c.isMesh) console.warn('  -', c.name) })
        }
      },
      undefined,
      (err) => {
        console.error('Error cargando baneraLow.glb:', err)
        this._createFallback()
      }
    )

    // ── WORD TEXTURE (se aplica al plane del GLB) ──
    this._createWordMaterial()

    // Volumetric cone removed (replaced by god-rays bloom effect)

    // ── FLOOR (studyingMyPain.png) ──
    this._createFloor()

    // ── ORBIT CONTROLS ──
    this._orbitControls = new THREE.OrbitControls(this.camera, renderer.domElement)
    this._orbitControls.enableDamping    = true
    this._orbitControls.dampingFactor    = 0.06
    this._orbitControls.enableZoom       = false
    this._orbitControls.enablePan        = false
    this._orbitControls.minPolarAngle    = Math.PI * 0.12
    this._orbitControls.maxPolarAngle    = Math.PI * 0.52
    this._orbitControls.rotateSpeed      = 0.5
    this._orbitControls.autoRotate       = false
    this._orbitControls.autoRotateSpeed  = 0
    this._orbitControls.target.set(0, 0.2, 0)
  },

  // ─────────────────────────────────────────
  _createWordMaterial() {
    // Load watertext.png as the water surface texture (lowercase!)
    const texLoader = new THREE.TextureLoader()
    const tex = texLoader.load(
      'assets/texto/watertext.png',
      (t)   => console.log('[Fetal] watertext.png cargado:', t.image.width, 'x', t.image.height),
      undefined,
      (err) => console.error('[Fetal] error cargando watertext.png:', err)
    )
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1.0, 1.0)
    tex.premultiplyAlpha = false
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter

    this._waterUniforms = {
      uTime:     { value: 0.0 },
      uTexture:  { value: tex },
      uWaveAmp:  { value: 0.045 },
      uWaveFreq: { value: 4.0 },
      uSpeed:    { value: 0.35 },
      uOpacity:  { value: 0.82 }
    }

    const mat = new THREE.ShaderMaterial({
      uniforms:    this._waterUniforms,
      transparent: true,
      depthWrite:  false,
      side:        THREE.DoubleSide,
      vertexShader: `
        uniform float uTime;
        uniform float uWaveAmp;
        uniform float uWaveFreq;
        uniform float uSpeed;
        varying vec2  vUv;
        varying float vWave;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float w1 = sin(pos.x * uWaveFreq       + uTime * uSpeed)        * uWaveAmp;
          float w2 = sin(pos.z * uWaveFreq * 0.7 + uTime * uSpeed * 1.3)  * uWaveAmp * 0.5;
          float w3 = sin((pos.x + pos.z) * uWaveFreq * 0.4 + uTime * 0.6) * uWaveAmp * 0.3;
          pos.y += w1 + w2 + w3;
          vWave  = (w1 + w2 + w3) / (uWaveAmp * 1.8);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform float     uTime;
        uniform float     uSpeed;
        uniform float     uOpacity;
        varying vec2      vUv;
        varying float     vWave;
        void main() {
          // Flip horizontal: palabras se leen en el sentido correcto
          // (custom shaders ignoran tex.repeat/offset, por eso va acá).
          vec2 uv = vec2(1.0 - vUv.x, vUv.y);
          uv.x += sin(uv.y * 9.0 + uTime * uSpeed * 0.6) * 0.012;
          uv.y += cos(uv.x * 9.0 + uTime * uSpeed * 0.5) * 0.012;
          uv.x += uTime * 0.018;
          uv.y -= uTime * 0.012;

          vec4 tex = texture2D(uTexture, uv);

          // ── BASE: agua azul muy clarita ──
          vec3  base  = vec3(0.72, 0.86, 0.96);
          vec3  deep  = vec3(0.60, 0.80, 0.94);

          // Variación tonal del agua basada en las olas
          vec3 water = mix(base, deep, 0.5 + vWave * 0.5);

          // ── TEXTO NEGRO sobre fondo translúcido ──
          // El PNG tiene palabras negras (lum~0) con fondo transparente.
          // mask = (1 - lum) * tex.a → 1 solo donde hay texto opaco negro.
          float lum  = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
          float mask = (1.0 - lum) * tex.a;
          mask = clamp(mask * 1.4, 0.0, 1.0);

          // Color del texto: negro puro (conservar las palabras negras).
          vec3 textColor = vec3(0.0, 0.0, 0.0);

          // Combinar: el texto negro del PNG queda negro sobre agua celeste.
          vec3 color = mix(water, textColor, mask);

          // Brillo de la cresta de las olas (sutil, tono blanco)
          float crest = max(0.0, vWave) * 0.35;
          color += vec3(0.18, 0.22, 0.25) * crest;

          gl_FragColor = vec4(color, uOpacity);
        }
      `
    })

    // Store material — will be applied to the GLB plane mesh when loaded
    this._wordMaterial = mat
  },

  // ─────────────────────────────────────────
  _createFallback() {
    // Bañera procedural si el GLB no carga
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe0eaf2, roughness: 0.18, metalness: 0.06
    })
    // Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 1), mat)
    base.position.y = -0.3
    this.scene.add(base)
    // Paredes
    ;[[0, 0, 0.56], [0, 0, -0.56]].forEach(([x,y,z]) => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.08), mat)
      w.position.set(x, y - 0.05, z)
      this.scene.add(w)
    })
    ;[[-1.04, 0, 0], [1.04, 0, 0]].forEach(([x,y,z]) => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.12), mat)
      w.position.set(x, y - 0.05, z)
      this.scene.add(w)
    })
    // Huevos procedurales
    const eggMat = new THREE.MeshStandardMaterial({
      color: 0x000000, emissive: 0x88ccff, emissiveIntensity: 3.5
    })
    ;[[-0.32, 0.24, 0], [0.28, 0.24, 0]].forEach(([x,y,z]) => {
      const egg = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 24), eggMat)
      egg.scale.y = 1.3
      egg.position.set(x, y, z)
      this.scene.add(egg)
      this._eggs.push(egg)
    })
  },

  // ─────────────────────────────────────────
  _createFloor() {
    const textLoader = new THREE.TextureLoader()
    this._floorTex = textLoader.load('assets/tex/studyingMyPain.png')

    const floorMat = new THREE.MeshBasicMaterial({
      map: this._floorTex,
      side: THREE.DoubleSide,
    })
    const floorGeo = new THREE.PlaneGeometry(12, 12)  // double size
    this._floorMesh = new THREE.Mesh(floorGeo, floorMat)
    this._floorMesh.rotation.x = -Math.PI / 2
    this._floorMesh.position.set(0, -0.35, 0)
    this.scene.add(this._floorMesh)
  },

  // ─────────────────────────────────────────
  _createVolumetricLight() {
    // Inverted cone: wide at top (light source), narrow at bottom (bathtub)
    const coneH  = 7.0
    const coneR  = 2.8  // radius at the wide end
    const segments = 64

    const geo = new THREE.ConeGeometry(coneR, coneH, segments, 1, true)
    // Flip so the wide end is up
    geo.rotateX(Math.PI)

    this._volLightUniforms = {
      uTime:     { value: 0.0 },
      uColor:    { value: new THREE.Color(0xb0d8ee) },
      uOpacity:  { value: 0.36 }
    }

    const mat = new THREE.ShaderMaterial({
      uniforms:       this._volLightUniforms,
      transparent:    true,
      depthWrite:     false,
      side:           THREE.DoubleSide,
      blending:       THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        varying float vY;
        void main() {
          vUv = uv;
          vY  = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3  uColor;
        uniform float uOpacity;
        varying vec2  vUv;
        varying float vY;

        // Simple pseudo-random
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        // Value noise
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          // vUv.y: 0 at the wide top, 1 at the narrow bottom
          float fadeTop    = smoothstep(0.0, 0.05, vUv.y);
          float fadeBottom = 1.0 - smoothstep(0.6, 1.0, vUv.y);
          float edgeFade   = 1.0 - smoothstep(0.2, 0.48, abs(vUv.x - 0.5));

          // Animated vertical streaks (god rays)
          float angle = vUv.x * 6.2831853; // 0-2PI around the cone
          float streak1 = noise(vec2(angle * 3.0, vUv.y * 4.0 - uTime * 0.15)) * 0.7;
          float streak2 = noise(vec2(angle * 6.0 + 1.0, vUv.y * 8.0 - uTime * 0.25)) * 0.3;
          float streaks = 0.5 + streak1 + streak2;

          // Combine
          float alpha = fadeTop * fadeBottom * edgeFade * streaks * uOpacity;

          // Slightly brighter core
          float core = 1.0 - smoothstep(0.0, 0.3, abs(vUv.x - 0.5));
          vec3  col  = uColor + vec3(0.15, 0.18, 0.2) * core;

          gl_FragColor = vec4(col, alpha);
        }
      `
    })

    this._volLightMesh = new THREE.Mesh(geo, mat)
    this._volLightMesh.position.set(0, coneH * 0.5 + 0.5, 0)  // cone center above bathtub
    this._volLightMesh.renderOrder = 999  // render after opaque
    this.scene.add(this._volLightMesh)
  },

  // ─────────────────────────────────────────
  update(time, keys) {
    // Actualizar agua
    if (this._waterUniforms) {
      this._waterUniforms.uTime.value = time
    }

    // Pulso de los huevos
    if (this._eggs.length > 0) {
      const pulse = 1.0 + Math.sin(time * 0.8) * 0.10
      this._eggs.forEach((egg, i) => {
        if (egg.material?.emissiveIntensity !== undefined) {
          egg.material.emissiveIntensity = 1.75 * pulse
        }
        // Flotación vertical suave desfasada entre los dos huevos
        egg.position.y = (i === 0 ? 0.24 : 0.24) + Math.sin(time * 1.4 + i * Math.PI) * 0.03
      })
      if (this._eggLight) {
        this._eggLight.intensity = 3.0 * pulse
      }
    }

    // Volumetric light animation
    if (this._volLightUniforms) {
      this._volLightUniforms.uTime.value = time
    }

    // Arrow key rotation
    if (this._orbitControls) {
      const rotSpeed = 1.5
      if (keys && keys.left) {
        this._orbitControls.autoRotateSpeed = rotSpeed
        this._orbitControls.autoRotate = true
      } else if (keys && keys.right) {
        this._orbitControls.autoRotateSpeed = -rotSpeed
        this._orbitControls.autoRotate = true
      } else {
        this._orbitControls.autoRotate = false
        this._orbitControls.autoRotateSpeed = 0
      }
      this._orbitControls.update()
    }

    // Render using the composer (handles both scene and bloom via threshold)
    this._localComposer.render()
  },

  // ─────────────────────────────────────────
  dispose() {
    uiSound.stopLoop('bubbles78', 0.8)

    if (this._orbitControls) this._orbitControls.dispose()

    // Volumetric light
    if (this._volLightMesh) {
      this._volLightMesh.geometry.dispose()
      this._volLightMesh.material.dispose()
    }

    // Word material (applied to GLB plane)
    if (this._wordMaterial) {
      this._wordMaterial.uniforms?.uTexture?.value?.dispose()
      this._wordMaterial.dispose()
    }

    // Composer local
    if (this._localComposer) {
      this._localComposer.passes.forEach(p => p.dispose?.())
    }

    // Escenas
    const disposeScene = (s) => {
      if (!s) return
      s.traverse(o => {
        o.geometry?.dispose()
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          mats.forEach(m => {
            Object.values(m).forEach(v => { if (v?.isTexture) v.dispose() })
            m.dispose()
          })
        }
      })
      s.clear()
    }

    disposeScene(this.scene)

    // Floor
    if (this._floorTex) { this._floorTex.dispose(); this._floorTex = null }
    this._floorMesh = null
    this._wordPlaneMesh = null
    this._wordMaterial = null

    this._renderer.autoClear = true
    this.scene          = null
    this._localComposer = null
    this._eggs          = []
    this._waterUniforms = null
    this._eggLight      = null
  }
}

export default WorldBanera

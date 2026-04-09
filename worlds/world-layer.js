const LAYER_COUNT       = 5
const LAYER_DEPTH_TOTAL = 4       // unidades de profundidad total (compacto)
const PLANE_WIDTH       = 6.0     // ancho del plano en unidades Three.js
const PLANE_HEIGHT      = PLANE_WIDTH * (768 / 1024)  // 4:3 landscape (1024×768)

// Archivos en orden de frente (1.png) a fondo (5.png)
const LAYER_FILES = [
  '1.png',
  '2.png',
  '3.png',
  '4.png',
  '5.png'
]

const WorldLayer = {

  scene:          null,
  camera:         null,
  _renderer:      null,
  _orbitControls: null,
  _planes:        [],
  _handlers:      {},
  _loadedCount:   0,

  init(renderer, composer) {
    this._renderer  = renderer
    this._planes    = []
    this._handlers  = {}
    this._loadedCount = 0

    const W = renderer.domElement.clientWidth
    const H = renderer.domElement.clientHeight

    // ── ESCENA ──
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000000)

    // ── CÁMARA ──
    // Más cerca para que la imagen ocupe casi todo el viewport
    this.camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100)
    this.camera.position.set(0, 0, 8)
    this.camera.lookAt(0, 0, 0)

    // ── ILUMINACIÓN ──
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0))

    // ── GEOMETRÍA COMPARTIDA ──
    const planeGeo = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT)

    // ── CARGAR TEXTURAS Y CREAR PLANOS ──
    const textureLoader = new THREE.TextureLoader()

    LAYER_FILES.forEach((filename, index) => {
      // index 0 (1.png) = frente → z más positivo (más cerca de cámara)
      // index 4 (5.png) = fondo → z más negativo
      const t = index / (LAYER_COUNT - 1)                        // 0 → 1
      const z = LAYER_DEPTH_TOTAL / 2 - t * LAYER_DEPTH_TOTAL   // +2 → -2

      textureLoader.load(
        `assets/layers/${filename}`,
        (texture) => {
          texture.premultiplyAlpha = false

          const mat = new THREE.MeshBasicMaterial({
            map:         texture,
            transparent: true,
            alphaTest:   0.01,
            side:        THREE.FrontSide,
            depthWrite:  false
          })

          const plane = new THREE.Mesh(planeGeo, mat)
          plane.position.set(0, 0, z)

          // Guardar z original y índice en userData — la animación de
          // respiración usa estos valores, NO el índice del array _planes
          plane.userData.zBase      = z
          plane.userData.layerIndex = index

          // renderOrder: mayor = se dibuja último = aparece encima
          // 1.png (index 0) debe tener el más alto
          plane.renderOrder = LAYER_COUNT - 1 - index

          this.scene.add(plane)
          this._planes.push(plane)

          this._loadedCount++
          if (this._loadedCount === LAYER_COUNT) {
            // Ordenar por zBase (no position.z que puede estar modificado)
            this._planes.sort((a, b) => b.userData.zBase - a.userData.zBase)
            // Reasignar renderOrder: frente (i=0) → alto, fondo (i=4) → bajo
            this._planes.forEach((p, i) => {
              p.renderOrder = LAYER_COUNT - 1 - i
            })
          }
        },
        undefined,
        (err) => {
          console.warn(`Layer ${filename} no pudo cargar:`, err)
          const mat = new THREE.MeshBasicMaterial({
            transparent: true, opacity: 0
          })
          const plane = new THREE.Mesh(planeGeo, mat)
          plane.position.set(0, 0, z)
          plane.userData.zBase      = z
          plane.userData.layerIndex = index
          this.scene.add(plane)
          this._planes.push(plane)
        }
      )
    })

    // ── ORBIT CONTROLS ──
    this._orbitControls = new THREE.OrbitControls(
      this.camera,
      renderer.domElement
    )
    this._orbitControls.enableDamping   = true
    this._orbitControls.dampingFactor   = 0.05
    this._orbitControls.enableZoom      = false
    this._orbitControls.enablePan       = false

    // Limitar rotación vertical — ±30°
    this._orbitControls.minPolarAngle   = Math.PI / 2 - 0.52  // ~60°
    this._orbitControls.maxPolarAngle   = Math.PI / 2 + 0.52  // ~120°

    // Limitar rotación horizontal a 180° (±90° desde el frente)
    this._orbitControls.minAzimuthAngle = -Math.PI / 2   // -90°
    this._orbitControls.maxAzimuthAngle =  Math.PI / 2   // +90°

    this._orbitControls.rotateSpeed     = 0.35
    this._orbitControls.target.set(0, 0, 0)

    this._orbitControls.autoRotate      = false
    this._orbitControls.autoRotateSpeed = 0
  },

  update(time, keys) {
    if (this._orbitControls) {
      if (keys && keys.left) {
        this._orbitControls.autoRotate = true
        this._orbitControls.autoRotateSpeed = -3.0
      } else if (keys && keys.right) {
        this._orbitControls.autoRotate = true
        this._orbitControls.autoRotateSpeed = 3.0
      } else {
        this._orbitControls.autoRotate = false
      }
      this._orbitControls.update()
    }

    // Respiración sutil — usa userData.zBase (no el índice del array)
    const breathe = Math.sin(time * 0.4) * 0.04
    this._planes.forEach(plane => {
      const zBase = plane.userData.zBase
      const t = plane.userData.layerIndex / (LAYER_COUNT - 1)
      plane.position.z = zBase + breathe * (0.5 - t)
    })

    this._renderer.render(this.scene, this.camera)
  },

  dispose() {
    if (this._orbitControls) this._orbitControls.dispose()

    this._planes.forEach(plane => {
      if (plane.material.map) plane.material.map.dispose()
      plane.material.dispose()
    })
    if (this._planes.length > 0 && this._planes[0].geometry) {
      this._planes[0].geometry.dispose()
    }

    if (this.scene) this.scene.clear()

    this.scene          = null
    this._planes        = []
    this._orbitControls = null
    this._renderer      = null
  }
}

export default WorldLayer

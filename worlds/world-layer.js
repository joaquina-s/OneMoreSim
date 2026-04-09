const LAYER_COUNT       = 5
const LAYER_DEPTH_TOTAL = 10      // unidades de profundidad total
const PLANE_WIDTH       = 4.0     // ancho del plano en unidades Three.js
const PLANE_HEIGHT      = PLANE_WIDTH * (4961 / 3508)  // mantiene proporción A3

// Archivos en orden de frente a fondo
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
    this.scene.background = new THREE.Color(0xffffff)

    // ── CÁMARA ──
    // Posición frontal — de frente a los layers (centro = 90°)
    this.camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100)
    this.camera.position.set(0, 0, 13)
    this.camera.lookAt(0, 0, 0)

    // ── ILUMINACIÓN ──
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0))

    // ── GEOMETRÍA COMPARTIDA ──
    const planeGeo = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT)

    // ── CARGAR TEXTURAS Y CREAR PLANOS ──
    const textureLoader = new THREE.TextureLoader()

    LAYER_FILES.forEach((filename, index) => {
      // index 0 = frente (z positivo), index 4 = fondo (z negativo)
      const t = index / (LAYER_COUNT - 1)         // 0 a 1
      const z = LAYER_DEPTH_TOTAL / 2 - t * LAYER_DEPTH_TOTAL  // +5 a -5

      textureLoader.load(
        `assets/layers/${filename}`,
        (texture) => {
          texture.premultiplyAlpha = false

          const mat = new THREE.MeshBasicMaterial({
            map:         texture,
            transparent: false,
            side:        THREE.FrontSide
          })

          const plane = new THREE.Mesh(planeGeo, mat)
          plane.position.set(0, 0, z)
          plane.renderOrder = LAYER_COUNT - index

          this.scene.add(plane)
          this._planes.push(plane)

          this._loadedCount++
          if (this._loadedCount === LAYER_COUNT) {
            this._planes.sort((a, b) => b.position.z - a.position.z)
            this._planes.forEach((p, i) => { p.renderOrder = i })
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
    // Posición inicial = azimuth 0 (frente). Límite = -π/2 a +π/2
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

    // Respiración sutil
    const breathe = Math.sin(time * 0.4) * 0.04
    this._planes.forEach((plane, index) => {
      const t = index / (LAYER_COUNT - 1)
      const zBase = LAYER_DEPTH_TOTAL / 2 - t * LAYER_DEPTH_TOTAL
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

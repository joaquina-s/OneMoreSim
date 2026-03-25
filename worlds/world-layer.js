const LAYER_COUNT   = 26
const LAYER_DEPTH_TOTAL = 12    // unidades de profundidad total
const PLANE_WIDTH   = 4.0       // ancho del plano en unidades Three.js
const PLANE_HEIGHT  = PLANE_WIDTH * (4961 / 3508)  // ≈ 5.66, mantiene proporción

// Archivos en orden de frente a fondo
const LAYER_FILES = [
  'rep_0000_38.png',
  'rep_0002_37.png',
  'rep_0003_36.png',
  'rep_0004_35.png',
  'rep_0005_34.png',
  'rep_0006_33.png',
  'rep_0007_32.png',
  'rep_0008_31.png',
  'rep_0009_30.png',
  'rep_0010_29.png',
  'rep_0011_28.png',
  'rep_0012_27.png',
  'rep_0013_26.png',
  'rep_0014_25.png',
  'rep_0015_24.png',
  'rep_0016_23.png',
  'rep_0017_22.png',
  'rep_0018_21.png',
  'rep_0019_20.png',
  'rep_0020_19.png',
  'rep_0021_18.png',
  'rep_0022_17.png',
  'rep_0023_16.png',
  'rep_0024_15.png',
  'rep_0025_14.png',
  'rep_0026_13.png'
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
    // Posición frontal — de frente a los layers
    // La cámara mira en dirección -Z, los layers están centrados en Z=0
    this.camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100)
    this.camera.position.set(0, 0, 13)
    this.camera.lookAt(0, 0, 0)

    // ── ILUMINACIÓN ──
    // MeshBasicMaterial no necesita luz, pero agregamos una luz ambiente
    // por si algún layer usa MeshStandardMaterial
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0))

    // ── GEOMETRÍA COMPARTIDA (todos los layers tienen el mismo tamaño) ──
    const planeGeo = new THREE.PlaneGeometry(PLANE_WIDTH, PLANE_HEIGHT)

    // ── CARGAR TEXTURAS Y CREAR PLANOS ──
    const textureLoader = new THREE.TextureLoader()

    LAYER_FILES.forEach((filename, index) => {
      // Calcular posición Z de este layer
      // index 0 = frente (z positivo), index 25 = fondo (z negativo)
      const t = index / (LAYER_COUNT - 1)         // 0 a 1
      const z = LAYER_DEPTH_TOTAL / 2 - t * LAYER_DEPTH_TOTAL  // +6 a -6

      textureLoader.load(
        `assets/layers/${filename}`,
        (texture) => {
          // Configurar textura para transparencia correcta
          texture.premultiplyAlpha = false

          const mat = new THREE.MeshBasicMaterial({
            map:         texture,
            transparent: true,
            alphaTest:   0.01,
            side:        THREE.FrontSide,
            depthWrite:  false    // CRÍTICO para que los layers no se tapen
          })

          const plane = new THREE.Mesh(planeGeo, mat)
          plane.position.set(0, 0, z)
          // Renderizar de frente a fondo para que la transparencia funcione
          plane.renderOrder = LAYER_COUNT - index

          this.scene.add(plane)
          this._planes.push(plane)

          this._loadedCount++
          // Ordenar por Z para render correcto una vez que todos carguen
          if (this._loadedCount === LAYER_COUNT) {
            this._planes.sort((a, b) => b.position.z - a.position.z)
            this._planes.forEach((p, i) => { p.renderOrder = i })
          }
        },
        undefined,
        (err) => {
          console.warn(`Layer ${filename} no pudo cargar:`, err)
          // Crear plano placeholder transparente para no romper el orden
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
    // Solo rotación — el efecto se activa girando horizontalmente
    this._orbitControls = new THREE.OrbitControls(
      this.camera,
      renderer.domElement
    )
    this._orbitControls.enableDamping   = true
    this._orbitControls.dampingFactor   = 0.05
    this._orbitControls.enableZoom      = false
    this._orbitControls.enablePan       = false

    // Limitar rotación vertical para que el efecto no se rompa
    // El diorama se ve bien hasta ±30° vertical
    this._orbitControls.minPolarAngle   = Math.PI / 2 - 0.52  // ~60°
    this._orbitControls.maxPolarAngle   = Math.PI / 2 + 0.52  // ~120°

    // Sin límite en rotación horizontal — el usuario puede girar libremente
    // Velocidad de rotación más lenta para apreciar el efecto
    this._orbitControls.rotateSpeed     = 0.35
    this._orbitControls.target.set(0, 0, 0)

    // Autorotación desactivada por defecto, se usará con las flechas
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

    // Respiración muy sutil — la separación entre layers se expande
    // y contrae levemente con el tiempo (amplitud muy pequeña)
    const breathe = Math.sin(time * 0.4) * 0.04
    this._planes.forEach((plane, index) => {
      const t = index / (LAYER_COUNT - 1)
      const zBase = LAYER_DEPTH_TOTAL / 2 - t * LAYER_DEPTH_TOTAL
      plane.position.z = zBase + breathe * (0.5 - t)
      // Los layers del frente se acercan, los del fondo se alejan
    })

    this._renderer.render(this.scene, this.camera)
  },

  dispose() {
    if (this._orbitControls) this._orbitControls.dispose()

    // Dispose texturas y materiales
    this._planes.forEach(plane => {
      if (plane.material.map) plane.material.map.dispose()
      plane.material.dispose()
    })
    // La geometría es compartida — dispose solo una vez
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

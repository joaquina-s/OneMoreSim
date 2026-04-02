// worlds/world07.js

const GRID_CELLS = [
  // Fila 1 (alto: 45% de pantalla) — 3 celdas de anchos distintos
  { x: 0.00, y: 0.00, w: 0.28, h: 0.45 },
  { x: 0.28, y: 0.00, w: 0.44, h: 0.45 },
  { x: 0.72, y: 0.00, w: 0.28, h: 0.45 },

  // Fila 2 (alto: 30% de pantalla) — 4 celdas
  { x: 0.00, y: 0.45, w: 0.18, h: 0.30 },
  { x: 0.18, y: 0.45, w: 0.36, h: 0.30 },
  { x: 0.54, y: 0.45, w: 0.26, h: 0.30 },
  { x: 0.80, y: 0.45, w: 0.20, h: 0.30 },

  // Fila 3 (alto: 25% de pantalla) — 5 celdas pequeñas
  { x: 0.00, y: 0.75, w: 0.22, h: 0.25 },
  { x: 0.22, y: 0.75, w: 0.16, h: 0.25 },
  { x: 0.38, y: 0.75, w: 0.30, h: 0.25 },
  { x: 0.68, y: 0.75, w: 0.18, h: 0.25 },
  { x: 0.86, y: 0.75, w: 0.14, h: 0.25 },
];

function createCellMaterial(texture, cell) {
  const mat = new THREE.MeshBasicMaterial({
    map: texture.clone(),
    side: THREE.FrontSide,
  });
  // repeat: qué fracción del video ocupa esta celda
  mat.map.repeat.set(cell.w, cell.h);
  // offset: desde qué punto del video empieza (Y invertido en WebGL)
  mat.map.offset.set(cell.x, 1.0 - cell.y - cell.h);
  mat.map.needsUpdate = true;
  return mat;
}

export default {
    scene: null,
    camera: null,
    renderer: null,
    worldCanvas: null,
    vid1: null,
    vid2: null,
    texture1: null,
    texture2: null,
    cells: [],
    raycaster: null,
    mouse: null,
    hoveredCell: null,
    worldActive: false,
    clickHandler: null,
    mousemoveHandler: null,
    lastTime: 0,

    init(renderer, composer, canvasArea) {
        this.renderer = renderer;
        this.worldCanvas = renderer.domElement;
        this.worldActive = true;
        this.lastTime = performance.now() / 1000; // in seconds

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        const viewportWidth = canvasArea ? canvasArea.clientWidth : window.innerWidth;
        const viewportHeight = canvasArea ? canvasArea.clientHeight : window.innerHeight;
        const aspect = viewportWidth / viewportHeight;
        
        this.camera = new THREE.OrthographicCamera(
            -aspect, aspect,
             1, -1,
             0.1, 10
        );
        this.camera.position.z = 1;

        // Videos setup
        this.vid1 = document.createElement('video');
        this.vid1.src = 'assets/videos/Seq01.mp4'; 
        this.vid1.loop = true;
        this.vid1.muted = true;
        this.vid1.playsInline = true;
        this.vid1.play().catch(e => console.warn("video1 play error", e));

        this.vid2 = document.createElement('video');
        this.vid2.src = 'assets/videos/Seq02.mp4'; 
        this.vid2.loop = true;
        this.vid2.muted = true;
        this.vid2.playsInline = true;
        this.vid2.play().catch(e => console.warn("video2 play error", e));

        this.texture1 = new THREE.VideoTexture(this.vid1);
        this.texture1.minFilter = THREE.LinearFilter;
        this.texture1.magFilter = THREE.LinearFilter;
        this.texture1.format = THREE.RGBAFormat;

        this.texture2 = new THREE.VideoTexture(this.vid2);
        this.texture2.minFilter = THREE.LinearFilter;
        this.texture2.magFilter = THREE.LinearFilter;
        this.texture2.format = THREE.RGBAFormat;

        this.cells = [];

        GRID_CELLS.forEach((cell, index) => {
            const sceneW = cell.w * 2 * aspect;
            const sceneH = cell.h * 2;
            const sceneCX = (cell.x + cell.w / 2) * 2 * aspect - aspect;
            const sceneCY = 1 - (cell.y + cell.h / 2) * 2;

            const GAP = 0.003;
            const geo = new THREE.PlaneGeometry(sceneW - GAP, sceneH - GAP);
            const mat = createCellMaterial(this.texture1, cell);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(sceneCX, sceneCY, 0);

            mesh.userData = {
                index,
                cell,
                showingVideo: 1,
                mat1: mat,
                mat2: createCellMaterial(this.texture2, cell),
                transitioning: false,
                transitionProgress: 0,
                targetVideo: 1
            };

            this.scene.add(mesh);
            this.cells.push(mesh);
        });

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.clickHandler = (event) => {
            if (!this.worldActive) return;
            const rect = this.worldCanvas.getBoundingClientRect();
            this.mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.cells);

            if (intersects.length > 0) {
                const mesh = intersects[0].object;
                mesh.userData.transitioning = true;
                mesh.userData.transitionProgress = 0;
                mesh.userData.targetVideo = mesh.userData.showingVideo === 1 ? 2 : 1;
            }
        };

        this.mousemoveHandler = (event) => {
            if (!this.worldActive) return;
            const rect = this.worldCanvas.getBoundingClientRect();
            this.mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.cells);

            if (this.hoveredCell) {
                if (!this.hoveredCell.userData.transitioning) {
                    this.hoveredCell.material.opacity = 1.0;
                    this.hoveredCell.material.transparent = false;
                }
                this.hoveredCell = null;
            }

            if (intersects.length > 0) {
                this.hoveredCell = intersects[0].object;
                if (!this.hoveredCell.userData.transitioning) {
                    this.hoveredCell.material.opacity = 0.75;
                    this.hoveredCell.material.transparent = true;
                }
                this.worldCanvas.style.cursor = 'pointer';
            } else {
                this.worldCanvas.style.cursor = 'default';
            }
        };

        this.worldCanvas.addEventListener('click', this.clickHandler);
        this.worldCanvas.addEventListener('mousemove', this.mousemoveHandler);
    },

    update(time, keys) {
        if (!this.worldActive) return;

        // Obtain delta
        const currentSecs = time !== undefined ? time : performance.now() / 1000;
        const delta = currentSecs - this.lastTime;
        this.lastTime = currentSecs;

        if (this.texture1) this.texture1.needsUpdate = true;
        if (this.texture2) this.texture2.needsUpdate = true;

        this.cells.forEach(cell => {
            if (cell.userData.transitioning) {
                // Ensure delta isn't wildly large (e.g. on resume)
                const safeDelta = Math.min(delta, 0.1);
                cell.userData.transitionProgress += safeDelta * 3;

                if (cell.userData.transitionProgress >= 1) {
                    cell.userData.transitionProgress = 1;
                    cell.userData.transitioning = false;
                    cell.userData.showingVideo = cell.userData.targetVideo;
                    cell.material = cell.userData.showingVideo === 1
                        ? cell.userData.mat1
                        : cell.userData.mat2;
                    cell.material.opacity = 1.0;
                    cell.material.transparent = false;
                    
                    if (this.hoveredCell === cell) {
                        cell.material.opacity = 0.75;
                        cell.material.transparent = true;
                    }
                } else {
                    cell.material.opacity = 1 - cell.userData.transitionProgress;
                    cell.material.transparent = true;
                }
            }
        });
        
        // Orthographic camera resize support
        if (this.worldCanvas) {
             const rect = this.worldCanvas.getBoundingClientRect();
             if (rect.width > 0 && rect.height > 0) {
                 const aspect = rect.width / rect.height;
                 if (this.camera && Math.abs(this.camera.right - aspect) > 0.01) {
                      this.camera.left = -aspect;
                      this.camera.right = aspect;
                      this.camera.top = 1;
                      this.camera.bottom = -1;
                      this.camera.updateProjectionMatrix();

                      // Reposition and scale geometry
                      this.cells.forEach(mesh => {
                          const cell = mesh.userData.cell;
                          const sceneW = cell.w * 2 * aspect;
                          const sceneH = cell.h * 2;
                          const sceneCX = (cell.x + cell.w / 2) * 2 * aspect - aspect;
                          const sceneCY = 1 - (cell.y + cell.h / 2) * 2;
                          
                          const GAP = 0.003;
                          mesh.geometry.dispose();
                          mesh.geometry = new THREE.PlaneGeometry(sceneW - GAP, sceneH - GAP);
                          mesh.position.set(sceneCX, sceneCY, 0);
                      });
                 }
             }
        }
    },

    dispose() {
        if (!this.worldActive) return;
        this.worldActive = false;
        
        if (this.worldCanvas) {
            this.worldCanvas.removeEventListener('click', this.clickHandler);
            this.worldCanvas.removeEventListener('mousemove', this.mousemoveHandler);
            this.worldCanvas.style.cursor = 'default';
        }

        if (this.vid1) {
            this.vid1.pause();
            this.vid1.removeAttribute('src');
            this.vid1.load();
        }
        if (this.vid2) {
            this.vid2.pause();
            this.vid2.removeAttribute('src');
            this.vid2.load();
        }

        if (this.texture1) this.texture1.dispose();
        if (this.texture2) this.texture2.dispose();

        this.cells.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.userData.mat1) mesh.userData.mat1.dispose();
            if (mesh.userData.mat2) mesh.userData.mat2.dispose();
        });
        this.cells = [];

        if (this.scene) {
            this.scene.clear();
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.worldCanvas = null;
        this.vid1 = null;
        this.vid2 = null;
        this.texture1 = null;
        this.texture2 = null;
        this.raycaster = null;
        this.mouse = null;
        this.hoveredCell = null;
    }
}

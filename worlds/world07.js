// worlds/world07.js

const GRID_CELLS = [

  // ── FILA 1 (y: 0.000, h: 0.143) — 9 celdas, +10% irregularidad ──
  { x: 0.000, y: 0.000, w: 0.049, h: 0.143 },
  { x: 0.049, y: 0.000, w: 0.077, h: 0.143 },
  { x: 0.126, y: 0.000, w: 0.110, h: 0.143 },
  { x: 0.236, y: 0.000, w: 0.154, h: 0.143 },
  { x: 0.390, y: 0.000, w: 0.165, h: 0.143 },
  { x: 0.555, y: 0.000, w: 0.143, h: 0.143 },
  { x: 0.698, y: 0.000, w: 0.110, h: 0.143 },
  { x: 0.808, y: 0.000, w: 0.082, h: 0.143 },
  { x: 0.890, y: 0.000, w: 0.110, h: 0.143 },

  // ── FILA 2 (y: 0.143, h: 0.143) — 8 celdas ──
  { x: 0.000, y: 0.143, w: 0.054, h: 0.143 },
  { x: 0.054, y: 0.143, w: 0.087, h: 0.143 },
  { x: 0.141, y: 0.143, w: 0.131, h: 0.143 },
  { x: 0.272, y: 0.143, w: 0.175, h: 0.143 },
  { x: 0.447, y: 0.143, w: 0.186, h: 0.143 },
  { x: 0.633, y: 0.143, w: 0.153, h: 0.143 },
  { x: 0.786, y: 0.143, w: 0.098, h: 0.143 },
  { x: 0.884, y: 0.143, w: 0.116, h: 0.143 },

  // ── FILA 3 (y: 0.286, h: 0.143) — 8 celdas ──
  { x: 0.000, y: 0.286, w: 0.043, h: 0.143 },
  { x: 0.043, y: 0.286, w: 0.081, h: 0.143 },
  { x: 0.124, y: 0.286, w: 0.142, h: 0.143 },
  { x: 0.266, y: 0.286, w: 0.197, h: 0.143 },
  { x: 0.463, y: 0.286, w: 0.208, h: 0.143 },
  { x: 0.671, y: 0.286, w: 0.158, h: 0.143 },
  { x: 0.829, y: 0.286, w: 0.087, h: 0.143 },
  { x: 0.916, y: 0.286, w: 0.084, h: 0.143 },

  // ── FILA 4 (y: 0.429, h: 0.143) — CENTRO, 8 celdas ──
  { x: 0.000, y: 0.429, w: 0.040, h: 0.143 },
  { x: 0.040, y: 0.429, w: 0.078, h: 0.143 },
  { x: 0.118, y: 0.429, w: 0.147, h: 0.143 },
  { x: 0.265, y: 0.429, w: 0.202, h: 0.143 },
  { x: 0.467, y: 0.429, w: 0.219, h: 0.143 },
  { x: 0.686, y: 0.429, w: 0.164, h: 0.143 },
  { x: 0.850, y: 0.429, w: 0.081, h: 0.143 },
  { x: 0.931, y: 0.429, w: 0.069, h: 0.143 },

  // ── FILA 5 (y: 0.572, h: 0.143) — y corregida, gap visible ──
  { x: 0.000, y: 0.572, w: 0.043, h: 0.143 },
  { x: 0.043, y: 0.572, w: 0.087, h: 0.143 },
  { x: 0.130, y: 0.572, w: 0.142, h: 0.143 },
  { x: 0.272, y: 0.572, w: 0.191, h: 0.143 },
  { x: 0.463, y: 0.572, w: 0.208, h: 0.143 },
  { x: 0.671, y: 0.572, w: 0.153, h: 0.143 },
  { x: 0.824, y: 0.572, w: 0.092, h: 0.143 },
  { x: 0.916, y: 0.572, w: 0.084, h: 0.143 },

  // ── FILA 6 (y: 0.715, h: 0.143) — y corregida ──
  { x: 0.000, y: 0.715, w: 0.056, h: 0.143 },
  { x: 0.056, y: 0.715, w: 0.090, h: 0.143 },
  { x: 0.146, y: 0.715, w: 0.125, h: 0.143 },
  { x: 0.271, y: 0.715, w: 0.175, h: 0.143 },
  { x: 0.446, y: 0.715, w: 0.186, h: 0.143 },
  { x: 0.632, y: 0.715, w: 0.147, h: 0.143 },
  { x: 0.779, y: 0.715, w: 0.103, h: 0.143 },
  { x: 0.882, y: 0.715, w: 0.118, h: 0.143 },

  // ── FILA 7 (y: 0.858, h: 0.142) — y corregida, 9 celdas ──
  { x: 0.000, y: 0.858, w: 0.053, h: 0.142 },
  { x: 0.053, y: 0.858, w: 0.079, h: 0.142 },
  { x: 0.132, y: 0.858, w: 0.112, h: 0.142 },
  { x: 0.244, y: 0.858, w: 0.152, h: 0.142 },
  { x: 0.396, y: 0.858, w: 0.167, h: 0.142 },
  { x: 0.563, y: 0.858, w: 0.141, h: 0.142 },
  { x: 0.704, y: 0.858, w: 0.110, h: 0.142 },
  { x: 0.814, y: 0.858, w: 0.079, h: 0.142 },
  { x: 0.893, y: 0.858, w: 0.107, h: 0.142 },

];

function applyCellUVs(geo, cell) {
    const uvs = geo.attributes.uv;
    for (let i = 0; i < uvs.count; i++) {
        const u = uvs.getX(i);
        const v = uvs.getY(i);
        uvs.setXY(i, 
            cell.x + u * cell.w,
            (1.0 - cell.y - cell.h) + v * cell.h
        );
    }
    return geo;
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
        this.scene.background = new THREE.Color(0xffffff); // Requerido por el usuario: grid lines blancas

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
        this.vid1.src = 'assets/videos/mar_1.mp4';
        this.vid1.loop = true;
        this.vid1.muted = true;
        this.vid1.playsInline = true;
        this.vid1.play().catch(e => console.warn("video1 play error", e));

        this.vid2 = document.createElement('video');
        this.vid2.src = 'assets/videos/mar_2.mp4';
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

            const GAP = 0.0015;
            const geo = applyCellUVs(new THREE.PlaneGeometry(sceneW - GAP, sceneH - GAP), cell);
            
            const mat1 = new THREE.MeshBasicMaterial({ map: this.texture1, side: THREE.FrontSide, transparent: true, opacity: 1.0 });
            const mat2 = new THREE.MeshBasicMaterial({ map: this.texture2, side: THREE.FrontSide, transparent: true, opacity: 0.0 });
            
            const mesh1 = new THREE.Mesh(geo, mat1);
            // mesh1 position local: 0, 0, 0
            
            const mesh2 = new THREE.Mesh(geo, mat2);
            mesh2.position.set(0, 0, -0.01);

            const group = new THREE.Group();
            group.position.set(sceneCX, sceneCY, 0); // Position exactly at center of cell
            group.add(mesh1);
            group.add(mesh2);

            group.userData = {
                index,
                cell,
                showingVideo: 1,
                mat1: mat1,
                mat2: mat2,
                transitioning: false,
                transitionProgress: 0,
                targetVideo: 1
            };

            this.scene.add(group);
            this.cells.push(group);
        });

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.clickHandler = (event) => {
            if (!this.worldActive) return;
            if (event.target.closest('#hud-header') || event.target.closest('#hud-footer') || event.target.closest('#character-panel') || event.target.closest('#world-nav')) return;
            
            const rect = this.worldCanvas.getBoundingClientRect();
            this.mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.cells, true);

            if (intersects.length > 0) {
                // Obtenemos el grupo padre (albergando ambas mallas)
                const group = intersects[0].object.parent;
                group.userData.transitioning = true;
                group.userData.transitionProgress = 0;
                group.userData.targetVideo = group.userData.showingVideo === 1 ? 2 : 1;
            }
        };

        this.mousemoveHandler = (event) => {
            if (!this.worldActive) return;
            const rect = this.worldCanvas.getBoundingClientRect();
            this.mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const isOverUI = event.target.closest('#hud-header') || event.target.closest('#hud-footer') || event.target.closest('#character-panel') || event.target.closest('#world-nav');
            const intersects = isOverUI ? [] : this.raycaster.intersectObjects(this.cells, true);

            if (this.hoveredCell) {
                if (!this.hoveredCell.userData.transitioning) {
                    const shownMat = this.hoveredCell.userData.showingVideo === 1 ? this.hoveredCell.userData.mat1 : this.hoveredCell.userData.mat2;
                    shownMat.opacity = 1.0;
                }
                this.hoveredCell.scale.set(1.0, 1.0, 1.0);
                this.hoveredCell = null;
            }

            if (intersects.length > 0) {
                this.hoveredCell = intersects[0].object.parent;
                if (!this.hoveredCell.userData.transitioning) {
                    const shownMat = this.hoveredCell.userData.showingVideo === 1 ? this.hoveredCell.userData.mat1 : this.hoveredCell.userData.mat2;
                    shownMat.opacity = 0.2; // Hover sutil — 50% más transparente
                }
                this.hoveredCell.scale.set(1.03, 1.03, 1.0); // Leve pop-out efecto glow
                this.worldCanvas.style.cursor = 'pointer';
            } else {
                this.worldCanvas.style.cursor = 'default';
            }
        };

        // Attach a document para que capture siempre indepenedientemente de la cascada del Canvas
        document.addEventListener('pointerup', this.clickHandler);
        document.addEventListener('pointermove', this.mousemoveHandler);
    },

    update(time, keys) {
        if (!this.worldActive) return;

        // Obtain delta
        const currentSecs = time !== undefined ? time : performance.now() / 1000;
        const delta = currentSecs - this.lastTime;
        this.lastTime = currentSecs;

        if (this.texture1) this.texture1.needsUpdate = true;
        if (this.texture2) this.texture2.needsUpdate = true;

        this.cells.forEach(group => {
            if (group.userData.transitioning) {
                const safeDelta = Math.min(delta, 0.1);
                group.userData.transitionProgress += safeDelta * 3; // Crossfade duracion

                if (group.userData.transitionProgress >= 1) {
                    group.userData.transitionProgress = 1;
                    group.userData.transitioning = false;
                    group.userData.showingVideo = group.userData.targetVideo;
                    
                    if (group.userData.showingVideo === 1) {
                        group.userData.mat1.opacity = 1.0;
                        group.userData.mat2.opacity = 0.0;
                    } else {
                        group.userData.mat1.opacity = 0.0;
                        group.userData.mat2.opacity = 1.0;
                    }
                    
                    if (this.hoveredCell === group) {
                        const shownMat = group.userData.showingVideo === 1 ? group.userData.mat1 : group.userData.mat2;
                        shownMat.opacity = 0.75;
                    }
                } else {
                    const p = group.userData.transitionProgress;
                    if (group.userData.targetVideo === 2) {
                        group.userData.mat1.opacity = 1 - p;
                        group.userData.mat2.opacity = p;
                    } else {
                        group.userData.mat2.opacity = 1 - p;
                        group.userData.mat1.opacity = p;
                    }
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
                      this.cells.forEach(group => {
                          const cell = group.userData.cell;
                          const sceneW = cell.w * 2 * aspect;
                          const sceneH = cell.h * 2;
                          const sceneCX = (cell.x + cell.w / 2) * 2 * aspect - aspect;
                          const sceneCY = 1 - (cell.y + cell.h / 2) * 2;
                          
                          const GAP = 0.0015;
                          const geo = applyCellUVs(new THREE.PlaneGeometry(sceneW - GAP, sceneH - GAP), cell);
                          
                          group.children[0].geometry.dispose();
                          group.children[1].geometry.dispose();
                          group.children[0].geometry = geo;
                          group.children[1].geometry = geo;
                          
                          group.position.set(sceneCX, sceneCY, 0); // Padre centra a los hijos
                          group.children[0].position.set(0, 0, 0);
                          group.children[1].position.set(0, 0, -0.01);
                      });
                 }
             }
        }
        
        // Ejecutar ruteo gráfico (ESTO FALTABA y causaba que se congelara visualmente)
        if (this.renderer && this.scene && this.camera) {
            this.renderer.clear(); // Es mandatorio limpiar si el renderer.autoClear = false en pipelines FX
            this.renderer.render(this.scene, this.camera);
        }
    },

    dispose() {
        if (!this.worldActive) return;
        this.worldActive = false;
        
        document.removeEventListener('pointerup', this.clickHandler);
        document.removeEventListener('pointermove', this.mousemoveHandler);
        if (this.worldCanvas) {
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

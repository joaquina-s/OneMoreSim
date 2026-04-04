// worlds/world07.js

const GRID_CELLS = [

  // ── FILA 1 (y: 0.00 → 0.13, alto: 0.13) — orilla superior, celdas pequeñas ──
  { x: 0.000, y: 0.00, w: 0.083, h: 0.13 },
  { x: 0.083, y: 0.00, w: 0.065, h: 0.13 },
  { x: 0.148, y: 0.00, w: 0.075, h: 0.13 },
  { x: 0.223, y: 0.00, w: 0.060, h: 0.13 },
  { x: 0.283, y: 0.00, w: 0.090, h: 0.13 },
  { x: 0.373, y: 0.00, w: 0.070, h: 0.13 },
  { x: 0.443, y: 0.00, w: 0.080, h: 0.13 },
  { x: 0.523, y: 0.00, w: 0.065, h: 0.13 },
  { x: 0.588, y: 0.00, w: 0.090, h: 0.13 },
  { x: 0.678, y: 0.00, w: 0.070, h: 0.13 },
  { x: 0.748, y: 0.00, w: 0.075, h: 0.13 },
  { x: 0.823, y: 0.00, w: 0.085, h: 0.13 },
  { x: 0.908, y: 0.00, w: 0.092, h: 0.13 },

  // ── FILA 2 (y: 0.13 → 0.26, alto: 0.13) — transición superior ──
  { x: 0.000, y: 0.13, w: 0.070, h: 0.13 },
  { x: 0.070, y: 0.13, w: 0.090, h: 0.13 },
  { x: 0.160, y: 0.13, w: 0.110, h: 0.13 },
  { x: 0.270, y: 0.13, w: 0.130, h: 0.13 },
  { x: 0.400, y: 0.13, w: 0.120, h: 0.13 },
  { x: 0.520, y: 0.13, w: 0.130, h: 0.13 },
  { x: 0.650, y: 0.13, w: 0.110, h: 0.13 },
  { x: 0.760, y: 0.13, w: 0.090, h: 0.13 },
  { x: 0.850, y: 0.13, w: 0.080, h: 0.13 },
  { x: 0.930, y: 0.13, w: 0.070, h: 0.13 },

  // ── FILA 3 (y: 0.26 → 0.42, alto: 0.16) — zona centro-superior ──
  { x: 0.000, y: 0.26, w: 0.080, h: 0.16 },
  { x: 0.080, y: 0.26, w: 0.120, h: 0.16 },
  { x: 0.200, y: 0.26, w: 0.160, h: 0.16 },
  { x: 0.360, y: 0.26, w: 0.180, h: 0.16 },
  { x: 0.540, y: 0.26, w: 0.160, h: 0.16 },
  { x: 0.700, y: 0.26, w: 0.120, h: 0.16 },
  { x: 0.820, y: 0.26, w: 0.100, h: 0.16 },
  { x: 0.920, y: 0.26, w: 0.080, h: 0.16 },

  // ── FILA 4 (y: 0.42 → 0.62, alto: 0.20) — CENTRO, celdas más grandes ──
  { x: 0.000, y: 0.42, w: 0.090, h: 0.20 },
  { x: 0.090, y: 0.42, w: 0.150, h: 0.20 },
  { x: 0.240, y: 0.42, w: 0.200, h: 0.20 },
  { x: 0.440, y: 0.42, w: 0.220, h: 0.20 },
  { x: 0.660, y: 0.42, w: 0.180, h: 0.20 },
  { x: 0.840, y: 0.42, w: 0.090, h: 0.20 },
  { x: 0.930, y: 0.42, w: 0.070, h: 0.20 },

  // ── FILA 5 (y: 0.62 → 0.78, alto: 0.16) — zona centro-inferior ──
  { x: 0.000, y: 0.62, w: 0.080, h: 0.16 },
  { x: 0.080, y: 0.62, w: 0.110, h: 0.16 },
  { x: 0.190, y: 0.62, w: 0.160, h: 0.16 },
  { x: 0.350, y: 0.62, w: 0.180, h: 0.16 },
  { x: 0.530, y: 0.62, w: 0.160, h: 0.16 },
  { x: 0.690, y: 0.62, w: 0.130, h: 0.16 },
  { x: 0.820, y: 0.62, w: 0.100, h: 0.16 },
  { x: 0.920, y: 0.62, w: 0.080, h: 0.16 },

  // ── FILA 6 (y: 0.78 → 0.90, alto: 0.12) — transición inferior ──
  { x: 0.000, y: 0.78, w: 0.075, h: 0.12 },
  { x: 0.075, y: 0.78, w: 0.090, h: 0.12 },
  { x: 0.165, y: 0.78, w: 0.110, h: 0.12 },
  { x: 0.275, y: 0.78, w: 0.130, h: 0.12 },
  { x: 0.405, y: 0.78, w: 0.120, h: 0.12 },
  { x: 0.525, y: 0.78, w: 0.110, h: 0.12 },
  { x: 0.635, y: 0.78, w: 0.100, h: 0.12 },
  { x: 0.735, y: 0.78, w: 0.090, h: 0.12 },
  { x: 0.825, y: 0.78, w: 0.085, h: 0.12 },
  { x: 0.910, y: 0.78, w: 0.090, h: 0.12 },

  // ── FILA 7 (y: 0.90 → 1.00, alto: 0.10) — orilla inferior, celdas pequeñas ──
  { x: 0.000, y: 0.90, w: 0.067, h: 0.10 },
  { x: 0.067, y: 0.90, w: 0.075, h: 0.10 },
  { x: 0.142, y: 0.90, w: 0.083, h: 0.10 },
  { x: 0.225, y: 0.90, w: 0.070, h: 0.10 },
  { x: 0.295, y: 0.90, w: 0.080, h: 0.10 },
  { x: 0.375, y: 0.90, w: 0.075, h: 0.10 },
  { x: 0.450, y: 0.90, w: 0.085, h: 0.10 },
  { x: 0.535, y: 0.90, w: 0.070, h: 0.10 },
  { x: 0.605, y: 0.90, w: 0.080, h: 0.10 },
  { x: 0.685, y: 0.90, w: 0.075, h: 0.10 },
  { x: 0.760, y: 0.90, w: 0.080, h: 0.10 },
  { x: 0.840, y: 0.90, w: 0.073, h: 0.10 },
  { x: 0.913, y: 0.90, w: 0.087, h: 0.10 },

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

            const GAP = 0.003;
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
                          
                          const GAP = 0.003;
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

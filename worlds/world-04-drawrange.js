// worlds/world-04-drawrange.js
// World 07 — Full-screen looping video (hfloat.mp4) rendered as a Three.js plane.

export default {
    scene: null,
    camera: null,
    renderer: null,
    _video: null,
    _videoTexture: null,

    init(renderer) {
        this.renderer = renderer;

        // ── Scene ──
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        // ── Orthographic camera (fills viewport exactly) ──
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        this.camera.position.z = 1;

        // ── Video element ──
        const video = document.createElement('video');
        video.src = 'assets/videos/hfloat.mp4';
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        video.play().catch(() => {
            const playOnClick = () => {
                video.play();
                document.removeEventListener('click', playOnClick);
            };
            document.addEventListener('click', playOnClick);
        });
        this._video = video;

        // ── Video texture ──
        const texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        this._videoTexture = texture;

        // ── Full-screen quad ──
        const geo = new THREE.PlaneGeometry(2, 2);
        const mat = new THREE.MeshBasicMaterial({ map: texture });
        const mesh = new THREE.Mesh(geo, mat);
        this.scene.add(mesh);
    },

    update() {
        if (!this.scene || !this.camera) return;
        this.renderer.render(this.scene, this.camera);
    },

    dispose() {
        if (this._video) {
            this._video.pause();
            this._video.removeAttribute('src');
            this._video.load();
            this._video = null;
        }
        if (this._videoTexture) {
            this._videoTexture.dispose();
            this._videoTexture = null;
        }
        if (this.scene) {
            this.scene.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    const mats = [].concat(obj.material);
                    mats.forEach(m => m.dispose());
                }
            });
            this.scene.clear();
        }
        this.scene = null;
        this.camera = null;
        this.renderer = null;
    }
};

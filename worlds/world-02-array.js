// worlds/world-02-array.js
// Array-3D World - Grid of 500 instanced objects with raycast interaction

import { deviceProfile } from '../core/deviceProfile.js';

let scene, camera, _renderer;
let raycaster, mouse;
let instancedMesh;
const count = 500;
const dummy = new THREE.Object3D();
const color = new THREE.Color();

// Interaction states
const scales = new Float32Array(count).fill(1.0);
const targetScales = new Float32Array(count).fill(1.0);
const colors = new Float32Array(count * 3);
const baseColor = new THREE.Color('#00bcd4');
const hoverColor = new THREE.Color('#ff2a85');

export const array3d = {
    init(renderer) {
        _renderer = renderer;
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050510);
        scene.fog = new THREE.FogExp2(0x050510, 0.02);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 15, 25);
        camera.lookAt(0, 0, 0);

        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2(-1, -1);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = deviceProfile.useShadows;
        scene.add(dirLight);

        // Instanced Mesh
        const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.2,
            metalness: 0.8
        });

        instancedMesh = new THREE.InstancedMesh(geometry, material, count);
        instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        instancedMesh.castShadow = deviceProfile.useShadows;
        instancedMesh.receiveShadow = deviceProfile.useShadows;

        // Create Grid
        const cols = 25;
        const rows = 20;
        const spacing = 2.0;

        const startX = -((cols * spacing) / 2) + (spacing / 2);
        const startZ = -((rows * spacing) / 2) + (spacing / 2);

        for (let i = 0; i < count; i++) {
            const ix = i % cols;
            const iz = Math.floor(i / cols);

            const x = startX + ix * spacing;
            const z = startZ + iz * spacing;
            const y = Math.sin(x * 0.5) * Math.cos(z * 0.5) * 2;

            dummy.position.set(x, y, z);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);

            // Initial colors
            baseColor.toArray(colors, i * 3);
            instancedMesh.setColorAt(i, baseColor);
        }

        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.instanceColor.needsUpdate = true;
        scene.add(instancedMesh);

        // Mouse Move Listener
        this._onPointerMove = this.onPointerMove.bind(this);
        window.addEventListener('pointermove', this._onPointerMove);
    },

    onPointerMove(event) {
        // Normalize mouse coordinates for raycaster
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    },

    update(time, keys) {
        if (!scene || !camera || !_renderer) return;

        // Wave animation
        for (let i = 0; i < count; i++) {
            instancedMesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

            // Restore base Y with animation
            const ix = i % 25;
            const iz = Math.floor(i / 25);
            dummy.position.y = Math.sin(time * 2 + ix * 0.2 + iz * 0.2) * 1.5;

            // Target scales relax back to 1
            targetScales[i] += (1.0 - targetScales[i]) * 0.1;
            scales[i] += (targetScales[i] - scales[i]) * 0.2;

            dummy.scale.set(scales[i], scales[i], scales[i]);
            dummy.rotation.x = time + ix * 0.1;
            dummy.rotation.y = time * 0.5 + iz * 0.1;

            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);

            // Revert color gradually
            instancedMesh.getColorAt(i, color);
            color.lerp(baseColor, 0.05);
            instancedMesh.setColorAt(i, color);
        }

        // Raycasting
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(instancedMesh);
        if (intersects.length > 0) {
            const instanceId = intersects[0].instanceId;
            targetScales[instanceId] = 2.5; // Bump scale
            instancedMesh.setColorAt(instanceId, hoverColor);
        }

        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.instanceColor.needsUpdate = true;

        _renderer.render(scene, camera);
    },

    dispose() {
        if (this._onPointerMove) {
            window.removeEventListener('pointermove', this._onPointerMove);
        }
        if (instancedMesh) {
            instancedMesh.geometry.dispose();
            instancedMesh.material.dispose();
            instancedMesh.dispose();
        }
        if (scene) {
            scene.clear();
            scene = null;
        }
        camera = null;
    }
};

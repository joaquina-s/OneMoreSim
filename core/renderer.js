// core/renderer.js
// Shared WebGLRenderer and (optionally) EffectComposer.
// Uses global THREE (r128 via CDN script tags).

import { deviceProfile } from './deviceProfile.js';

// --- WebGLRenderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(deviceProfile.dpr);
renderer.shadowMap.enabled = deviceProfile.useShadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// Shadow map size (for modules that create shadow-casting lights)
const shadowMapSize = deviceProfile.shadowMapSize;

// --- EffectComposer (null on mobile to skip post-processing) ---
const composer = deviceProfile.usePostFX
    ? new THREE.EffectComposer(renderer)
    : null;

export { renderer, composer, shadowMapSize };

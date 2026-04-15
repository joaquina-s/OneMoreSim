// core/deviceProfile.js
// Detects device type and exports a performance profile.

function buildProfile() {
    const w = window.innerWidth;
    return {
        isMobile: w < 768,
        isTablet: w >= 768 && w < 1024,
        isDesktop: w >= 1024,
        // DPR capped at 1.5 on desktop: going to 2 quadruples pixel count
        // with very little visible gain past 1.5 at normal viewing distances.
        dpr: Math.min(devicePixelRatio, w < 768 ? 1.25 : 1.5),
        shadowMapSize: w < 768 ? 512 : 1024,
        targetFPS: w < 768 ? 30 : 60,
        useShadows: w >= 768,
        usePostFX: w >= 768,
        worldSize: w < 768 ? 64 : 128,
    };
}

export let deviceProfile = buildProfile();

export function refreshProfile() {
    deviceProfile = buildProfile();
}

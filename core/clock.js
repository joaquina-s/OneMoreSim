// core/clock.js
// Shared clock instance for the entire app.
// Uses global THREE (r128 via CDN script tags).

const clock = new THREE.Clock();

/**
 * Returns the elapsed time in seconds since the clock started.
 * @returns {number}
 */
function getTime() {
    return clock.getElapsedTime();
}

export { clock, getTime };

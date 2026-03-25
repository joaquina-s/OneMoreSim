// character/textures.js
// 8 procedural skin definitions for the CharacterAnimator.
// When GIF assets become available, add `gifSrc` property to each entry.

export const characterTextures = [
    {
        id: 0,
        label: 'PLASMA',
        color: '#00d4ff',
        colorBase: 'rgba(0, 150, 200, 0.3)',
        colorGlow: '#00d4ff',
        colorDetail: 'rgba(100, 220, 255, 0.6)',
        particles: true
    },
    {
        id: 1,
        label: 'ROJO',
        color: '#ff4444',
        colorBase: 'rgba(180, 30, 30, 0.3)',
        colorGlow: '#ff4444',
        colorDetail: 'rgba(255, 100, 100, 0.6)',
        particles: false
    },
    {
        id: 2,
        label: 'VERDE',
        color: '#44ff88',
        colorBase: 'rgba(20, 160, 60, 0.3)',
        colorGlow: '#44ff88',
        colorDetail: 'rgba(100, 255, 150, 0.6)',
        particles: true
    },
    {
        id: 3,
        label: 'DORADO',
        color: '#ffd700',
        colorBase: 'rgba(180, 140, 0, 0.3)',
        colorGlow: '#ffd700',
        colorDetail: 'rgba(255, 220, 80, 0.6)',
        particles: false
    },
    {
        id: 4,
        label: 'NEUTRO',
        color: '#aaaaaa',
        colorBase: 'rgba(100, 100, 100, 0.3)',
        colorGlow: '#cccccc',
        colorDetail: 'rgba(180, 180, 180, 0.6)',
        particles: false
    },
    {
        id: 5,
        label: 'SOMBRA',
        color: '#8888ff',
        colorBase: 'rgba(40, 40, 120, 0.3)',
        colorGlow: '#8888ff',
        colorDetail: 'rgba(140, 140, 255, 0.6)',
        particles: true
    },
    {
        id: 6,
        label: 'FUEGO',
        color: '#ff6600',
        colorBase: 'rgba(180, 60, 0, 0.3)',
        colorGlow: '#ff6600',
        colorDetail: 'rgba(255, 140, 40, 0.6)',
        particles: true
    },
    {
        id: 7,
        label: 'ARCOIRIS',
        color: '#ff88ff',
        colorBase: 'rgba(120, 0, 120, 0.3)',
        colorGlow: '#ff88ff',
        colorDetail: 'rgba(255, 150, 255, 0.6)',
        particles: true
    }
];

// index.js — Application entry point
// Single animation loop, imports all modules, handles transitions.
// THREE and gsap are available as globals from CDN script tags.

import { renderer, composer } from './core/renderer.js';
import { getTime } from './core/clock.js';
import { WorldManager } from './core/worldManager.js';
import { deviceProfile } from './core/deviceProfile.js';
import { ResizeManager } from './core/resizeManager.js';
import { bubblepicking } from './scenes/bubblepicking.js?v=2';
import { createPlaceholder } from './worlds/world-placeholder.js';
import { uiSound } from './audio/uiSounds.js';
import Spectrogram from './audio/Spectrogram.js';
import LayeredMusic from './audio/LayeredMusic.js';

// ───────────────────────────────────────────────
// Input State — shared across all modules
// ───────────────────────────────────────────────

const keys = { left: false, right: false, up: false, down: false };

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'ArrowUp') keys.up = true;
    if (e.key === 'ArrowDown') keys.down = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'ArrowUp') keys.up = false;
    if (e.key === 'ArrowDown') keys.down = false;
});

// ───────────────────────────────────────────────
// DOM References
// ───────────────────────────────────────────────

const landingContainer = document.getElementById('landing-container');
const uiShell = document.getElementById('ui-shell');
const canvasArea = document.getElementById('canvas-area');
const carouselContainer = document.getElementById('carousel-container');

// Mobile FAB + Drawer
const textureFab = document.getElementById('texture-fab');
const textureDrawer = document.getElementById('texture-drawer');
const drawerBackdrop = document.getElementById('texture-drawer-backdrop');

// ───────────────────────────────────────────────
// Initialization
// ───────────────────────────────────────────────

const worldManager = new WorldManager(renderer, composer, canvasArea);

// Initialize interaction sounds on first click anywhere
window.addEventListener('click', () => uiSound._init(), { once: true });

// Custom Cursor Setup
const cursor = document.getElementById('custom-cursor');
if (window.matchMedia('(pointer: fine)').matches && cursor) {
    window.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
    });
    window.addEventListener('mousedown', () => {
        cursor.classList.add('flash');
        setTimeout(() => cursor.classList.remove('flash'), 100);
    });
}

// Register all 8 worlds
worldManager.register('0', () => import('./worlds/world-00-huevo.js').then(m => m.default));
worldManager.register('1', () => Promise.resolve(bubblepicking));
worldManager.register('2', () => import('./worlds/world-01-teatro.js').then(m => m.default));
worldManager.register('3', () => import('./worlds/world-02-array3d.js?v=28').then(m => m.default));
worldManager.register('4', () => import('./worlds/world-03-tunnel.js?v=2').then(m => m.default));
worldManager.register('5', () => import('./worlds/world-04-drawrange.js').then(m => m.default));
worldManager.register('6', () => import('./worlds/world06.js').then(m => m.default));
worldManager.register('7', () => import('./worlds/world07.js').then(m => m.default));
worldManager.register('8', () => import('./worlds/world-07-godrays.js').then(m => m.default));
worldManager.register('9', () => import('./worlds/world-layer.js').then(m => m.default));

// ───────────────────────────────────────────────
// Video Landing Autoplay Fallback
// ───────────────────────────────────────────────
const landingVideo = document.getElementById('landing-video');
if (landingVideo) {
    landingVideo.play().catch(() => {
        // If it fails, try on first click
        const playOnClick = () => {
            landingVideo.play();
            document.removeEventListener('click', playOnClick);
        };
        document.addEventListener('click', playOnClick);
    });
}

// ───────────────────────────────────────────────
// Transition: Landing → Carousel (ENTRAR button)
// ───────────────────────────────────────────────

// ───────────────────────────────────────────────
// Enter the main experience (called from intro screen)
// ───────────────────────────────────────────────
function enterExperience() {
    // Fade out del container completo
    gsap.to('#landing-container', {
        opacity: 0,
        duration: 0.8,
        onComplete: () => {
            // Ocultar landing
            document.getElementById('landing-container').style.display = 'none';

            // Pausar el video para liberar recursos
            const video = document.getElementById('landing-video');
            if (video) video.pause();

            // Reset keys
            keys.up = false;
            keys.down = false;
            keys.left = false;
            keys.right = false;

            // Show welcome overlay IMMEDIATELY so user never sees bare UI
            const introOverlay = document.getElementById('intro-overlay');
            if (introOverlay) {
                introOverlay.style.display = 'flex';
                introOverlay.style.opacity = '1';
                introOverlay.style.pointerEvents = 'auto';
            }

            // 1. Show ui-shell FIRST so the CSS grid lays out
            uiShell.style.display = 'grid';
            uiShell.classList.add('visible');

            // 2. Show carousel container
            carouselContainer.style.display = 'block';

            // 3. Insert the renderer canvas into the carousel container
            carouselContainer.insertBefore(renderer.domElement, carouselContainer.firstChild);
            renderer.domElement.style.position = 'absolute';
            renderer.domElement.style.left = '0';
            renderer.domElement.style.top = '0';
            renderer.domElement.style.width = '100%';
            renderer.domElement.style.height = '100%';

            // 4. Wait one frame so the browser completes layout reflow
            requestAnimationFrame(async () => {
                // Now canvasArea has real dimensions from the grid
                const w = canvasArea.clientWidth;
                const h = canvasArea.clientHeight;
                renderer.setSize(w, h, false);
                if (composer) composer.setSize(w, h);

                // Reset manager states
                worldManager.activeModule = null;
                worldManager.activeId = null;

                updateWorldInfo('0');

                // Make canvas visible before activate
                renderer.domElement.style.opacity = '1';

                // Activar carousel en el WorldManager
                await worldManager.activate('0');

                // Fade in del carousel canvas y container
                gsap.fromTo('#carousel-container',
                    { opacity: 0 },
                    { opacity: 1, duration: 1.0 }
                );
                gsap.fromTo(renderer.domElement,
                    { opacity: 0 },
                    { opacity: 1, duration: 1.0 }
                );

                // Initialize character webp display
                const charImg = document.getElementById('character-webp');
                if (charImg) {
                    charImg.src = 'assets/chars/1.webp';
                    charImg.style.opacity = '1';
                }
                document.querySelectorAll('.texture-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.texture === '0');
                });
                initParallaxMap();

                // Show world-00 overlay (we start at world 0)
                const ov = document.getElementById('world-00-overlay');
                if (ov) ov.classList.add('visible');

                // Init world tracker playlist panel
                initWorldTracker();
                updateWorldTracker('0');

                // Background-preload all other worlds so switching is instant
                const preloadIds = ['7','2','9','6','3','5','4','1','8'];
                preloadIds.forEach((id, i) => {
                    setTimeout(() => worldManager.preload(id), 800 + i * 400);
                });
            });
        }
    });
}

// ───────────────────────────────────────────────
// First ENTRAR: fade landing and enter the experience
// (welcome overlay appears on top of ui-shell after world 0 loads)
// ───────────────────────────────────────────────
document.getElementById('enter-button-img').addEventListener('click', () => {
    uiSound.enter();
    enterExperience();
});

// ───────────────────────────────────────────────
// Second ENTRAR (on welcome overlay): dismiss it
// ───────────────────────────────────────────────
document.getElementById('intro-enter-btn').addEventListener('click', () => {
    uiSound.enter();
    const introOverlay = document.getElementById('intro-overlay');
    if (introOverlay) introOverlay.style.pointerEvents = 'none'; // Immediately stop blocking clicks
    gsap.to(introOverlay, {
        opacity: 0, duration: 0.4,
        onComplete: () => {
            if (introOverlay) introOverlay.style.display = 'none';
        }
    });
});

// ───────────────────────────────────────────────
// HUD WORLD DATA & UPDATE LOGIC
// ───────────────────────────────────────────────

const WORLD_DATA = {
    '0': {
        title: '01Core_Unit',
        desc: 'Here is where the sea was. now just different memories scattered and an egg keeping systems together',
        accent: '#8899cc',
        iconSvg: `<path d="M16 26 C8 24 8 16 16 6 C24 16 24 24 16 26 Z" fill="none" stroke="currentColor" stroke-width="2"/>
                  <circle cx="16" cy="18" r="3" fill="currentColor"/>`
    },
    '1': {
        title: '09Bubblepicking',
        desc: 'The story that went round and round went back to its beginning.',
        accent: '#88ccff',
        iconSvg: `<circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
              <circle cx="16" cy="16" r="4" fill="currentColor" opacity="0.4"/>
              <circle cx="16" cy="10" r="2" fill="currentColor" opacity="0.6"/>`
    },
    '2': {
        title: '03Presentation_Club',
        desc: 'I feel bad for anybody that has to be around us because we only talk to each other.',
        accent: '#8899cc',
        iconSvg: `<rect x="8" y="10" width="32" height="18" fill="none" stroke="currentColor" stroke-width="2"/>
                  <line x1="16" y1="36" x2="16" y2="28" stroke="currentColor" stroke-width="2"/>
                  <line x1="32" y1="36" x2="32" y2="28" stroke="currentColor" stroke-width="2"/>
                  <line x1="8" y1="36" x2="40" y2="36" stroke="currentColor" stroke-width="2"/>`
    },
    '3': {
        title: '06Super_Me_Era',
        desc: 'I just love transitional spaces. It feels like everyone has something to say in here.',
        accent: '#8899cc',
        iconSvg: `<circle cx="12" cy="24" r="3" fill="currentColor"/>
                  <circle cx="20" cy="24" r="3" fill="currentColor"/>
                  <circle cx="28" cy="24" r="3" fill="currentColor"/>
                  <circle cx="36" cy="24" r="3" fill="currentColor"/>
                  <circle cx="12" cy="16" r="3" fill="currentColor" opacity="0.5"/>
                  <circle cx="20" cy="16" r="3" fill="currentColor" opacity="0.5"/>
                  <circle cx="28" cy="16" r="3" fill="currentColor" opacity="0.5"/>
                  <circle cx="36" cy="16" r="3" fill="currentColor" opacity="0.5"/>`
    },
    '4': {
        title: '08Fetal_Situation',
        desc: 'Warm water made us spill words into the tub and now they\'re just floating there, all tangled up.',
        accent: '#88ccff',
        iconSvg: `<rect x="6" y="22" width="36" height="14" rx="7"
                    fill="none" stroke="currentColor" stroke-width="2"/>
                  <line x1="10" y1="22" x2="10" y2="15"
                    stroke="currentColor" stroke-width="2"/>
                  <line x1="10" y1="15" x2="15" y2="15"
                    stroke="currentColor" stroke-width="2"/>
                  <line x1="13" y1="36" x2="11" y2="42"
                    stroke="currentColor" stroke-width="2"/>
                  <line x1="35" y1="36" x2="37" y2="42"
                    stroke="currentColor" stroke-width="2"/>`
    },
    '5': {
        title: '07',
        desc: 'Red neuronal animada con nodos y conexiones que se escriben progresivamente en tiempo real.',
        accent: '#8899cc',
        iconSvg: `<circle cx="12" cy="12" r="3" fill="currentColor"/>
              <circle cx="36" cy="12" r="3" fill="currentColor"/>
              <circle cx="24" cy="36" r="3" fill="currentColor"/>
              <line x1="12" y1="12" x2="36" y2="12" stroke="currentColor" stroke-width="1.5"/>
              <line x1="12" y1="12" x2="24" y2="36" stroke="currentColor" stroke-width="1.5"/>
              <line x1="36" y1="12" x2="24" y2="36" stroke="currentColor" stroke-width="1.5"/>`
    },
    '6': {
        title: '05Aqua_Race',
        desc: 'She\'s blurred, a smooth presence you\'d chase forever.',
        accent: '#ffffff',
        iconSvg: `<path d="M12 24 L36 24 M24 12 L36 24 L24 36" fill="none" stroke="currentColor" stroke-width="2"/>
              <circle cx="12" cy="24" r="3" fill="currentColor"/>`
    },
    '7': {
        title: '02Ambient_Human_presence',
        desc: 'Whenever I remember something, it\'s always a little different. It comes with this residual aura.',
        accent: '#ffffff',
        iconSvg: `<rect x="8" y="8" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"/>
                  <rect x="26" y="8" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"/>
                  <rect x="8" y="26" width="32" height="14" fill="none" stroke="currentColor" stroke-width="2"/>`
    },
    '8': {
        title: '10',
        desc: 'Rayos de luz volumétrica con MorphTargets. Geometrías que se transforman entre formas en tiempo real.',
        accent: '#ff8800',
        iconSvg: `<circle cx="24" cy="24" r="5" fill="currentColor"/>
              <line x1="24" y1="4" x2="24" y2="14" stroke="currentColor" stroke-width="2"/>
              <line x1="38" y1="10" x2="31" y2="17" stroke="currentColor" stroke-width="2"/>
              <line x1="44" y1="24" x2="34" y2="24" stroke="currentColor" stroke-width="2"/>
              <line x1="38" y1="38" x2="31" y2="31" stroke="currentColor" stroke-width="2"/>
              <line x1="24" y1="44" x2="24" y2="34" stroke="currentColor" stroke-width="2"/>
              <line x1="10" y1="38" x2="17" y2="31" stroke="currentColor" stroke-width="2"/>
              <line x1="4" y1="24" x2="14" y2="24" stroke="currentColor" stroke-width="2"/>
              <line x1="10" y1="10" x2="17" y2="17" stroke="currentColor" stroke-width="2"/>`
    },
    '9': {
        title: '04Inner_World',
        desc: '(( hey image, you look trapped there))',
        accent: '#8899cc',
        iconSvg: `<rect x="4" y="20" width="24" height="4" rx="1"
                    fill="none" stroke="currentColor" stroke-width="2"/>
                  <rect x="6" y="14" width="20" height="4" rx="1"
                    fill="none" stroke="currentColor" stroke-width="2" opacity="0.7"/>
                  <rect x="8" y="8" width="16" height="4" rx="1"
                    fill="none" stroke="currentColor" stroke-width="2" opacity="0.4"/>`
    }
};

// ── Typewriter with variable speed (handwriting feel) ──
let _typeTimer = null;
function typeWorldDesc(text) {
    const el = document.getElementById('world-info-desc');
    const cursor = document.getElementById('world-text-cursor');
    if (!el) return;
    if (_typeTimer) clearTimeout(_typeTimer);
    el.textContent = '';
    if (cursor) cursor.style.opacity = '1';
    let i = 0;
    function next() {
        if (i < text.length) {
            el.textContent += text[i++];
            const ch = text[i - 1];
            // Pause after punctuation; vary base speed 50–170ms
            const base = 25 + Math.random() * 60;
            const pause = /[.,!?)]/.test(ch) ? base + 125 + Math.random() * 175 : base;
            _typeTimer = setTimeout(next, pause);
        }
    }
    next();
}

function updateWorldInfo(worldId) {
    const data = WORLD_DATA[worldId] || WORLD_DATA['0'];
    document.documentElement.style.setProperty('--world-accent', data.accent);
    const footerWorldId = document.getElementById('footer-world-id');
    if (footerWorldId) footerWorldId.textContent = String(worldId).padStart(2, '0');
    typeWorldDesc(data.desc);
    updateWorldTracker(worldId);
}

// ── World Tracker (car-stereo playlist panel) ──
const WORLD_ORDER = ['0','7','2','9','6','3','5','4','1','8'];
const WORLD_DISPLAY_NAMES = {
    '0': '01  Core_Unit',
    '7': '02  Ambient_Human_presence',
    '2': '03  Presentation_Club',
    '9': '04  Inner_World',
    '6': '05  Aqua_Race',
    '3': '06  Super_Me_Era',
    '5': '07',
    '4': '08  Fetal_Situation',
    '1': '09  Bubblepicking',
    '8': '10'
};
const TRACK_ITEM_H = 26; // px — must match CSS

function initWorldTracker() {
    const list = document.getElementById('world-track-list');
    if (!list) return;
    list.innerHTML = WORLD_ORDER.map(id =>
        `<div class="track-item" data-world-track="${id}">${WORLD_DISPLAY_NAMES[id]}</div>`
    ).join('');
}

function updateWorldTracker(worldId) {
    const list = document.getElementById('world-track-list');
    if (!list) return;
    list.querySelectorAll('.track-item').forEach(item =>
        item.classList.toggle('active', item.dataset.worldTrack === worldId)
    );
    const idx = WORLD_ORDER.indexOf(worldId);
    list.style.transform = `translateY(-${idx * TRACK_ITEM_H}px)`;
}

// ───────────────────────────────────────────────
// World-Nav Button Wiring
// ───────────────────────────────────────────────

// Simple debounce helper
function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

// ───────────────────────────────────────────────
// HUD Minimap Tracker
// ───────────────────────────────────────────────

const PMAP_NODES = [
          { world: 0, px: 0.08, py: 0.09  },   // extremo superior izquierdo
          { world: 1, px: 0.72, py: 0.05  },   // extremo superior derecho
          { world: 2, px: 0.31, py: 0.28  },   // centro-izquierda alto
          { world: 3, px: 0.88, py: 0.42  },   // extremo derecho medio
          { world: 4, px: 0.05, py: 0.58  },   // extremo izquierdo bajo
          { world: 5, px: 0.55, py: 0.52  },   // centro exacto del mapa
          { world: 6, px: 0.78, py: 0.71  },   // derecha inferior
          { world: 7, px: 0.18, py: 0.82  },   // izquierda muy baja
          { world: 8, px: 0.48, py: 0.91  },   // centro muy bajo
          { world: 9, px: 0.91, py: 0.88  },   // extremo inferior derecho
        ];

        function initParallaxMap() {
          const svg = document.getElementById('pmap-nodes-svg');

          PMAP_NODES.forEach(node => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('data-world', node.world);
            g.setAttribute('data-px', node.px);
            g.setAttribute('data-py', node.py);

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('r', '5.5');
            circle.setAttribute('fill', '#1a142e');
            circle.setAttribute('stroke', '#8899cc');
            circle.setAttribute('stroke-width', '1.5');
            circle.classList.add('pmap-node');

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('dy', '-8');
            label.setAttribute('font-size', '7');
            label.setAttribute('fill', 'rgba(136,153,204,0.7)');
            label.setAttribute('font-family', 'Roboto Condensed, sans-serif');
            label.textContent = node.world;

            g.appendChild(circle);
            g.appendChild(label);
            svg.appendChild(g);
          });

          updateParallaxMap(0);
        }

        let pmapPrevWorld = 0;

        function updateParallaxMap(activeWorld) {
          const panel = document.getElementById('minimap-panel');
          const bg    = document.getElementById('pmap-bg');
          const fg    = document.getElementById('pmap-fg');
          const svg   = document.getElementById('pmap-nodes-svg');

          const vw = panel.offsetWidth;
          const vh = panel.offsetHeight;

          const fgW = vw * 3.5;
          const fgH = vh * 3.5;

          const activeNode = PMAP_NODES.find(n => n.world === activeWorld);
          if (!activeNode) return;

          const nodeX = activeNode.px * fgW;
          const nodeY = activeNode.py * fgH;

          let fgOffsetX = -(nodeX - vw / 2);
          let fgOffsetY = -(nodeY - vh / 2);

          fgOffsetX = Math.min(0, Math.max(fgOffsetX, -(fgW - vw)));
          fgOffsetY = Math.min(0, Math.max(fgOffsetY, -(fgH - vh)));

          const bgOffsetX = fgOffsetX * 0.2;
          const bgOffsetY = fgOffsetY * 0.2;

          fg.style.transform = `translate(${fgOffsetX}px, ${fgOffsetY}px)`;
          bg.style.transform = `translate(${bgOffsetX}px, ${bgOffsetY}px)`;

          // Actualizar posición y estado de cada nodo
          svg.querySelectorAll('g[data-world]').forEach(g => {
            const px     = parseFloat(g.getAttribute('data-px'));
            const py     = parseFloat(g.getAttribute('data-py'));
            const world  = parseInt(g.getAttribute('data-world'));
            const screenX = px * fgW + fgOffsetX;
            const screenY = py * fgH + fgOffsetY;

            g.setAttribute('transform', `translate(${screenX}, ${screenY})`);

            const circle = g.querySelector('circle');
            if (world === activeWorld) {
              circle.setAttribute('fill', '#ffffff');
              circle.setAttribute('stroke', '#ffffff');
              circle.setAttribute('r', '7.7');
              circle.classList.add('pmap-node-active');
            } else {
              circle.setAttribute('fill', '#1a142e');
              circle.setAttribute('stroke', '#8899cc');
              circle.setAttribute('r', '5.5');
              circle.classList.remove('pmap-node-active');
              circle.removeAttribute('filter');
            }
          });

          // Dibujar línea de trayectoria desde nodo anterior al nuevo
          if (pmapPrevWorld !== activeWorld) {
            const prevNode = PMAP_NODES.find(n => n.world === pmapPrevWorld);
            if (prevNode) {
              const prevX = prevNode.px * fgW + fgOffsetX;
              const prevY = prevNode.py * fgH + fgOffsetY;
              const currX = activeNode.px * fgW + fgOffsetX;
              const currY = activeNode.py * fgH + fgOffsetY;

              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', prevX);
              line.setAttribute('y1', prevY);
              line.setAttribute('x2', currX);
              line.setAttribute('y2', currY);
              line.setAttribute('stroke', '#ffffff');
              line.setAttribute('stroke-width', '1.5');
              line.setAttribute('stroke-dasharray', '4 3');
              line.classList.add('pmap-trajectory');
              svg.appendChild(line);
              setTimeout(() => line.remove(), 1500);
            }
          }

          pmapPrevWorld = activeWorld;
        }

// ───────────────────────────────────────────────
// Text Fade Out Logic (Mundo 2 Interactions)
// ───────────────────────────────────────────────

function fadeOutWorldTexts() {
    const container = document.getElementById('text-overlay-container');
    if (!container) return;

    const texts = Array.from(container.querySelectorAll('.floating-text'));
    if (texts.length === 0) return;

    // Mezclar el orden aleatoriamente (Fisher-Yates shuffle)
    for (let i = texts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [texts[i], texts[j]] = [texts[j], texts[i]];
    }

    // Hacer fade de cada texto con delay escalonado
    let accumulatedDelay = 0;
    texts.forEach((el) => {
        const delay = 300 + Math.random() * 900;  // ms
        accumulatedDelay += delay;

        setTimeout(() => {
            el.classList.add('fading');
            // Remover del DOM después de que termine el fade (7s)
            setTimeout(() => {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 7200);
        }, accumulatedDelay);
    });
}

// ───────────────────────────────────────────────
// World 03 charBW overlay positioning
// ───────────────────────────────────────────────
function positionWorld03Overlay() {
    const divider = document.getElementById('vertical-divider');
    const overlay = document.getElementById('world-03-overlay');
    if (!divider || !overlay) return;
    // Center the image on the right edge of the character panel (= left edge of divider)
    const rect = divider.getBoundingClientRect();
    overlay.style.left = rect.left + 'px';
}

function showWorld03Overlay() {
    positionWorld03Overlay();
    const ov = document.getElementById('world-03-overlay');
    if (ov) ov.classList.add('visible');
}

function hideWorld03Overlay() {
    const ov = document.getElementById('world-03-overlay');
    if (ov) ov.classList.remove('visible');
}

// Reposition on resize
window.addEventListener('resize', () => {
    const ov = document.getElementById('world-03-overlay');
    if (ov && ov.classList.contains('visible')) positionWorld03Overlay();
});

// ───────────────────────────────────────────────
// World Button PNG Hover + Active Image Swap
// ───────────────────────────────────────────────

// Use data-btn (visual position 1-10) for image file, not data-world
function worldBtnNormalSrc(btn) {
    return `assets/tex/Buttons/worldB${btn.dataset.btn}.png`;
}
function worldBtnHoverSrc(btn) {
    return `assets/tex/Buttons/worldBH${btn.dataset.btn}.png`;
}

function updateWorldBtnImages() {
    document.querySelectorAll('.world-btn').forEach(b => {
        const img = b.querySelector('.world-btn-img');
        if (!img) return;
        img.src = b.classList.contains('active') ? worldBtnHoverSrc(b) : worldBtnNormalSrc(b);
    });
}

document.querySelectorAll('.world-btn').forEach(btn => {
    // Debounced preload — only the expensive operation needs debouncing
    const debouncedPreload = debounce(() => worldManager.preload(btn.dataset.world), 60);

    // Click → activate
    btn.addEventListener('click', () => {
        fadeOutWorldTexts();
        uiSound.switchWorld();

        // Set active state immediately for instant visual feedback
        document.querySelectorAll('.world-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateWorldBtnImages();

        // Activate world; sync images again once worldManager finishes
        // (handles case where a previous transition was in-flight)
        worldManager.activate(btn.dataset.world).then(updateWorldBtnImages);
        updateWorldInfo(btn.dataset.world);
        updateParallaxMap(parseInt(btn.dataset.world, 10));

        // World-specific overlays
        const ov = document.getElementById('world-00-overlay');
        if (ov) ov.classList.toggle('visible', btn.dataset.world === '0');

        if (btn.dataset.world === '3') {
            showWorld03Overlay();
        } else {
            hideWorld03Overlay();
        }
    });

    // Desktop hover — image swap is immediate (no debounce) to avoid stale timer
    btn.addEventListener('mouseenter', () => {
        uiSound.hover();
        if (cursor) cursor.classList.add('hover');
        if (!btn.classList.contains('active')) {
            const img = btn.querySelector('.world-btn-img');
            if (img) img.src = worldBtnHoverSrc(btn);
        }
        debouncedPreload();
    });

    btn.addEventListener('mouseleave', () => {
        if (cursor) cursor.classList.remove('hover');
        if (!btn.classList.contains('active')) {
            const img = btn.querySelector('.world-btn-img');
            if (img) img.src = worldBtnNormalSrc(btn);
        }
    });

    // Mobile: preload on touch
    btn.addEventListener('touchstart', () => {
        worldManager.preload(btn.dataset.world);
    }, { passive: true });
});

document.querySelectorAll('.texture-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        uiSound.click();
        const textId = parseInt(btn.dataset.texture);
        const webpIndex = textId + 1;
        const charImg = document.getElementById('character-webp');
        if (charImg) {
            charImg.style.transition = 'opacity 200ms';
            charImg.style.opacity = '0';
            setTimeout(() => {
                charImg.src = `assets/chars/${webpIndex}.webp`;
                charImg.style.opacity = '1';
            }, 200);
        }
        document.querySelectorAll('.texture-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
    btn.addEventListener('mouseenter', () => {
        uiSound.hover();
        if (cursor) cursor.classList.add('hover');
    });
    btn.addEventListener('mouseleave', () => {
        if (cursor) cursor.classList.remove('hover');
    });
});

// ───────────────────────────────────────────────
// Centralised Resize Manager
// ───────────────────────────────────────────────

const resizeManager = new ResizeManager(
    renderer,
    composer,
    () => {
        // Return the active camera from the current world module
        const mod = worldManager.activeModule;
        return mod ? mod.camera : null;
    },
    worldManager
);
resizeManager.init();

// Carousel-specific: update pixelPass resolution on resize
window.addEventListener('resize', () => {
    if (worldManager.getCurrentId() === '1' && bubblepicking.getPixelPass) {
        const pp = bubblepicking.getPixelPass();
        if (pp) {
            const w = canvasArea.clientWidth;
            const h = canvasArea.clientHeight;
            pp.uniforms.resolution.value.set(w, h);
        }
    }
});

// ───────────────────────────────────────────────
// Mobile: Texture FAB + Drawer
// ───────────────────────────────────────────────

if (textureFab) {
    textureFab.addEventListener('click', () => {
        textureDrawer.classList.toggle('open');
        drawerBackdrop.classList.toggle('visible');
    });
}

if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', () => {
        textureDrawer.classList.remove('open');
        drawerBackdrop.classList.remove('visible');
    });
}

// ───────────────────────────────────────────────
// Touch Swipe Controls (carousel navigation)
// ───────────────────────────────────────────────

let touchStartX = 0;
renderer.domElement.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
}, { passive: true });

renderer.domElement.addEventListener('touchend', (e) => {
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) > 50) {
        if (delta > 0) keys.left = true;
        else keys.right = true;
        setTimeout(() => { keys.left = false; keys.right = false; }, 100);
    }
}, { passive: true });

// ───────────────────────────────────────────────
// FPS & HUD Counters
// ───────────────────────────────────────────────

const fpsEl = document.getElementById('hud-fps');
const coordsEl = document.getElementById('hud-coords');

let fpsFrames = 0;
let lastFpsTime = performance.now();
let hudFrameTick = 0;

function updateHUD() {
    try {
        // Update FPS once per second
        fpsFrames++;
        const now = performance.now();
        if (now - lastFpsTime >= 1000) {
            if (fpsEl) fpsEl.textContent = fpsFrames + ' FPS';
            fpsFrames = 0;
            lastFpsTime = now;
        }

        // Update coordinates every 30 frames
        hudFrameTick++;
        if (hudFrameTick >= 30) {
            hudFrameTick = 0;
            if (coordsEl) {
                let cam = null;
                try {
                    cam = resizeManager.getCamera();
                } catch (_) { }
                if (!cam && worldManager.activeModule && worldManager.activeModule.camera) {
                    cam = worldManager.activeModule.camera;
                }
                if (cam) {
                    const fmt = (v) => {
                        const n = Math.round(v);
                        const s = Math.abs(n).toString().padStart(3, '0');
                        return n < 0 ? '-' + s : s;
                    };
                    coordsEl.textContent = `X:${fmt(cam.position.x)} Y:${fmt(cam.position.y)} Z:${fmt(cam.position.z)}`;
                }
            }
        }
    } catch (e) {
        console.warn('updateHUD error:', e);
    }
}

// ───────────────────────────────────────────────
// Animation Loop — Adaptive FPS
// ───────────────────────────────────────────────

let skipFrame = false;
let rafId = 0;

function loop() {
    rafId = requestAnimationFrame(loop);

    // On mobile (targetFPS 30), skip every other frame
    skipFrame = !skipFrame;
    if (deviceProfile.targetFPS === 30 && skipFrame) return;

    const t = getTime();
    
    // Solo tickear si el carousel está activo (no estamos en el intro de video)
    if (worldManager.getActive() !== 'landing') {
        worldManager.tick(t, keys);
    }
    
    updateHUD();
}

// Pause when tab is hidden, resume when visible
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        cancelAnimationFrame(rafId);
    } else {
        loop();
    }
});

// ───────────────────────────────────────────────
// Layered Music System + Spectrogram
// ───────────────────────────────────────────────
const layeredMusic = new LayeredMusic();

// Init music on first user click (autoplay policy)
let _musicInited = false;
async function ensureMusicInit() {
    if (_musicInited) return;
    _musicInited = true;
    try {
        await layeredMusic.init(120); // BPM of the nostalgia tracks
        layeredMusic.play();

        // Multi-layer coloured spectrogram (one colour per layer)
        const spectrogramContainer = document.getElementById('spectrogram-container');
        if (spectrogramContainer) {
            const layerAnalysers = layeredMusic.getLayerAnalysers();
            const layerColors = {
                principal: [40,  50,  120],  // deep indigo (base)
                synth:     [125, 133, 180],  // steel-violet  (#7d85b4)
                bass:      [45,  47,  96],   // dark violet   (#2d2f60)
                perc:      [136, 153, 204],  // muted blue    (#8899cc)
                voice:     [136, 204, 255],  // bright cyan   (#88ccff)
            };
            const spectrogram = new Spectrogram(spectrogramContainer);
            spectrogram.initMultiLayer(layerAnalysers, layerColors);
        }

        // Beat indicator bars
        layeredMusic.onBeat((beatIdx) => {
            document.querySelectorAll('.beat-bar').forEach((bar, i) => {
                bar.classList.toggle('active', i === beatIdx);
            });
        });

        // Volume slider
        const volSlider = document.getElementById('volume-slider');
        if (volSlider) {
            volSlider.addEventListener('input', () => {
                layeredMusic.setVolume(parseInt(volSlider.value, 10) / 100);
            });
        }

        // Layer toggle buttons
        document.querySelectorAll('.layer-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const layerKey = btn.dataset.layer;
                const nowMuted = layeredMusic.toggleMute(layerKey);
                btn.dataset.on = nowMuted ? 'false' : 'true';
            });
        });

    } catch (e) {
        console.error('LayeredMusic init failed:', e);
        _musicInited = false;
    }
}

// Trigger music init on first click anywhere
document.addEventListener('click', ensureMusicInit, { once: true });

loop();


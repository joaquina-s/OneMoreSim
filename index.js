// index.js — Application entry point
// Single animation loop, imports all modules, handles transitions.
// THREE and gsap are available as globals from CDN script tags.

import { renderer, composer } from './core/renderer.js';
import { getTime } from './core/clock.js';
import { WorldManager } from './core/worldManager.js';
import { deviceProfile } from './core/deviceProfile.js';
import { ResizeManager } from './core/resizeManager.js';
import { bubblepicking } from './scenes/bubblepicking.js';
import { createPlaceholder } from './worlds/world-placeholder.js';
import { uiSound } from './audio/uiSounds.js';
import Spectrogram from './audio/Spectrogram.js';

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
worldManager.register('6', () => import('./worlds/world-05-transform.js').then(m => m.default));
worldManager.register('7', () => import('./worlds/world-06-bloom.js').then(m => m.default));
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

document.getElementById('enter-button-img').addEventListener('click', () => {
    uiSound.enter();

    // Fade out del landing-ui
    gsap.to('#landing-ui', { opacity: 0, duration: 0.5 });

    // Fade out del video y overlay
    gsap.to('#landing-video', { opacity: 0, duration: 0.8, delay: 0.3 });
    gsap.to('#landing-overlay', { opacity: 0, duration: 0.8, delay: 0.3 });

    // Fade out del container completo
    gsap.to('#landing-container', {
        opacity: 0,
        duration: 0.8,
        delay: 0.3,
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
            });
        }
    });
});

// ───────────────────────────────────────────────
// HUD WORLD DATA & UPDATE LOGIC
// ───────────────────────────────────────────────

const WORLD_DATA = {
    '0': {
        title: 'HUEVO',
        desc: 'Origen inmersivo 00. Huevo central proyectando rayos de luz.',
        accent: '#8899cc',
        iconSvg: `<path d="M16 26 C8 24 8 16 16 6 C24 16 24 24 16 26 Z" fill="none" stroke="currentColor" stroke-width="2"/>
                  <circle cx="16" cy="18" r="3" fill="currentColor"/>`
    },
    '1': {
        title: 'BUBBLEPICKING',
        desc: 'Recorre 4 salas, recoge burbujas y absorbe imágenes flotantes.',
        accent: '#88ccff',
        iconSvg: `<circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
              <circle cx="16" cy="16" r="4" fill="currentColor" opacity="0.4"/>
              <circle cx="16" cy="10" r="2" fill="currentColor" opacity="0.6"/>`
    },
    '2': {
        title: 'TEATRO',
        desc: 'Un mundo cinemático. Haz click en una de las sillas de la audiencia para sentarte.',
        accent: '#8899cc',
        iconSvg: `<rect x="8" y="10" width="32" height="18" fill="none" stroke="currentColor" stroke-width="2"/>
                  <line x1="16" y1="36" x2="16" y2="28" stroke="currentColor" stroke-width="2"/>
                  <line x1="32" y1="36" x2="32" y2="28" stroke="currentColor" stroke-width="2"/>
                  <line x1="8" y1="36" x2="40" y2="36" stroke="currentColor" stroke-width="2"/>`
    },
    '3': {
        title: 'PROCESIÓN',
        desc: '50 figuras avanzan en formación. Cada una desfasada del ciclo colectivo.',
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
        title: 'BAÑERA',
        desc:  'Dos huevos luminosos en una bañera. El agua es un campo de palabras que ondula.',
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
        title: 'NETWORK',
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
        title: 'TRANSFORM',
        desc: 'Editor 3D interactivo. Seleccioná y manipulá objetos con controles de posición, rotación y escala.',
        accent: '#ffaa00',
        iconSvg: `<rect x="16" y="16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"/>
              <line x1="24" y1="4" x2="24" y2="16" stroke="currentColor" stroke-width="2"/>
              <line x1="24" y1="32" x2="24" y2="44" stroke="currentColor" stroke-width="2"/>
              <line x1="4" y1="24" x2="16" y2="24" stroke="currentColor" stroke-width="2"/>
              <line x1="32" y1="24" x2="44" y2="24" stroke="currentColor" stroke-width="2"/>`
    },
    '7': {
        title: 'BLOOM',
        desc: 'Post-processing Unreal Bloom. Objetos emisivos con halos de luz cinematográfica dinámica.',
        accent: '#ffffff',
        iconSvg: `<circle cx="24" cy="24" r="8" fill="currentColor" opacity="0.9"/>
              <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4"/>
              <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.2"/>`
    },
    '8': {
        title: 'GOD RAYS',
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
        title: 'LAYER',
        desc:  'Veintiséis planos transparentes apilados en profundidad. De frente parece flat.',
        accent: '#8899cc',
        iconSvg: `<rect x="4" y="20" width="24" height="4" rx="1"
                    fill="none" stroke="currentColor" stroke-width="2"/>
                  <rect x="6" y="14" width="20" height="4" rx="1"
                    fill="none" stroke="currentColor" stroke-width="2" opacity="0.7"/>
                  <rect x="8" y="8" width="16" height="4" rx="1"
                    fill="none" stroke="currentColor" stroke-width="2" opacity="0.4"/>`
    }
};

function updateWorldInfo(worldId) {
    const data = WORLD_DATA[worldId] || WORLD_DATA['0'];

    // Update CSS variable
    document.documentElement.style.setProperty('--world-accent', data.accent);

    // Update icon
    const iconContainer = document.getElementById('world-icon-svg');
    if (iconContainer) iconContainer.innerHTML = data.iconSvg;

    // Update title with fade
    const titleEl = document.getElementById('world-info-title');
    if (titleEl) {
        titleEl.style.opacity = '0';
        setTimeout(() => {
            titleEl.textContent = data.title;
            titleEl.style.transition = 'opacity 300ms';
            titleEl.style.opacity = '1';
        }, 150);
    }

    // Update description with typing effect
    const descEl = document.getElementById('world-info-desc');
    if (descEl) {
        descEl.style.animation = 'none';
        descEl.textContent = data.desc;
        // force reflow
        void descEl.offsetHeight;
        descEl.style.animation = 'typing 0.8s steps(60) forwards';
    }

    // Update footer
    const footerWorldId = document.getElementById('footer-world-id');
    if (footerWorldId) footerWorldId.textContent = String(worldId).padStart(2, '0');
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
// World Button PNG Hover + Active Image Swap
// ───────────────────────────────────────────────

// Map data-world index to file number (0→1, 1→2 ... 9→10)
function worldBtnNormalSrc(worldIdx) {
    return `assets/tex/Buttons/worldB${Number(worldIdx) + 1}.png`;
}
function worldBtnHoverSrc(worldIdx) {
    return `assets/tex/Buttons/worldBH${Number(worldIdx) + 1}.png`;
}

function updateWorldBtnImages() {
    document.querySelectorAll('.world-btn').forEach(b => {
        const img = b.querySelector('.world-btn-img');
        if (!img) return;
        if (b.classList.contains('active')) {
            img.src = worldBtnHoverSrc(b.dataset.world);
        } else {
            img.src = worldBtnNormalSrc(b.dataset.world);
        }
    });
}

document.querySelectorAll('.world-btn').forEach(btn => {
    // Click → activate
    btn.addEventListener('click', () => {
        fadeOutWorldTexts(); // Start fading text overlays on transition
        uiSound.switchWorld();
        worldManager.activate(btn.dataset.world);
        updateWorldInfo(btn.dataset.world);
        updateParallaxMap(parseInt(btn.dataset.world, 10));

        // Update active class and images
        document.querySelectorAll('.world-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateWorldBtnImages();
    });

    // Desktop: preload on hover + swap image (debounced)
    btn.addEventListener('mouseenter', debounce(() => {
        uiSound.hover();
        if (cursor) cursor.classList.add('hover');
        worldManager.preload(btn.dataset.world);
        // Swap to hover image
        const img = btn.querySelector('.world-btn-img');
        if (img) img.src = worldBtnHoverSrc(btn.dataset.world);
    }, 50));

    btn.addEventListener('mouseleave', () => {
        if (cursor) cursor.classList.remove('hover');
        // Swap back to normal if not active
        if (!btn.classList.contains('active')) {
            const img = btn.querySelector('.world-btn-img');
            if (img) img.src = worldBtnNormalSrc(btn.dataset.world);
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
// Audio Spectrogram Initialization
// ───────────────────────────────────────────────
const spectrogramContainer = document.getElementById('spectrogram-container');
if (spectrogramContainer) {
    const spectrogram = new Spectrogram(spectrogramContainer);
    spectrogram.init('assets/main-track-ALL.mp3');
}

class Minesweeper {
    constructor(gridEl, counterEl, timerEl, statusEl, resetBtn) {
        this.ROWS  = 6
        this.COLS  = 6
        this.MINES = 5

        this.gridEl    = gridEl
        this.counterEl = counterEl
        this.timerEl   = timerEl
        this.statusEl  = statusEl
        this.resetBtn  = resetBtn

        this.board      = []
        this.gameOver   = false
        this.gameWon    = false
        this.firstClick = true
        this.timerVal   = 0
        this.timerInt   = null
        this.flagCount  = 0

        this.resetBtn.addEventListener('click', () => this.init())
        this.init()
    }

    init() {
        clearInterval(this.timerInt)
        this.gameOver   = false
        this.gameWon    = false
        this.firstClick = true
        this.timerVal   = 0
        this.flagCount  = 0
        this.timerEl.textContent   = '0'
        this.counterEl.textContent = this.MINES
        this.statusEl.textContent  = ''

        this.board = []
        for (let r = 0; r < this.ROWS; r++) {
            this.board[r] = []
            for (let c = 0; c < this.COLS; c++) {
                this.board[r][c] = { mine: false, revealed: false, flagged: false, adj: 0 }
            }
        }

        this._render()
    }

    _placeMines(safeRow, safeCol) {
        let placed = 0
        while (placed < this.MINES) {
            const r = Math.floor(Math.random() * this.ROWS)
            const c = Math.floor(Math.random() * this.COLS)
            const isSafe = Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1
            if (!this.board[r][c].mine && !isSafe) {
                this.board[r][c].mine = true
                placed++
            }
        }
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                if (!this.board[r][c].mine) {
                    this.board[r][c].adj = this._countAdj(r, c)
                }
            }
        }
    }

    _countAdj(row, col) {
        let count = 0
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const r = row + dr, c = col + dc
                if (r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS) {
                    if (this.board[r][c].mine) count++
                }
            }
        }
        return count
    }

    _reveal(row, col) {
        const cell = this.board[row][col]
        if (cell.revealed || cell.flagged) return
        cell.revealed = true
        if (!cell.mine && cell.adj === 0) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const r = row + dr, c = col + dc
                    if (r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS) {
                        this._reveal(r, c)
                    }
                }
            }
        }
    }

    _checkWin() {
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const cell = this.board[r][c]
                if (!cell.mine && !cell.revealed) return false
            }
        }
        return true
    }

    _startTimer() {
        this.timerInt = setInterval(() => {
            this.timerVal++
            this.timerEl.textContent = this.timerVal
        }, 1000)
    }

    _render() {
        this.gridEl.innerHTML = ''

        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const cell = this.board[r][c]
                const el   = document.createElement('div')
                el.className = 'ms-cell'

                if (cell.revealed) {
                    el.classList.add('ms-revealed')
                    if (cell.mine) {
                        el.classList.add('ms-mine-revealed')
                        const img = document.createElement('img')
                        img.src = 'assets/huwvv.png'
                        img.alt = '🥚'
                        el.appendChild(img)
                    } else if (cell.adj > 0) {
                        el.textContent = cell.adj
                        el.classList.add(`ms-n${cell.adj}`)
                    }
                } else if (cell.flagged) {
                    el.classList.add('ms-flagged')
                    el.textContent = '♥'
                    el.style.color  = '#cc2244'
                    el.style.fontSize = '11px'
                }

                el.addEventListener('click', (e) => {
                    e.stopPropagation()
                    if (this.gameOver || this.gameWon) return
                    if (cell.flagged) return

                    if (this.firstClick) {
                        this.firstClick = false
                        this._placeMines(r, c)
                        this._startTimer()
                    }

                    if (cell.mine) {
                        this.gameOver = true
                        clearInterval(this.timerInt)
                        for (let rr = 0; rr < this.ROWS; rr++) {
                            for (let cc = 0; cc < this.COLS; cc++) {
                                if (this.board[rr][cc].mine) this.board[rr][cc].revealed = true
                            }
                        }
                        this.statusEl.textContent = 'GAME OVER'
                        this.statusEl.style.color = '#cc2244'
                    } else {
                        this._reveal(r, c)
                        if (this._checkWin()) {
                            this.gameWon = true
                            clearInterval(this.timerInt)
                            this.statusEl.textContent = 'YOU WIN ♥'
                            this.statusEl.style.color = '#1a6a1a'
                        }
                    }
                    this._render()
                })

                el.addEventListener('contextmenu', (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (this.gameOver || this.gameWon || cell.revealed) return

                    cell.flagged = !cell.flagged
                    this.flagCount += cell.flagged ? 1 : -1
                    this.counterEl.textContent = Math.max(0, this.MINES - this.flagCount)
                    this._render()
                })

                this.gridEl.appendChild(el)
            }
        }
    }
}

function initMinesweepers() {
    const leftGrid    = document.getElementById('ms-left-grid')
    const leftCounter = document.getElementById('ms-left-counter')
    const leftTimer   = document.getElementById('ms-left-timer')
    const leftStatus  = document.getElementById('ms-left-status')
    const leftReset   = document.getElementById('ms-left-reset')

    if (leftGrid) {
        window._msLeft = new Minesweeper(leftGrid, leftCounter, leftTimer, leftStatus, leftReset)
    }

    const rightGrid    = document.getElementById('ms-right-grid')
    const rightCounter = document.getElementById('ms-right-counter')
    const rightTimer   = document.getElementById('ms-right-timer')
    const rightStatus  = document.getElementById('ms-right-status')
    const rightReset   = document.getElementById('ms-right-reset')

    if (rightGrid) {
        window._msRight = new Minesweeper(rightGrid, rightCounter, rightTimer, rightStatus, rightReset)
    }
}

initMinesweepers();

loop();


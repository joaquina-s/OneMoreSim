// core/gamepadNav.js
// Xbox 360 controller navigation for the web experience.
// Gamepad API standard mapping (Xbox 360 / XInput):
//   Buttons: A=0, B=1, X=2, Y=3, LB=4, RB=5, LT=6, RT=7
//   Axes:    Left stick X=0, Y=1  |  Right stick X=2, Y=3
//
// Behaviour:
//   - Both thumbsticks move a virtual cursor (combined velocity).
//   - A / B / X / Y  → click at the cursor's current position.
//   - LT (button 6)  → simulates Left-arrow key press.
//   - RT (button 7)  → simulates Right-arrow key press.
//   - LB (button 4) or RB (button 5) → reload the page.

const DEADZONE = 0.15;          // ignore stick drift below this threshold
const CURSOR_SPEED = 12;        // px per frame at full deflection
const TRIGGER_THRESHOLD = 0.5;  // analogue trigger "pressed" threshold

// Virtual cursor position — starts at screen centre
let cx = window.innerWidth  / 2;
let cy = window.innerHeight / 2;

// Track previous button states so we only fire on the leading edge
let prevButtons = {};

// Reference to the custom-cursor element (set lazily on first poll)
let cursorEl = null;

function applyDeadzone(v) {
    return Math.abs(v) < DEADZONE ? 0 : v;
}

function moveCursor(dx, dy) {
    cx = Math.max(0, Math.min(window.innerWidth  - 1, cx + dx));
    cy = Math.max(0, Math.min(window.innerHeight - 1, cy + dy));

    if (!cursorEl) cursorEl = document.getElementById('custom-cursor');
    if (cursorEl) {
        cursorEl.style.left = cx + 'px';
        cursorEl.style.top  = cy + 'px';
    }
}

function simulateClick() {
    // Dispatch a full pointer/mouse event chain at the virtual cursor pos
    const target = document.elementFromPoint(cx, cy);
    if (!target) return;

    const opts = {
        bubbles: true, cancelable: true,
        clientX: cx, clientY: cy,
        screenX: cx, screenY: cy,
        button: 0, buttons: 1,
        view: window,
    };

    target.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1 }));
    target.dispatchEvent(new MouseEvent('mousedown', opts));
    target.dispatchEvent(new PointerEvent('pointerup',   { ...opts, pointerId: 1, buttons: 0 }));
    target.dispatchEvent(new MouseEvent('mouseup',   { ...opts, buttons: 0 }));
    target.dispatchEvent(new MouseEvent('click',     { ...opts, buttons: 0 }));

    // Flash the custom cursor (same visual as a real click)
    if (!cursorEl) cursorEl = document.getElementById('custom-cursor');
    if (cursorEl) {
        cursorEl.classList.add('flash');
        setTimeout(() => cursorEl.classList.remove('flash'), 100);
    }
}

function simulateKey(code, key) {
    const base = { bubbles: true, cancelable: true, code, key, view: window };
    document.dispatchEvent(new KeyboardEvent('keydown', base));
    // Brief delay then keyup so listeners that check for held keys work
    setTimeout(() => {
        document.dispatchEvent(new KeyboardEvent('keyup', base));
    }, 80);
}

// Returns true on leading-edge press (false while held)
function justPressed(gp, index) {
    const val = gp.buttons[index];
    // Standard Gamepad buttons expose { pressed, value }
    const pressed = typeof val === 'object' ? val.pressed : val > TRIGGER_THRESHOLD;
    const was = !!prevButtons[index];
    prevButtons[index] = pressed;
    return pressed && !was;
}

function poll() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) { gp = gamepads[i]; break; }
    }

    if (gp) {
        // ── Thumbsticks → cursor movement ──
        const lx = applyDeadzone(gp.axes[0] || 0);
        const ly = applyDeadzone(gp.axes[1] || 0);
        const rx = applyDeadzone(gp.axes[2] || 0);
        const ry = applyDeadzone(gp.axes[3] || 0);

        const dx = (lx + rx) * CURSOR_SPEED;
        const dy = (ly + ry) * CURSOR_SPEED;
        if (dx !== 0 || dy !== 0) moveCursor(dx, dy);

        // Also dispatch a synthetic mousemove so hover states update
        if (dx !== 0 || dy !== 0) {
            const t = document.elementFromPoint(cx, cy);
            if (t) {
                t.dispatchEvent(new MouseEvent('mousemove', {
                    bubbles: true, clientX: cx, clientY: cy, view: window,
                }));
            }
        }

        // ── A (0), B (1), X (2), Y (3) → click ──
        if (justPressed(gp, 0) || justPressed(gp, 1) ||
            justPressed(gp, 2) || justPressed(gp, 3)) {
            simulateClick();
        }

        // ── LT (6) → Left arrow  /  RT (7) → Right arrow ──
        if (justPressed(gp, 6)) simulateKey('ArrowLeft',  'ArrowLeft');
        if (justPressed(gp, 7)) simulateKey('ArrowRight', 'ArrowRight');

        // ── LB (4) / RB (5) → reload page ──
        if (justPressed(gp, 4) || justPressed(gp, 5)) {
            window.location.reload();
        }
    }

    requestAnimationFrame(poll);
}

// Start polling as soon as a gamepad is detected
export function initGamepadNav() {
    window.addEventListener('gamepadconnected', (e) => {
        console.log('[gamepadNav] controller connected:', e.gamepad.id);
        // Re-centre cursor
        cx = window.innerWidth  / 2;
        cy = window.innerHeight / 2;
    });
    window.addEventListener('gamepaddisconnected', (e) => {
        console.log('[gamepadNav] controller disconnected:', e.gamepad.id);
        prevButtons = {};
    });

    // Begin the rAF poll loop immediately — getGamepads() returns null
    // until a button is first pressed, which is fine (poll just no-ops).
    requestAnimationFrame(poll);
}

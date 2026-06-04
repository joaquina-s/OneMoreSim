// core/gamepadNav.js
// Xbox 360 controller navigation for the web experience.
// Gamepad API standard mapping (Xbox 360 / XInput):
//   Buttons: A=0, B=1, X=2, Y=3, LB=4, RB=5, LT=6, RT=7
//   Axes:    Left stick X=0, Y=1  |  Right stick X=2, Y=3
//
// Behaviour:
//   - LEFT thumbstick  → moves a virtual cursor (mouse).
//   - RIGHT thumbstick (X) → holds Left/Right arrow (advance worlds).
//   - A / B / X / Y  → click at the cursor's current position.
//   - LT (button 6) or RT (button 7) → reload the page / reset experience.

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

function dispatchKey(type, code, key) {
    document.dispatchEvent(new KeyboardEvent(type, {
        bubbles: true, cancelable: true, code, key, view: window,
    }));
}

// Track held state of the right-stick arrow directions so we can keep the
// arrow key "pressed" for as long as the stick is pushed (matching keyboard
// behaviour where holding ← / → keeps advancing).
let leftHeld  = false;
let rightHeld = false;

// Dispatch keydown/keyup edges from a boolean "is this direction active".
function updateHeldDir(active, key, heldFlag) {
    if (active && !heldFlag) {
        dispatchKey('keydown', key, key);   // leading edge → keydown
        return true;
    }
    if (!active && heldFlag) {
        dispatchKey('keyup', key, key);     // trailing edge → keyup
        return false;
    }
    return heldFlag;                        // no change
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
        // ── LEFT thumbstick → cursor movement ──
        const lx = applyDeadzone(gp.axes[0] || 0);
        const ly = applyDeadzone(gp.axes[1] || 0);

        const dx = lx * CURSOR_SPEED;
        const dy = ly * CURSOR_SPEED;
        if (dx !== 0 || dy !== 0) {
            moveCursor(dx, dy);
            // Synthetic mousemove so hover states update
            const t = document.elementFromPoint(cx, cy);
            if (t) {
                t.dispatchEvent(new MouseEvent('mousemove', {
                    bubbles: true, clientX: cx, clientY: cy, view: window,
                }));
            }
        }

        // ── RIGHT thumbstick X → hold Left / Right arrow ──
        // Pushing the right stick left/right behaves like holding ← / → on
        // the keyboard, so the world keeps advancing while it's pushed.
        const rx = gp.axes[2] || 0;
        const goLeft  = rx < -TRIGGER_THRESHOLD;
        const goRight = rx >  TRIGGER_THRESHOLD;
        leftHeld  = updateHeldDir(goLeft,  'ArrowLeft',  leftHeld);
        rightHeld = updateHeldDir(goRight, 'ArrowRight', rightHeld);

        // ── A (0), B (1), X (2), Y (3) → click ──
        if (justPressed(gp, 0) || justPressed(gp, 1) ||
            justPressed(gp, 2) || justPressed(gp, 3)) {
            simulateClick();
        }

        // ── LT (6) / RT (7) → reload page / reset experience ──
        if (justPressed(gp, 6) || justPressed(gp, 7)) {
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
        // Release any arrow keys still "held" by the stick so they don't stick
        if (leftHeld)  { dispatchKey('keyup', 'ArrowLeft',  'ArrowLeft');  leftHeld  = false; }
        if (rightHeld) { dispatchKey('keyup', 'ArrowRight', 'ArrowRight'); rightHeld = false; }
    });

    // Begin the rAF poll loop immediately — getGamepads() returns null
    // until a button is first pressed, which is fine (poll just no-ops).
    requestAnimationFrame(poll);
}

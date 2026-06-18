import type { HarborScene } from "../scenes/HarborScene";

// On-screen analog joystick (touch + mouse via Pointer Events). While held, it
// steers the player in the stick's direction by sending move intents on a short
// interval. Works as a guaranteed alternative to click-to-walk.
export function setupJoystick(scene: HarborScene): void {
  const stage = document.getElementById("stage");
  if (!stage) return;

  const base = document.createElement("div");
  base.className = "joy-base";
  const knob = document.createElement("div");
  knob.className = "joy-knob";
  base.appendChild(knob);
  stage.appendChild(base);

  const RADIUS = 56; // px the knob can travel from center
  let active = false;
  let pointerId = -1;
  let dir = { x: 0, y: 0 };
  let mag = 0;

  function place(clientX: number, clientY: number): void {
    const r = base.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2);
    const dy = clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    const clamped = Math.min(RADIUS, d);
    const nx = d ? dx / d : 0;
    const ny = d ? dy / d : 0;
    knob.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;
    dir = { x: nx, y: ny };
    mag = clamped / RADIUS;
  }

  function reset(): void {
    active = false;
    pointerId = -1;
    mag = 0;
    dir = { x: 0, y: 0 };
    knob.style.transform = "translate(0px, 0px)";
    base.classList.remove("active");
  }

  base.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    active = true;
    pointerId = e.pointerId;
    base.classList.add("active");
    try {
      base.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    place(e.clientX, e.clientY);
  });
  base.addEventListener("pointermove", (e) => {
    if (active && e.pointerId === pointerId) place(e.clientX, e.clientY);
  });
  base.addEventListener("pointerup", reset);
  base.addEventListener("pointercancel", reset);

  // Drive movement while the stick is pushed past a deadzone.
  let lastSent = 0;
  const loop = (t: number) => {
    if (active && mag > 0.25 && t - lastSent > 150) {
      lastSent = t;
      scene.steer(dir.x, dir.y);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

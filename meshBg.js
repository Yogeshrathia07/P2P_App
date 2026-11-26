/**
 * Animated peer-to-peer mesh background canvas for the lobby screen.
 * Automatically pauses when the lobby is hidden or reduced-motion is preferred.
 */

export function startMeshBackground(canvas, lobbyEl) {
  if (!canvas || !lobbyEl) return () => {};
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let width = 0;
  let height = 0;
  let dpr = 1;
  let rafId = 0;
  const mouse = { x: -9999, y: -9999, active: false };

  const nodeCount = 24;
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.00038,
    vy: (Math.random() - 0.5) * 0.00038,
    r: 2.2 + (i % 3) * 1.1,
    phase: Math.random() * Math.PI * 2,
  }));

  const packets = Array.from({ length: 7 }, () => ({
    a: Math.floor(Math.random() * nodeCount),
    b: Math.floor(Math.random() * nodeCount),
    t: Math.random(),
    speed: 0.006 + Math.random() * 0.006,
  }));

  function resize() {
    const rect = lobbyEl.getBoundingClientRect();
    width = Math.max(320, rect.width);
    height = Math.max(320, rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function onMouseMove(e) {
    const rect = lobbyEl.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    mouse.active = true;
  }

  function onMouseLeave() {
    mouse.active = false;
  }

  function drawFrame(now) {
    if (!lobbyEl.classList.contains('hidden')) {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      ctx.clearRect(0, 0, width, height);

      const linkDist = Math.min(210, Math.max(130, width * 0.18));

      // Move nodes gently
      if (!reducedMotion) {
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0.02 || n.x > 0.98) n.vx *= -1;
          if (n.y < 0.02 || n.y > 0.98) n.vy *= -1;
          n.x = Math.max(0.01, Math.min(0.99, n.x));
          n.y = Math.max(0.01, Math.min(0.99, n.y));
        }
      }

      const coords = nodes.map((n) => ({
        x: n.x * width,
        y: n.y * height,
        r: n.r,
        phase: n.phase,
      }));

      // Draw P2P links
      for (let i = 0; i < coords.length; i++) {
        for (let j = i + 1; j < coords.length; j++) {
          const dx = coords[i].x - coords[j].x;
          const dy = coords[i].y - coords[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < linkDist) {
            const alpha = (1 - dist / linkDist) * (isLight ? 0.22 : 0.28);
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(coords[i].x, coords[i].y);
            ctx.lineTo(coords[j].x, coords[j].y);
            ctx.stroke();
          }
        }

        // Mouse attraction lines
        if (mouse.active) {
          const mdx = coords[i].x - mouse.x;
          const mdy = coords[i].y - mouse.y;
          const mdist = Math.hypot(mdx, mdy);
          if (mdist < linkDist * 1.1) {
            const alpha = (1 - mdist / (linkDist * 1.1)) * 0.42;
            ctx.strokeStyle = `rgba(99, 102, 241, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(coords[i].x, coords[i].y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      // Draw travelling data packets along mesh edges
      if (!reducedMotion) {
        for (const p of packets) {
          p.t += p.speed;
          if (p.t >= 1) {
            p.t = 0;
            p.a = p.b;
            // Pick a neighbor node within linkDist if possible
            let next = (p.a + 1) % coords.length;
            let bestDist = Infinity;
            for (let k = 0; k < coords.length; k++) {
              if (k === p.a) continue;
              const d = Math.hypot(coords[p.a].x - coords[k].x, coords[p.a].y - coords[k].y);
              if (d < linkDist && (Math.random() < 0.4 || d < bestDist)) {
                bestDist = d;
                next = k;
              }
            }
            p.b = next;
          }
          const a = coords[p.a];
          const b = coords[p.b];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < linkDist * 1.35) {
            const px = a.x + (b.x - a.x) * p.t;
            const py = a.y + (b.y - a.y) * p.t;
            ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
            ctx.beginPath();
            ctx.arc(px, py, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw peer nodes
      const tSec = now * 0.002;
      for (const c of coords) {
        const pulse = 0.65 + 0.35 * Math.sin(tSec + c.phase);
        ctx.fillStyle = isLight
          ? `rgba(2, 132, 199, ${(0.28 + pulse * 0.25).toFixed(2)})`
          : `rgba(56, 189, 248, ${(0.3 + pulse * 0.35).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (!reducedMotion) {
      rafId = requestAnimationFrame(drawFrame);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  lobbyEl.addEventListener('mousemove', onMouseMove);
  lobbyEl.addEventListener('mouseleave', onMouseLeave);
  rafId = requestAnimationFrame(drawFrame);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    lobbyEl.removeEventListener('mousemove', onMouseMove);
    lobbyEl.removeEventListener('mouseleave', onMouseLeave);
  };
}

// Opening screen: "SECRETARÍA IDDI" written in thousands of particles that fly in from outside the
// screen, then react to the pointer (they move out of its way) until the app is ready.
// Adapted from the supplied "Pixel Drift" ParticleText component (React) to plain canvas:
// same text sampling, outside-ring spawn, eased formation, fade and cursor repulsion.
const el = document.getElementById("splash");
const skip = !el || document.documentElement.classList.contains("no-splash");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const TEXT = "SECRETARÍA IDDI";
const COLORS = ["#ffffff", "#4a8af0", "#ffffff", "#d4ad37"];   // white, church blue, gold
const FORM_MS = reduced ? 0 : 2600;   // flying in
const MIN_MS = 7000;                  // the opening always lasts at least this long
const OUT_MS = reduced ? 0 : 900;     // particles leave
const FADE_MS = 600;                  // screen fades to the app
const MAX_MS = 15000;                 // never block the app longer than this

if (el && skip) el.remove();
if (el && !skip) start();

function start() {
  const t0 = performance.now();
  let ready = !!window.__appReady, leaving = false, done = false, raf = 0;
  let lang = "es"; try { lang = localStorage.getItem("iddi.lang") || "es"; } catch (e) { /* ignore */ }
  el.querySelector(".splash-cap").textContent = lang === "en" ? "Iglesia de Dios (Israelita) · Secretarial and Ministerial Management System" : "Iglesia de Dios (Israelita) · Sistema de Gestión Secretarial y Ministerial";
  const skipBtn = el.querySelector(".splash-skip");
  skipBtn.textContent = lang === "en" ? "Skip" : "Omitir";
  window.addEventListener("iddi:ready", () => { ready = true; }, { once: true });

  const canvas = el.querySelector("canvas"), ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1, n = 0;
  let ox, oy, sx, sy, rx, ry, col;
  let form = 0, last = 0;           // 0 = at spawn (outside, invisible) … 1 = formed
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const pointer = { x: -1e5, y: -1e5, on: false, px: -1e5, py: -1e5, speed: 0 }, smooth = { x: -1e5, y: -1e5 };

  function sample() {
    const r = el.getBoundingClientRect();
    W = Math.floor(r.width); H = Math.floor(r.height);
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const off = document.createElement("canvas"); off.width = W; off.height = H;
    const o = off.getContext("2d", { willReadFrequently: true });
    const family = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    let size = 150;
    o.font = `800 ${size}px ${family}`;
    const m = o.measureText(TEXT);
    size = Math.max(18, Math.min(size, size * (W * 0.86) / (m.width || 1), H * 0.22));
    o.font = `800 ${size}px ${family}`; o.textAlign = "center"; o.textBaseline = "middle"; o.fillStyle = "#fff";
    o.fillText(TEXT, W / 2, H * 0.47);
    const data = o.getImageData(0, 0, W, H).data;
    const stride = Math.max(2, Math.round(size / 48));      // denser on big screens, lighter on phones
    const pts = [];
    for (let y = 0; y < H; y += stride) for (let x = 0; x < W; x += stride) if (data[(y * W + x) * 4 + 3] > 128) pts.push(x, y);
    n = Math.min(pts.length / 2, 24000);
    ox = new Float32Array(n); oy = new Float32Array(n); sx = new Float32Array(n); sy = new Float32Array(n);
    rx = new Float32Array(n); ry = new Float32Array(n); col = new Uint8Array(n);
    const step = pts.length / 2 / n;
    for (let i = 0; i < n; i++) {
      const k = Math.floor(i * step) * 2;
      ox[i] = pts[k]; oy[i] = pts[k + 1];
      const a = Math.random() * Math.PI * 2, rad = Math.max(W, H) * (0.6 + Math.random() * 0.5);
      sx[i] = W / 2 + Math.cos(a) * rad; sy[i] = H / 2 + Math.sin(a) * rad;
      col[i] = Math.floor(Math.random() * COLORS.length);
    }
  }

  const buckets = COLORS.map(() => []);
  function frame(now) {
    const dt = Math.min(64, last ? now - last : 16); last = now;
    const elapsed = now - t0;
    if (!leaving && ((ready && elapsed >= MIN_MS - OUT_MS - FADE_MS) || elapsed >= MAX_MS)) leaving = true;
    const target = leaving ? 0 : 1, rate = leaving ? (OUT_MS ? dt / OUT_MS : 1) : (FORM_MS ? dt / FORM_MS : 1);
    form = target > form ? Math.min(1, form + rate) : Math.max(0, form - rate);
    if (leaving && form <= 0) return finish();

    ctx.clearRect(0, 0, W, H);
    const forming = form < 1, f = easeOut(form);
    const hit = pointer.speed; pointer.speed *= 0.88;
    const active = !forming && pointer.on;
    if (active) {
      if (smooth.x < -9e4) { smooth.x = pointer.x; smooth.y = pointer.y; }
      else { const l = Math.max(0.08, 0.3 - hit * 0.006); smooth.x += (pointer.x - smooth.x) * l; smooth.y += (pointer.y - smooth.y) * l; }
    } else { smooth.x = smooth.y = -1e5; }
    const R = Math.max(40, Math.min(W, H) * 0.07), R2 = R * R;
    for (const b of buckets) b.length = 0;
    for (let i = 0; i < n; i++) {
      if (forming) { buckets[col[i]].push(sx[i] + (ox[i] - sx[i]) * f, sy[i] + (oy[i] - sy[i]) * f); continue; }
      let inZone = false;
      if (active) {
        const dx = ox[i] - smooth.x, dy = oy[i] - smooth.y, d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < R2) {
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (1 - d / R) * hit * 1.5;
          rx[i] += nx * push; ry[i] += ny * push;
          rx[i] += (nx * (R - d) - rx[i]) * 0.06; ry[i] += (ny * (R - d) - ry[i]) * 0.06;
          inZone = true;
        }
      }
      if (!inZone) { rx[i] *= 0.97; ry[i] *= 0.97; }
      buckets[col[i]].push(ox[i] + rx[i], oy[i] + ry[i]);
    }
    const s = Math.max(1.6, Math.min(2.6, W / 520)), h = s / 2;
    ctx.globalAlpha = forming ? f : 1;
    buckets.forEach((b, c) => { ctx.fillStyle = COLORS[c]; for (let k = 0; k < b.length; k += 2) ctx.fillRect(b[k] - h, b[k + 1] - h, s, s); });
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    if (done) return; done = true;
    cancelAnimationFrame(raf);
    try { sessionStorage.setItem("iddi.splash", "1"); } catch (e) { /* ignore */ }
    el.classList.add("out");
    setTimeout(() => el.remove(), FADE_MS);
  }
  const leaveNow = () => { leaving = true; if (reduced || form <= 0) finish(); };

  el.addEventListener("pointermove", (e) => {
    const x = e.clientX, y = e.clientY;
    if (pointer.px > -9e4) pointer.speed = Math.hypot(x - pointer.px, y - pointer.py);
    pointer.px = x; pointer.py = y; pointer.x = x; pointer.y = y; pointer.on = true;
  });
  el.addEventListener("pointerleave", () => { pointer.on = false; pointer.px = pointer.py = -1e5; });
  skipBtn.addEventListener("click", (e) => { e.stopPropagation(); leaveNow(); });
  window.addEventListener("keydown", (e) => { if (!done && e.key === "Escape") leaveNow(); });
  new ResizeObserver(() => { if (!done) sample(); }).observe(el);

  sample();
  raf = requestAnimationFrame(frame);
}

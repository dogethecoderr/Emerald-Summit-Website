/**
 * Summit: a stepped mountain of six rounded terraces, each a little smaller
 * and set a little further back than the one under it, with a flag at the
 * peak. The pointer's height picks a terrace: the gaps on either side of it
 * open, wider the nearer they are, staggered outwards from it, and the
 * terrace slides out towards the viewer. Each terrace is numbered, from the
 * peak down, by the dots along its front step. The slider is the gap, in
 * world units.
 *
 * The pattern: discrete items stacked. Tweens, a stagger by distance, gaps
 * that only ever add (so no terrace passes through another mid-stagger), and
 * a hit test on static bands taken from the rest pose.
 */
const {
  Cam, clamp, facing, fit, fillet, poly, prism, proj, rings,
  tdone, tset, tval, tween, disposer, flatDot, mk, place, pointer, put, register, solid,
} = HL;

const N = 6;
const SIDE = [124, 104, 86, 68, 52, 36];
const TH = [15, 13, 13, 12, 11, 10];
const CX = (k) => 62 - k * 4, CY = (k) => 62 - k * 2.5;
const SLIDE = 9, POLE = 34, FW = 24, FH = 15;
const FLAG = [[0, 0], [FW, 0], [FW, -FH], [0, -FH]];
const FALL = [1, 0.45, 0.2, 0.1, 0.05];
const BASEZ = TH.map((_, k) => TH.slice(0, k).reduce((a, b) => a + b, 0));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let GAP = value;

  // Fitted to the most extreme pose: every gap open at the slider's top and the picked terrace slid out.
  const C = Cam(45, 0.5, 1.36);
  const zMax = BASEZ[N - 1] + TH[N - 1] + POLE + 2.8 * 26;
  fit(C, [[-2, -2, 0], [128, 128, 0], [128, -2, 0], [-2, 128, 0], [CX(5), CY(5), zMax], [SIDE[0] + SLIDE, SIDE[0] + SLIDE, 0]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const tiers = [];
  for (let k = 0; k < N; k++) {
    const h = SIDE[k] / 2;
    const [ring, inner] = rings(CX(k) - h, CY(k) - h, CX(k) + h, CY(k) + h, Math.min(9, h * 0.35), 1.8);
    const el = solid(g);
    el.g.setAttribute("data-tier", String(k));
    // the terrace's number, counted from the peak: N - k dots along its front step, where the terrace above leaves it bare
    const dots = [];
    for (let d = 0; d < N - k; d++) dots.push(flatDot(g, C, 1, "dot off"));
    tiers.push({ k, h, ring, inner, el, dots, gap: tween(0), slide: tween(0) });
  }
  // the flag: a pole and Emerald High's flag, riding the top terrace. The page
  // colours the flag (data-flag); its letters sit on the cloth's own plane.
  const pole = solid(g), flag = mk("g", { "data-flag": "" }, g);
  const pennant = mk("path", { class: "sil hi" }, flag);
  const letters = mk("text", { "text-anchor": "middle", "dominant-baseline": "central" }, flag);
  letters.textContent = "EHS";
  const [pr, pi] = rings(-1.3, -1.3, 1.3, 1.3, 1.3, 0.5);
  const flagShape = fillet(FLAG, [0.6, 1.4, 1.4, 0.6], 3);

  function draw(now) {
    let z = 0;
    tiers.forEach((t) => {
      z += tval(t.gap, now);
      const z0 = BASEZ[t.k] + z, z1 = z0 + TH[t.k], s = tval(t.slide, now);
      const ring = t.ring.map((q) => ({ ...q, u: q.u + s, v: q.v + s }));
      const inner = t.inner.map((q) => ({ ...q, u: q.u + s, v: q.v + s }));
      put(t.el, prism(P, front, ring, inner, z0, z1));
      const n = t.dots.length, fy = CY(t.k) + t.h - 3.5 + s;
      t.dots.forEach((el, d) => place(el, P(CX(t.k) + (d - (n - 1) / 2) * 4.2 + s, fy, z1)));
      t.top = z1; t.s = s;
    });
    const top = tiers[N - 1], px = CX(N - 1) - 6 + top.s, py = CY(N - 1) - 6 + top.s;
    const pring = pr.map((q) => ({ ...q, u: q.u + px, v: q.v + py })), pinner = pi.map((q) => ({ ...q, u: q.u + px, v: q.v + py }));
    put(pole, prism(P, front, pring, pinner, top.top, top.top + POLE));
    const fz = top.top + POLE, at = (u, v) => P(px + u * 0.7, py - u * 0.7, fz + v);
    pennant.setAttribute("d", poly(flagShape.map(([u, v]) => at(u, v))));
    // the cloth's plane as an affine map: one unit across, one unit down
    const o = at(0, 0), eu = at(1, 0), ev = at(0, -1);
    letters.setAttribute("transform", `matrix(${eu[0] - o[0]} ${eu[1] - o[1]} ${ev[0] - o[0]} ${ev[1] - o[1]} ${o[0]} ${o[1]})`);
    letters.setAttribute("x", String(FW / 2));
    letters.setAttribute("y", String(FH / 2));
  }

  const B = register(stage, (_dt, now) => {
    draw(now);
    return tiers.some((t) => !tdone(t.gap, now) || !tdone(t.slide, now));
  });
  bag.add(B.unregister);

  // hit bands: halfway between the screen heights of neighbouring terraces' top centres, at rest. They never move.
  const mid = tiers.map((t) => P(CX(t.k), CY(t.k), BASEZ[t.k] + TH[t.k])[1]);
  const bandTop = mid.map((y, k) => (k < N - 1 ? (y + mid[k + 1]) / 2 : y));
  const bandFoot = P(CX(0) + SIDE[0] / 2, CY(0) + SIDE[0] / 2, 0)[1], peakY = P(CX(N - 1), CY(N - 1), BASEZ[N - 1] + TH[N - 1] + POLE)[1];
  const xs = tiers[0].ring.map((q) => P(q.u, q.v, 0)[0]), xL = Math.min(...xs), xR = Math.max(...xs);

  /** The terrace whose band holds the pointer's height; -1 off the mountain. */
  function hit([x, y]) {
    if (x < xL || x > xR) return -1;
    for (let k = 0; k < N; k++) {
      const lower = k === 0 ? bandFoot : bandTop[k - 1], upper = k === N - 1 ? peakY : bandTop[k];
      if (y <= lower && y > upper) return k;
    }
    return -1;
  }

  let act = -1;
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    act = a;
    tiers.forEach((t, i) => {
      const d = a < 0 ? -1 : Math.min(Math.abs(i - 1 - a), Math.abs(i - a));
      const delay = Math.abs(i - from) * 45;
      tset(t.gap, i === 0 || d < 0 ? 0 : GAP * FALL[clamp(d, 0, 4)], now, delay);
      tset(t.slide, i === a ? SLIDE : 0, now, delay);
      t.el.sil.classList.toggle("hi", i === a);
      t.dots.forEach((el) => el.setAttribute("class", i === a ? "dot" : "dot off"));
    });
    pennant.classList.toggle("hi", a < 0);
    read.textContent = a < 0 ? "rest" : `tier ${N - a}`;
    B.wake();
  }

  // The pointer picks a terrace, by hover or by a tap: it comes out and stays out
  // after the pointer leaves, and the page hears which one (the "hairline:pick" event).
  let pin = -1;
  // The page hears terraces counted from the peak down: 0 is the top one.
  const pick = (i) => stage.dispatchEvent(new CustomEvent("hairline:pick", { detail: N - 1 - i }));
  /** The pointer is over part i (or nothing, -1): it comes out, and stays out once the pointer moves off. */
  const take = (i) => {
    if (i < 0) { setActive(pin); return; }
    setActive(i);
    if (i !== pin) { pin = i; pick(i); }
  };
  bag.add(pointer(stage, {
    move: (p) => take(hit(p)),
    down: (p) => take(hit(p)),
    leave: () => setActive(pin),
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { GAP = v; const a = act; act = -2; setActive(a); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "summit",
  means: "The day as a climb: six terraces, check-in to awards, and the one at the pointer's height slides out as the gaps open.",
  rules: [1, 2, 5, 8],
  range: [8, 16, 26],
  tour: [[193, 143], [197, 192], [200, 228], null],
  mount,
});

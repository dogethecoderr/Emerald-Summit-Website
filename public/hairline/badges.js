/**
 * Badges: a rack of five lanyard badges hanging from a rail between two
 * posts. The badge under the pointer swings forward and up on its lanyard,
 * and its neighbours slide apart along the rail, staggered outwards from it.
 * Each badge is numbered by the dots punched along its foot, and carries what
 * a badge has: a clip slot, a photo square and two name lines. The slider is
 * how far the neighbours part, in world units.
 *
 * The pattern: discrete items. Tweens, a stagger by distance, identity carried
 * by geometry, and a hit test on each badge's resting centre, so a badge
 * swinging out from under the pointer cannot flip the choice.
 */
const {
  Cam, clamp, facing, fillet, fit, poly, open, prism, proj, rad, rings, rrect, seg,
  tdone, tset, tval, tween, disposer, mk, place, pointer, put, register, solid,
} = HL;

const N = 5, RW = 186, RH = 86, SL = 38, CW = 28, CH = 36, TK = 1.3;
const XC = (i) => 22 + i * 35;
const REST = [6, -3, 8, -5, 4], SWING = 64, BACK = -6;
const FALL = [0, 1, 0.55, 0.3, 0.15];

/** Badge outline in its own plane: u across, v down from the rail. */
const OUTLINE = fillet([[-CW / 2, SL], [CW / 2, SL], [CW / 2, SL + CH], [-CW / 2, SL + CH]], [3, 3, 3, 3]);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let PART = value;

  const C = Cam(45, 0.5, 1.46);
  const far = SL + CH;
  fit(C, [[-16, -18, 0], [RW + 16, 18, 0], [-16, 18, 0], [RW + 16, -18, 0], [0, 0, RH + 8], [RW, 0, RH + 8],
    [XC(N - 1) + CW + 16, far * Math.sin(rad(SWING)), RH - far * Math.cos(rad(SWING))], [-CW, far * Math.sin(rad(SWING)), RH - far * Math.cos(rad(SWING))]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const block = (x0, y0, x1, y1, r, b, z0, z1) => { const [ring, inner] = rings(x0, y0, x1, y1, r, b); put(solid(g), prism(P, front, ring, inner, z0, z1)); };
  // back to front: the left foot and post, the rail, the badges by x, then the right post and foot
  block(-18, -16, 2, 16, 5, 1.2, 0, 4);
  block(-11, -3, -5, 3, 2.5, 0.8, 4, RH + 5);
  block(-8, -2.5, RW + 8, 2.5, 2.4, 0.8, RH - 2.5, RH + 2.5);

  const badges = [];
  for (let i = 0; i < N; i++) {
    const grp = mk("g", {}, g);
    const strap = mk("path", { class: "nf" }, grp);
    const back = mk("path", { class: "lo" }, grp), face = mk("path", { class: "sil" }, grp);
    const clip = mk("path", { class: "nf" }, grp), photo = mk("path", { class: "nf lo" }, grp), lines = mk("path", { class: "nf lo" }, grp);
    const dots = [];
    for (let k = 0; k <= i; k++) dots.push(mk("circle", { r: 1.1, class: i === 0 ? "dot" : "dot off" }, grp));
    badges.push({ i, grp, strap, back, face, clip, photo, lines, dots, a: tween(REST[i]), x: tween(0) });
  }
  const right = mk("g", {}, g);
  { const [ring, inner] = rings(RW + 5, -3, RW + 11, 3, 2.5, 0.8); put(solid(right), prism(P, front, ring, inner, 4, RH + 5)); }
  { const [ring, inner] = rings(RW - 2, -16, RW + 18, 16, 5, 1.2); put(solid(right), prism(P, front, ring, inner, 0, 4)); }

  function draw(b, th, dx) {
    const s = Math.sin(rad(th)), c = Math.cos(rad(th)), x0 = XC(b.i) + dx;
    const w = (u, v) => P(x0 + u, v * s, RH - v * c);
    const wb = (u, v) => P(x0 + u, v * s - TK * c, RH - v * c - TK * s);
    b.strap.setAttribute("d", open([w(-8, 0), w(0, SL - 3), w(8, 0)]));
    b.back.setAttribute("d", poly(OUTLINE.map(([u, v]) => wb(u, v))));
    b.face.setAttribute("d", poly(OUTLINE.map(([u, v]) => w(u, v))));
    b.clip.setAttribute("d", poly(rrect(-5, SL + 3, 5, SL + 6, 1.4, 3).map((q) => w(q.u, q.v))));
    b.photo.setAttribute("d", poly(rrect(-11, SL + 10, -2, SL + 21, 1.6, 3).map((q) => w(q.u, q.v))));
    b.lines.setAttribute("d", seg(w(1, SL + 12), w(11, SL + 12)) + seg(w(1, SL + 16), w(11, SL + 16)) + seg(w(1, SL + 20), w(7, SL + 20)));
    const n = b.dots.length;
    b.dots.forEach((el, k) => place(el, w((k - (n - 1) / 2) * 4.4, SL + CH - 6)));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const b of badges) { draw(b, tval(b.a, now), tval(b.x, now)); if (!tdone(b.a, now) || !tdone(b.x, now)) moving = true; }
    return moving;
  });
  bag.add(B.unregister);

  // hit: the badge whose resting centre is nearest the pointer's screen x, inside the rack's height. Static.
  const centre = badges.map((b) => P(XC(b.i), 0, RH - SL - CH / 2)[0]);
  const yTop = P(0, 0, RH + 6)[1] - 4, yFoot = P(RW, 0, RH - far)[1] + 24;
  function hit([x, y]) {
    if (y < yTop || y > yFoot || x < centre[0] - 26 || x > centre[N - 1] + 26) return -1;
    let best = 0;
    centre.forEach((cx, i) => { if (Math.abs(cx - x) < Math.abs(centre[best] - x)) best = i; });
    return best;
  }

  let act = -1;
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : Math.max(act, 0);
    act = a;
    badges.forEach((b, i) => {
      const d = Math.abs(i - from), delay = d * 45;
      const th = a < 0 ? REST[i] : i === a ? SWING : BACK;
      tset(b.a, th, now, delay);
      tset(b.x, a < 0 || i === a ? 0 : Math.sign(i - a) * PART * FALL[clamp(Math.abs(i - a), 0, 4)], now, delay);
      b.face.classList.toggle("hi", i === a);
      b.dots.forEach((el) => el.setAttribute("class", i === a || (a < 0 && i === 0) ? "dot" : "dot off"));
    });
    read.textContent = a < 0 ? "rest" : `badge ${a + 1}`;
    B.wake();
  }

  // The pointer picks a badge, by hover or by a tap: it swings out and stays out
  // after the pointer leaves, and the page hears which one (the "hairline:pick" event).
  let pin = -1;
  const pick = (i) => stage.dispatchEvent(new CustomEvent("hairline:pick", { detail: i }));
  /** The pointer is over badge i (or nothing, -1): it swings out, and stays out once the pointer moves off. */
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
    set: (v) => { PART = v; const a = act; act = -2; setActive(a); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "badges",
  means: "Five lanyard badges on a rack: the one under the pointer swings forward, and the others slide apart along the rail.",
  rules: [1, 2, 4, 10],
  range: [4, 10, 16],
  tour: [[158, 142], [230, 178], [302, 214], null],
  mount,
});

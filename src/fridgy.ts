import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const COLORS = {
  sage: 0xa2b19a,
  deepSage: 0x738568,
  cream: 0xf4e3be,
  ivory: 0xfffaf0,
  leaf: 0x82a52f,
  gold: 0xffd166,
  peach: 0xf0bd96,
  taupe: 0xb5a684,
  forest: 0x253426,
};

export type Mood = "happy" | "sad" | "surprised";

/** Animatable pose, tweened by the page. Values are 0..1 blends. */
export interface Pose {
  open: number;
  wave: number;
  celebrate: number;
  spoil: number;
  /** Swaps the shelf contents for a sizzling pan in Fridgy's belly. */
  pan: number;
}

/** Height of the model at scale 1, feet at y = 0. */
export const FRIDGY_HEIGHT = 2.75;

const mat = (color: number, roughness = 0.6) => new THREE.MeshStandardMaterial({ color, roughness });

export function createFridgy() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const sage = mat(COLORS.sage);
  const cream = mat(COLORS.cream, 0.45);
  const taupe = mat(COLORS.taupe, 0.4);
  const forest = mat(COLORS.forest, 0.3);
  const white = mat(0xffffff, 0.25);
  const ink = new THREE.MeshBasicMaterial({ color: COLORS.forest }); // flat, so the mouth never catches highlights

  const cabinet = new THREE.Mesh(new RoundedBoxGeometry(1.6, 2.4, 1.2, 6, 0.24), sage);
  cabinet.position.y = 1.45;
  body.add(cabinet);

  // Inner wall, revealed when the lower door swings open
  const glow = new THREE.MeshStandardMaterial({ color: 0xe9dcb8, emissive: COLORS.gold, emissiveIntensity: 0, roughness: 0.8 });
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 1.22), glow);
  inner.position.set(0, 0.94, 0.605);
  body.add(inner);

  const light = new THREE.PointLight(COLORS.gold, 0, 4, 1.5);
  light.position.set(0, 1, 1.1);
  body.add(light);

  function door(h: number, y: number) {
    const pivot = new THREE.Group();
    pivot.position.set(0.72, y, 0.66); // hinge on the right, like the illustrations
    const panel = new THREE.Mesh(new RoundedBoxGeometry(1.44, h, 0.12, 4, 0.05), cream);
    panel.position.set(-0.72, 0, 0.06);
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, h * 0.32, 4, 12), taupe);
    handle.position.set(-1.3, 0, 0.16);
    pivot.add(panel, handle);
    body.add(pivot);
    return pivot;
  }
  const topDoor = door(0.95, 2.095);
  const bottomDoor = door(1.25, 0.935);

  // Face lives on the top door
  const face = new THREE.Group();
  face.position.set(-0.64, 0.02, 0.12);
  topDoor.add(face);

  const eyes: THREE.Group[] = [];
  const irises: THREE.Group[] = [];
  const brows: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.24, 0.08, 0);
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), white);
    sclera.scale.set(1, 1.12, 0.45);
    const iris = new THREE.Group();
    iris.position.z = 0.03;
    const irisBall = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 16), forest);
    irisBall.scale.set(1, 1.1, 0.5);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(0.035, 0.045, 0.055);
    iris.add(irisBall, shine);
    eye.add(sclera, iris);
    face.add(eye);
    eyes.push(eye);
    irises.push(iris);

    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.12, 4, 8), forest);
    brow.rotation.z = Math.PI / 2;
    brow.position.set(s * 0.24, 0.3, 0.02);
    face.add(brow);
    brows.push(brow);

    const cheek = new THREE.Mesh(
      new THREE.CircleGeometry(0.075, 24),
      new THREE.MeshStandardMaterial({ color: COLORS.peach, transparent: true, opacity: 0.85, roughness: 0.9 }),
    );
    cheek.position.set(s * 0.42, -0.1, 0.006);
    face.add(cheek);
  }

  const smileShape = new THREE.Shape();
  smileShape.absarc(0, 0, 0.11, Math.PI, Math.PI * 2, false);
  const smile = new THREE.Mesh(new THREE.ShapeGeometry(smileShape, 24), ink);
  smile.position.set(0.02, -0.1, 0.007);

  const frown = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.09, -0.2, 0), new THREE.Vector3(0, -0.12, 0), new THREE.Vector3(0.09, -0.2, 0)),
      16,
      0.02,
      8,
    ),
    ink,
  );
  frown.position.set(0.02, 0.02, 0.01);

  const ohShape = new THREE.Shape();
  ohShape.absellipse(0, 0, 0.055, 0.075, 0, Math.PI * 2, false, 0);
  const oh = new THREE.Mesh(new THREE.ShapeGeometry(ohShape, 24), ink);
  oh.position.set(0.02, -0.15, 0.007);
  face.add(smile, frown, oh);

  // Leaf badge on the lower door
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, -0.16);
  leafShape.bezierCurveTo(0.14, -0.08, 0.12, 0.1, 0, 0.18);
  leafShape.bezierCurveTo(-0.12, 0.1, -0.14, -0.08, 0, -0.16);
  const leaf = new THREE.Mesh(
    new THREE.ExtrudeGeometry(leafShape, { depth: 0.015, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 }),
    mat(COLORS.leaf, 0.5),
  );
  leaf.position.set(-0.4, 0.25, 0.12);
  leaf.rotation.z = -0.5;
  bottomDoor.add(leaf);

  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.82, 1.85, 0.05);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.5, 6, 16), sage);
    arm.position.y = -0.35;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), sage);
    hand.scale.set(1, 0.9, 0.8);
    hand.position.y = -0.72;
    shoulder.add(arm, hand);
    body.add(shoulder);
    arms.push(shoulder);

    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), sage);
    foot.scale.set(1, 0.55, 1.25);
    foot.position.set(s * 0.42, 0.13, 0.08);
    body.add(foot);
  }

  // Shelf contents of the lower compartment, shown only while the door is open
  const shelf = new THREE.Group();
  body.add(shelf);
  for (const y of [0.72, 1.14]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.03, 0.3), cream);
    board.position.set(0, y, 0.75);
    shelf.add(board);
  }

  const items: Record<string, THREE.Mesh> = {};
  const home = new Map<THREE.Object3D, THREE.Vector3>();
  const put = (name: string, mesh: THREE.Mesh, x: number, y: number, z = 0.78) => {
    mesh.position.set(x, y, z);
    home.set(mesh, mesh.position.clone());
    shelf.add(mesh);
    items[name] = mesh;
  };

  const carton = new THREE.BoxGeometry(0.16, 0.3, 0.16);
  put("milkOld", new THREE.Mesh(carton, white), -0.5, 0.885);
  put("milk1", new THREE.Mesh(carton, white), -0.3, 0.885);
  put("milk2", new THREE.Mesh(carton, white), -0.12, 0.885);
  const greensMat = mat(COLORS.leaf, 0.7);
  const greens = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), greensMat);
  greens.scale.set(1.3, 0.8, 1);
  put("greens", greens, 0.35, 0.82);

  const egg = new THREE.SphereGeometry(0.055, 16, 12);
  const eggMat = mat(0xfff3dc, 0.4);
  [-0.5, -0.38, -0.26].forEach((x, i) => {
    const m = new THREE.Mesh(egg, eggMat);
    m.scale.y = 1.25;
    put(`egg${i}`, m, x, 1.225);
  });
  const chicken = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.12, 0.22, 3, 0.05), mat(COLORS.peach, 0.5));
  put("chicken", chicken, 0.0, 1.215);
  const tomato = new THREE.SphereGeometry(0.065, 16, 12);
  const tomatoMat = mat(0xd9583f, 0.45);
  [0.24, 0.36, 0.48, 0.3, 0.42].forEach((x, i) => put(`tomato${i}`, new THREE.Mesh(tomato, tomatoMat), x, i < 3 ? 1.22 : 1.33, i < 3 ? 0.78 : 0.72));

  // A sizzling pan in the belly for the cooking moments
  const panGroup = new THREE.Group();
  panGroup.position.set(0, 0.86, 0.86);
  panGroup.rotation.x = 0.6;
  body.add(panGroup);
  const skillet = new THREE.Mesh(
    new THREE.LatheGeometry(
      [new THREE.Vector2(0, 0), new THREE.Vector2(0.3, 0), new THREE.Vector2(0.34, 0.06), new THREE.Vector2(0.37, 0.1)],
      40,
    ),
    new THREE.MeshStandardMaterial({ color: 0x3a463b, roughness: 0.35, metalness: 0.4, side: THREE.DoubleSide }),
  );
  const panHandle = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.34, 4, 10), taupe);
  panHandle.rotation.z = Math.PI / 2;
  panHandle.position.set(0.56, 0.08, 0);
  panGroup.add(skillet, panHandle);

  const eggWhite = mat(0xfffdf6, 0.5);
  const yolk = mat(COLORS.gold, 0.35);
  for (const [x, z] of [[-0.11, -0.04], [0.12, 0.08]]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 10), eggWhite);
    white.scale.set(1, 0.14, 1);
    white.position.set(x, 0.025, z);
    const y = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10), yolk);
    y.position.set(x, 0.045, z);
    panGroup.add(white, y);
  }
  const bit = new THREE.BoxGeometry(0.05, 0.03, 0.05);
  const veg = [mat(COLORS.leaf, 0.6), mat(0xd9583f, 0.45)];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(bit, veg[i % 2]);
    const a = i * 2.4;
    const r = 0.16 + (i % 3) * 0.04;
    m.position.set(Math.cos(a) * r, 0.03, Math.sin(a) * r);
    m.rotation.y = a;
    panGroup.add(m);
  }

  const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  const steam = Array.from({ length: 6 }, () => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), steamMat.clone());
    body.add(puff);
    return puff;
  });

  // Celebration sparkles
  const count = 60;
  const pts = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.3 + Math.random() * 0.9;
    pts.set([Math.cos(a) * r, 0.4 + Math.random() * 2.8, Math.sin(a) * r * 0.6], i * 3);
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  const sparkMat = new THREE.PointsMaterial({ color: COLORS.gold, size: 0.09, transparent: true, opacity: 0, depthWrite: false });
  const sparkles = new THREE.Points(sparkGeo, sparkMat);
  root.add(sparkles);

  // Soft contact shadow, cheaper than shadow maps and follows Fridgy everywhere
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(37,52,38,0.35)");
  grad.addColorStop(1, "rgba(37,52,38,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 1.4),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  const pose: Pose = { open: 0, wave: 0, celebrate: 0, spoil: 0, pan: 0 };
  /** Extra door opening driven by the chat demo, combined with the scroll pose. */
  const extra = { open: 0 };
  let mood: Mood = "happy";
  const fresh = new THREE.Color(COLORS.leaf);
  const spoiled = new THREE.Color(0x8b7d55);

  function setMood(m: Mood) {
    mood = m;
    smile.visible = m === "happy";
    frown.visible = m === "sad";
    oh.visible = m === "surprised";
    brows.forEach((b, i) => {
      const s = i === 0 ? -1 : 1;
      b.rotation.z = Math.PI / 2 + (m === "sad" ? -s * 0.35 : m === "happy" ? s * 0.12 : 0);
      b.position.y = m === "surprised" ? 0.34 : 0.3;
    });
  }
  setMood("happy");

  function update(t: number, pointer: { x: number; y: number }, motion: number) {
    body.position.y = Math.sin(t * 2.2) * 0.04 * motion + Math.abs(Math.sin(t * 5)) * 0.15 * pose.celebrate * motion;
    body.rotation.z = (Math.sin(t * 1.4) * 0.025 + (mood === "sad" ? Math.sin(t * 3) * 0.03 : 0)) * motion;

    const open = Math.max(pose.open, extra.open);
    bottomDoor.rotation.y = open * 1.9;
    const cooking = pose.pan > 0.5;
    shelf.visible = open > 0.15 && !cooking;
    panGroup.visible = open > 0.15 && pose.pan > 0.01;
    panGroup.scale.setScalar(pose.pan);
    panGroup.position.y = 0.86 + Math.sin(t * 22) * 0.004 * motion;
    steam.forEach((puff, i) => {
      const p = (t * 0.45 + i / steam.length) % 1;
      puff.visible = panGroup.visible;
      puff.position.set(Math.sin(p * 6 + i) * 0.1 + (i % 2 ? 0.1 : -0.1), 1.0 + p * 0.9, 0.95);
      puff.scale.setScalar(0.6 + p * 1.2);
      (puff.material as THREE.MeshBasicMaterial).opacity = Math.sin(p * Math.PI) * 0.55 * pose.pan * open;
    });
    glow.emissiveIntensity = open * 0.35;
    light.intensity = open * 4;

    const wave = 2.5 + Math.sin(t * 7) * 0.35 * motion;
    const cheer = 2.7 + Math.sin(t * 8) * 0.2 * motion;
    const right = THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.3, wave, pose.wave), cheer, pose.celebrate);
    const left = THREE.MathUtils.lerp(0.3, cheer, pose.celebrate);
    arms[1].rotation.z = right;
    arms[0].rotation.z = -left;

    irises.forEach((iris) => iris.position.set(pointer.x * 0.035, pointer.y * 0.03, 0.03));
    const phase = t % 3.6;
    const lid = phase < 0.14 ? 1 - Math.sin((phase / 0.14) * Math.PI) * 0.9 : 1;
    eyes.forEach((e) => (e.scale.y = lid));

    greensMat.color.lerpColors(fresh, spoiled, pose.spoil);
    sparkMat.opacity = pose.celebrate;
    sparkles.rotation.y = t * 0.3;
  }

  return { root, pose, extra, items, home, setMood, update };
}

export type Fridgy = ReturnType<typeof createFridgy>;

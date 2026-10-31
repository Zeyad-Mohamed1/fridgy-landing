import "./style.css";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createFridgy, FRIDGY_HEIGHT, type Fridgy, type Mood } from "./fridgy";

gsap.registerPlugin(ScrollTrigger);

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const motion = reduce ? 0 : 1;

interface Stage {
  ax: number; // horizontal anchor, -1 (left edge) .. 1 (right edge)
  ay: number; // vertical anchor, -1 (bottom) .. 1 (top)
  s: number;
  ry: number;
  open: number;
  wave: number;
  celebrate: number;
  spoil: number;
  pan: number;
  mood: Mood;
}

const base: Stage = { ax: 0.48, ay: 0, s: 1, ry: -0.4, open: 0, wave: 0, celebrate: 0, spoil: 0, pan: 0, mood: "happy" };
const big = (o: Partial<Stage> = {}): Stage => ({ ...base, ...o });
// Small Fridgy leaning out from the corner next to the illustration
const narrator = (side: 1 | -1, o: Partial<Stage> = {}): Stage =>
  big({ ax: side * 0.84, ay: -0.6, s: 0.5, ry: side * -0.55, ...o });

const STATES: Record<string, Stage> = {
  hero: big({ ax: 0.45, s: 1.05, ry: -0.35, wave: 1 }),
  opening: narrator(1, { wave: 1 }),
  discovery: narrator(-1, { open: 1, spoil: 1, mood: "surprised" }),
  problem: narrator(1, { mood: "sad" }),
  numbers: big({ s: 0.8, ry: -0.5, mood: "sad" }),
  meet: narrator(-1, { wave: 1 }),
  tell: big({ s: 0.9, ry: -0.5 }),
  cook: narrator(1, { s: 0.6, open: 1, pan: 1 }),
  lifestyle: big({ s: 0.85, ry: -0.95 }),
  kitchen: big({ s: 0.8, ry: -0.3, open: 1, pan: 1 }),
  impact: big({ s: 0.9, ry: -0.2, celebrate: 1 }),
  customers: big({ s: 0.8, ry: -0.5, wave: 1 }),
  business: big({ s: 0.75, ry: -0.6 }),
  closing: big({ s: 0.95, ry: -0.3, wave: 1 }),
};

const narrow = () => innerWidth / innerHeight < 0.85 || innerWidth < 820;

function forViewport(name: string): Stage {
  const st = STATES[name];
  if (!narrow()) return st;
  if (name === "hero") return { ...st, ax: 0, ay: 0.4, s: 0.62, ry: -0.2 };
  // No free column on phones, so Fridgy hops out of view instead of covering the story text
  return { ...st, ax: 0.74, ay: -1.4, s: 0.001, ry: -0.4 };
}

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
  } catch {
    return false;
  }
}

function initStage(): Fridgy | null {
  const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
  if (!webglAvailable()) {
    canvas.hidden = true;
    document.querySelector<HTMLImageElement>(".stage-fallback")!.hidden = false;
    return null;
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  scene.add(new THREE.HemisphereLight(0xfffaf0, 0xa2b19a, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(3, 5, 6);
  const fill = new THREE.DirectionalLight(0xffffff, 0.85);
  fill.position.set(-2, 1, 8);
  scene.add(sun, fill);

  const fridgy = createFridgy();
  scene.add(fridgy.root);

  const cur = { ...forViewport("hero") };
  let active = "hero";
  const pointer = { x: 0, y: 0 };

  function go(name: string) {
    active = name;
    const target = forViewport(name);
    fridgy.setMood(target.mood);
    const { mood: _mood, ...nums } = target;
    gsap.to(cur, { ...nums, duration: reduce ? 0 : 1.1, ease: "power2.inOut", overwrite: true });
    gsap.to(fridgy.pose, {
      open: target.open,
      wave: target.wave,
      celebrate: target.celebrate,
      spoil: target.spoil,
      pan: target.pan,
      duration: reduce ? 0 : 0.9,
      overwrite: true,
    });
  }

  document.querySelectorAll<HTMLElement>("[data-state]").forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: "top 55%",
      end: "bottom 55%",
      onToggle: (self) => self.isActive && go(section.dataset.state!),
    });
  });

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    go(active);
  }
  addEventListener("resize", resize);
  resize();

  addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -((e.clientY / innerHeight) * 2 - 1);
  });

  // One entrance moment: Fridgy hops up into the hero
  if (!reduce) gsap.from(cur, { ay: -1.6, duration: 1.4, ease: "back.out(1.4)", delay: 0.2 });

  renderer.setAnimationLoop((ms) => {
    const t = ms / 1000;
    const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfW = halfH * camera.aspect;
    const scale = cur.s * 1.45;
    fridgy.root.scale.setScalar(scale);
    fridgy.root.position.set(cur.ax * halfW, cur.ay * halfH - (FRIDGY_HEIGHT * scale) / 2, 0);
    fridgy.root.rotation.y = cur.ry + pointer.x * 0.15 * motion;
    fridgy.update(t, pointer, motion);
    renderer.render(scene, camera);
  });

  return fridgy;
}

function initDoors() {
  if (reduce) return;
  document.querySelectorAll<HTMLElement>(".door").forEach((door) => {
    const flip = door.closest(".flip") !== null;
    gsap.fromTo(
      door,
      { "--swing": flip ? "-58deg" : "58deg", "--glow": 0.9 },
      {
        "--swing": "0deg",
        "--glow": 0,
        ease: "none",
        scrollTrigger: { trigger: door, start: "top 95%", end: "center 55%", scrub: 0.6 },
      },
    );
  });
}

function initChat(fridgy: Fridgy | null) {
  const chat = document.querySelector<HTMLElement>(".chat")!;
  const addBtn = chat.querySelector<HTMLButtonElement>('[data-step="add"]')!;
  const useBtn = chat.querySelector<HTMLButtonElement>('[data-step="use"]')!;
  const modes = chat.querySelectorAll<HTMLElement>(".mode");
  const newItems = ["chicken", "milk1", "milk2"];
  const usedTomatoes = ["tomato0", "tomato1", "tomato2"];

  // New groceries are not in the fridge until Sara confirms them
  if (fridgy) newItems.forEach((n) => fridgy.items[n].scale.setScalar(0));

  function doorCycle(fridgy: Fridgy, body: (tl: gsap.core.Timeline) => void) {
    const tl = gsap.timeline({ defaults: { duration: reduce ? 0 : 0.6, ease: "power2.out" } });
    tl.to(fridgy.extra, { open: 1 });
    body(tl);
    tl.to(fridgy.extra, { open: 0, delay: reduce ? 0 : 0.4 });
  }

  addBtn.addEventListener("click", () => {
    addBtn.disabled = true;
    addBtn.textContent = "Added";
    addBtn.nextElementSibling!.removeAttribute("hidden");
    modes.forEach((m) => m.setAttribute("aria-current", String(m.dataset.mode === "use")));
    chat.querySelectorAll("[data-later]").forEach((el) => el.removeAttribute("hidden"));

    if (!fridgy) return;
    doorCycle(fridgy, (tl) => {
      newItems.forEach((n, i) => {
        const item = fridgy.items[n];
        const home = fridgy.home.get(item)!;
        tl.fromTo(item.position, { x: home.x - 3, y: home.y + 2.4, z: home.z + 1.4 }, { x: home.x, y: home.y, z: home.z }, i === 0 ? ">" : "<0.15");
        tl.to(item.scale, { x: 1, y: 1, z: 1 }, "<");
      });
    });
  });

  useBtn.addEventListener("click", () => {
    useBtn.disabled = true;
    useBtn.textContent = "Updated";
    useBtn.nextElementSibling!.removeAttribute("hidden");

    if (!fridgy) return;
    doorCycle(fridgy, (tl) => {
      tl.to(fridgy.items.chicken.scale, { x: 0.6 });
      usedTomatoes.forEach((n, i) => {
        const item = fridgy.items[n];
        tl.to(item.position, { x: item.position.x - 3, y: item.position.y + 2, z: item.position.z + 1.4 }, i === 0 ? "<" : "<0.12");
        tl.to(item.scale, { x: 0, y: 0, z: 0 }, "<");
      });
    });
  });
}

const fridgy = initStage();
initDoors();
initChat(fridgy);

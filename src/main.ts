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
  snap: big({ s: 0.85, ry: -0.7 }),
  cook: narrator(1, { s: 0.6, open: 1, pan: 1 }),
  lifestyle: big({ s: 0.85, ry: -0.95 }),
  kitchen: big({ s: 0.8, ry: -0.3, open: 1, pan: 1 }),
  impact: big({ s: 0.9, ry: -0.2, celebrate: 1 }),
  customers: big({ s: 0.8, ry: -0.5, wave: 1 }),
  // Full-width sections: Fridgy hops out so the screens and plans have the stage
  screens: big({ ax: 0.74, ay: -1.4, s: 0.001 }),
  agentic: big({ ax: 0.74, ay: -1.4, s: 0.001 }),
  business: big({ ax: 0.74, ay: -1.4, s: 0.001 }),
  closing: big({ s: 0.95, ry: -0.3, wave: 1 }),
  team: big({ s: 0.85, ry: -0.45, wave: 1 }),
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
    greet.classList.add("static");
    introDone = true;
    say(GREETING, 0.4);
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
  const head = new THREE.Vector3();
  let active = "hero";
  const pointer = { x: 0, y: 0 };

  function go(name: string) {
    active = name;
    onStage(name);
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

  intro(fridgy, cur);

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

    // Keep the speech bubble pinned just above Fridgy's head
    if (!greet.hidden) {
      // Desktop: beside the face, up and to the left. Phones: centred above the head.
      const side = narrow() ? 0 : -FRIDGY_HEIGHT * scale * 0.16;
      const lift = narrow() ? 0.98 : 0.95;
      head.set(fridgy.root.position.x + side, fridgy.root.position.y + FRIDGY_HEIGHT * scale * lift, 0).project(camera);
      const x = ((head.x + 1) / 2) * innerWidth;
      const y = Math.max(((1 - head.y) / 2) * innerHeight, greet.offsetHeight + 96);
      greet.style.left = `${x}px`;
      greet.style.top = `${y}px`;
    }
  });

  return fridgy;
}

const greet = document.querySelector<HTMLElement>(".greet")!;
const GREETING = "Hello UX Breakfast! 👋 I'm so happy to be here today.";
const GOODBYE = "Bye! It was so nice to meet you today. Now let me introduce the team 👇";

let saying = "";
let typing: gsap.core.Tween | null = null;
let stageName = "hero";
let introDone = false;
let teamLine = "";

/** Fridgy says a line in its speech bubble, typed out letter by letter. */
function say(text: string, delay = 0) {
  const out = greet.querySelector<HTMLElement>("[data-greet]")!;
  greet.hidden = false;
  if (saying === text) return;
  saying = text;
  typing?.kill();
  greet.classList.remove("typed");
  if (reduce) {
    out.textContent = text;
    greet.classList.add("typed");
    return;
  }
  const chars = Array.from(text);
  const typed = { n: 0 };
  out.textContent = "";
  gsap.fromTo(greet.querySelector("p"), { opacity: 0, scale: 0.6, transformOrigin: "85% 100%" }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)", delay, overwrite: true });
  typing = gsap.to(typed, {
    n: chars.length,
    duration: chars.length * 0.04,
    ease: "none",
    delay: delay + 0.25,
    onUpdate: () => (out.textContent = chars.slice(0, Math.round(typed.n)).join("")),
    onComplete: () => greet.classList.add("typed"),
  });
}

// Fridgy talks on the hero (hello), the closing page (bye) and the team page (introductions)
function onStage(name: string) {
  stageName = name;
  const talks = name === "hero" || name === "closing" || name === "team";
  // On phones Fridgy steps off stage after the hero, so the team cards carry its lines instead
  greet.classList.toggle("away", !talks || (narrow() && name !== "hero"));
  if (name === "hero" && introDone) say(GREETING);
  if (name === "closing") say(GOODBYE);
  if (name === "team" && teamLine) say(teamLine);
}

function initTeam(fridgy: Fridgy | null) {
  const section = document.querySelector<HTMLElement>(".team")!;
  const track = section.querySelector<HTMLElement>(".slides-track")!;
  const slides = Array.from(section.querySelectorAll<HTMLElement>(".slide"));
  const tabs = section.querySelectorAll<HTMLButtonElement>("[data-go]");
  // Introduction order: the developers, then the designers, then Fridgy's thank-you
  const items = Array.from(section.querySelectorAll<HTMLElement>(".member, .thanks"));
  const slideOf = (el: HTMLElement) => {
    const slide = el.closest<HTMLElement>(".slide");
    return slide ? slides.indexOf(slide) : slides.length - 1;
  };
  const firstOf = (slide: number) => items.findIndex((el) => slideOf(el) === slide);
  let current = -1;
  let pin: ScrollTrigger | null = null;
  teamLine = items[0].dataset.line!;

  function showSlide(n: number) {
    track.style.setProperty("--slide", String(n));
    tabs.forEach((t) => t.setAttribute("aria-selected", String(Number(t.dataset.go) === n)));
  }

  function activate(i: number) {
    if (i === current) return;
    current = i;
    const el = items[i];
    items.forEach((m) => m.classList.toggle("active", m === el));
    showSlide(slideOf(el));
    teamLine = el.dataset.line!;
    if (stageName === "team") say(teamLine);
    // A little cheer when Fridgy thanks everyone at the end
    if (fridgy && el.classList.contains("thanks") && !reduce) {
      gsap.timeline().to(fridgy.pose, { celebrate: 1, duration: 0.4 }).to(fridgy.pose, { celebrate: 0, duration: 0.5, delay: 1.6 });
    }
  }

  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      const i = firstOf(Number(tab.dataset.go));
      if (pin) {
        // Pinned: jump the scroll to that slide's first introduction
        scrollTo({ top: pin.start + (pin.end - pin.start) * ((i + 0.5) / items.length), behavior: reduce ? "auto" : "smooth" });
      } else {
        activate(i);
      }
    }),
  );

  const mm = gsap.matchMedia();
  // Desktop: hold the team on screen and let Fridgy introduce one person per scroll step
  mm.add("(min-width: 821px) and (min-height: 680px) and (prefers-reduced-motion: no-preference)", () => {
    section.classList.add("team-pinned");
    pin = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: () => `+=${innerHeight * 0.55 * items.length}`,
      pin: true,
      onUpdate: (self) => activate(Math.min(items.length - 1, Math.floor(self.progress * items.length))),
    });
    return () => {
      pin?.kill();
      pin = null;
      section.classList.remove("team-pinned");
    };
  });
  // Phones and reduced motion: the tabs switch slides; Fridgy's lines show inside each card
  mm.add("(max-width: 820px), (max-height: 679px), (prefers-reduced-motion: reduce)", () => {
    const st = ScrollTrigger.create({ trigger: section, start: "top 60%", once: true, onEnter: () => activate(0) });
    return () => st.kill();
  });
}

type Surface = "siri" | "gemini" | "app";
interface AgentDemo {
  app: string;
  engine: string;
  ask: string;
  steps: string[];
  title: string;
  rows: { name: string; note: string; value: string }[];
  action: string;
  reply: string;
}

const AGENT: Record<Surface, AgentDemo> = {
  siri: {
    app: "Siri",
    engine: "Using Fridgy",
    ask: "Hey Siri, tell Fridgy I bought 6 eggs and 2 litres of milk.",
    steps: ["Siri is asking Fridgy", "Adding food", "Fridgy prepared a card"],
    title: "Add 2 items to your fridge?",
    rows: [
      { name: "Eggs", note: "Fridge", value: "6 pcs" },
      { name: "Milk", note: "Fridge door", value: "2 L" },
    ],
    action: "Confirm",
    reply: "Done. Fridgy added 2 items to your fridge.",
  },
  gemini: {
    app: "Gemini",
    engine: "Using Fridgy",
    ask: "What can I cook tonight with what's in my fridge?",
    steps: ["Gemini is using Fridgy", "Checking what's expiring", "Suggesting recipes"],
    title: "Tonight's ideas from your fridge",
    rows: [
      { name: "Chicken and spinach stir-fry", note: "Uses spinach before tomorrow", value: "25 min" },
      { name: "Shakshuka", note: "Eggs, tomatoes and peppers", value: "20 min" },
    ],
    action: "Add missing items to list",
    reply: "The spinach expires tomorrow, so I put the stir-fry first. 1 item added to your shopping list.",
  },
  app: {
    app: "Fridgy AI",
    engine: "Running on your Gemini",
    ask: "Plan my meals for this week.",
    steps: ["Using your connected AI", "Reading your fridge and your profile", "Planning your meals"],
    title: "Your week, planned",
    rows: [
      { name: "Sat · Chicken and spinach stir-fry", note: "Uses spinach first", value: "" },
      { name: "Sun · Shakshuka", note: "From your fridge", value: "" },
      { name: "Mon · Grilled chicken bowl", note: "Training day", value: "" },
    ],
    action: "Save my plan",
    reply: "Saved. The AI work ran on your own account, not Fridgy's.",
  },
};

// Agentic UI explorer: the same Fridgy tools and card, driven from Siri, Gemini or the Fridgy app
function initAgentic() {
  const root = document.querySelector<HTMLElement>(".agentic")!;
  const tabs = root.querySelectorAll<HTMLButtonElement>("[data-surface]");
  const device = root.querySelector<HTMLElement>(".device")!;
  const appName = root.querySelector<HTMLElement>("[data-device-app]")!;
  const engine = root.querySelector<HTMLElement>("[data-engine]")!;
  const ask = root.querySelector<HTMLElement>("[data-ask]")!;
  const steps = root.querySelector<HTMLElement>("[data-steps]")!;
  const card = root.querySelector<HTMLElement>("[data-card]")!;
  const cardTitle = root.querySelector<HTMLElement>("[data-card-title]")!;
  const cardList = root.querySelector<HTMLElement>("[data-card-list]")!;
  const action = root.querySelector<HTMLButtonElement>("[data-card-action]")!;
  const reply = root.querySelector<HTMLElement>("[data-reply]")!;
  let surface: Surface = "siri";
  let tl: gsap.core.Timeline | null = null;
  const fast = reduce ? 0 : 1;

  // Step text may contain a `tool` name, shown as code
  function stepEl(text: string) {
    const li = document.createElement("li");
    text.split("`").forEach((part, i) => {
      if (i % 2) {
        const code = document.createElement("code");
        code.textContent = part;
        li.append(code);
      } else if (part) li.append(part);
    });
    return li;
  }

  function play(next: Surface) {
    surface = next;
    tl?.kill();
    const d = AGENT[next];
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.surface === next)));
    device.dataset.themeSurface = next;
    appName.textContent = d.app;
    engine.textContent = d.engine;
    ask.textContent = "";
    steps.replaceChildren();
    card.hidden = true;
    reply.hidden = true;
    action.disabled = false;
    action.textContent = d.action;
    cardTitle.textContent = d.title;
    cardList.replaceChildren(
      ...d.rows.map((r) => {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.textContent = r.name;
        const note = document.createElement("small");
        note.textContent = r.note;
        name.append(note);
        const value = document.createElement("span");
        value.textContent = r.value;
        li.append(name, value);
        return li;
      }),
    );

    const chars = Array.from(d.ask);
    const typed = { n: 0 };
    tl = gsap.timeline();
    if (next === "siri") tl.call(() => device.classList.add("listening"));
    tl.to(typed, {
      n: chars.length,
      duration: chars.length * 0.03 * fast,
      ease: "none",
      onUpdate: () => (ask.textContent = chars.slice(0, Math.round(typed.n)).join("")),
    });
    tl.call(() => device.classList.remove("listening"));
    d.steps.forEach((text, i) => {
      tl!.call(() => {
        steps.querySelectorAll("li").forEach((li) => li.classList.add("ok"));
        const li = stepEl(text);
        steps.append(li);
        if (!reduce) gsap.from(li, { opacity: 0, y: 6, duration: 0.25 });
      }, [], `+=${(i === 0 ? 0.3 : 0.7) * fast}`);
    });
    tl.call(() => {
      steps.querySelectorAll("li").forEach((li) => li.classList.add("ok"));
      card.hidden = false;
    }, [], `+=${0.7 * fast}`);
    if (!reduce) tl.from(card, { opacity: 0, y: 30, scale: 0.96, duration: 0.5, ease: "back.out(1.6)" });
  }

  action.addEventListener("click", () => {
    action.disabled = true;
    action.textContent = "Confirmed";
    reply.textContent = AGENT[surface].reply;
    reply.hidden = false;
    if (!reduce) gsap.from(reply, { opacity: 0, y: 8, duration: 0.35 });
  });
  tabs.forEach((t) => t.addEventListener("click", () => play(t.dataset.surface as Surface)));
  root.querySelector("[data-replay]")!.addEventListener("click", () => play(surface));
  ScrollTrigger.create({ trigger: device, start: "top 75%", once: true, onEnter: () => play("siri") });
}

// Content that grows after load (the AI demo results, the meal plan toggle) shifts everything below it,
// so re-measure every scroll trigger when the page height changes
function keepTriggersFresh() {
  let timer = 0;
  let lastHeight = document.body.scrollHeight;
  new ResizeObserver(() => {
    const h = document.querySelector("main")!.scrollHeight;
    if (Math.abs(h - lastHeight) < 2) return;
    lastHeight = h;
    clearTimeout(timer);
    timer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
  }).observe(document.querySelector("main")!);
}

// Opening moment: Fridgy pops out with a spin, opens its door with the light on, waves and says hello
function intro(fridgy: Fridgy, cur: Stage) {
  if (reduce) {
    introDone = true;
    say(GREETING);
    return;
  }
  const target = { s: cur.s, ry: cur.ry, ay: cur.ay };
  const tl = gsap.timeline({ delay: 0.25 });
  tl.fromTo(
    cur,
    { s: 0.001, ay: target.ay - 0.5, ry: target.ry - Math.PI * 2 },
    { s: target.s, ay: target.ay, ry: target.ry, duration: 1.4, ease: "back.out(1.5)" },
  );
  tl.to(fridgy.pose, { celebrate: 1, duration: 0.35 }, "-=0.45");
  tl.to(fridgy.extra, { open: 1, duration: 0.55, ease: "back.out(1.6)" }, "-=0.1");
  tl.call(() => {
    introDone = true;
    say(GREETING);
  });
  tl.to(fridgy.pose, { celebrate: 0, duration: 0.5 }, "+=0.7");
  tl.to(fridgy.extra, { open: 0, duration: 0.7, ease: "power2.inOut" }, "+=1.6");
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

// Desktop: pin the screens section and slide the phones sideways as the page scrolls
function initRail() {
  const section = document.querySelector<HTMLElement>(".screens")!;
  const rail = section.querySelector<HTMLElement>(".rail")!;
  const win = section.querySelector<HTMLElement>(".rail-window")!;
  const bar = section.querySelector<HTMLElement>(".rail-progress")!;
  const setProgress = (p: number) => bar.style.setProperty("--progress", String(Math.max(0.14, p)));

  win.addEventListener("scroll", () => {
    const max = win.scrollWidth - win.clientWidth;
    if (max > 0) setProgress(win.scrollLeft / max);
  });

  const mm = gsap.matchMedia();
  mm.add("(min-width: 821px) and (prefers-reduced-motion: no-preference)", () => {
    section.classList.add("rail-pinned");
    const distance = () => Math.max(0, rail.scrollWidth - win.clientWidth);
    const tween = gsap.to(rail, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.5,
        invalidateOnRefresh: true,
        onUpdate: (self) => setProgress(self.progress),
      },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.set(rail, { clearProps: "transform" });
      section.classList.remove("rail-pinned");
    };
  });

  if (!reduce) {
    gsap.from(section.querySelectorAll(".phone"), {
      y: 60,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.08,
      scrollTrigger: { trigger: section, start: "top 75%" },
    });
  }
}

function initPlanner() {
  const planner = document.querySelector<HTMLElement>(".planner")!;
  const tabs = planner.querySelectorAll<HTMLButtonElement>("[data-plan]");
  const views = planner.querySelectorAll<HTMLElement>("[data-view]");
  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      views.forEach((v) => {
        const show = v.dataset.view === tab.dataset.plan;
        v.hidden = !show;
        if (show && !reduce) gsap.from(v.children, { y: 12, opacity: 0, duration: 0.4, stagger: 0.04 });
      });
    }),
  );
  if (!reduce) {
    gsap.from(".way", {
      y: 50,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.15,
      scrollTrigger: { trigger: ".ways", start: "top 80%" },
    });
  }
}

type Source = "photo" | "receipt" | "voice";
interface Found {
  name: string;
  where: string;
  qty: string;
}

const CAPTURE: Record<Source, { upload: string; head: string; extra?: string; items: Found[] }> = {
  photo: {
    upload: "Uploading photo",
    head: "I spotted 5 items in your photo.",
    items: [
      { name: "Spinach", where: "Fridge, crisper", qty: "250 g" },
      { name: "Strawberries", where: "Fridge", qty: "300 g" },
      { name: "Cucumbers", where: "Fridge, crisper", qty: "4 pcs" },
      { name: "Milk", where: "Fridge door", qty: "1 L" },
      { name: "Eggs", where: "Fridge", qty: "6 pcs" },
    ],
  },
  receipt: {
    upload: "Uploading receipt",
    head: "I read 4 items from your receipt.",
    extra: "Spent 330 EGP. It's counted in your monthly insights.",
    items: [
      { name: "Tomatoes", where: "Fridge", qty: "1 kg" },
      { name: "Chicken breast", where: "Freezer, suggested", qty: "1 kg" },
      { name: "Greek yogurt", where: "Fridge", qty: "2 pcs" },
      { name: "Basmati rice", where: "Pantry", qty: "1 kg" },
    ],
  },
  voice: {
    upload: "Listening",
    head: "Got it! I heard 3 items.",
    items: [
      { name: "Tomatoes", where: "Fridge", qty: "1 kg" },
      { name: "Cucumbers", where: "Fridge, crisper", qty: "2 pcs" },
      { name: "White cheese", where: "Fridge", qty: "1 box" },
    ],
  },
};

// Fridgy AI demo: the user picks photo, receipt or voice, the AI "analyses" it and proposes items
function initCapture(fridgy: Fridgy | null) {
  const root = document.querySelector<HTMLElement>(".capture")!;
  const tabs = root.querySelectorAll<HTMLButtonElement>("[data-src]");
  const panels = root.querySelectorAll<HTMLElement>("[data-panel]");
  const steps = root.querySelectorAll<HTMLElement>(".pipeline li");
  const uploadLabel = root.querySelector<HTMLElement>("[data-label]")!;
  const result = root.querySelector<HTMLElement>(".result")!;
  const head = root.querySelector<HTMLElement>("[data-result-head]")!;
  const list = root.querySelector<HTMLElement>("[data-result-items]")!;
  const extra = root.querySelector<HTMLElement>("[data-result-extra]")!;
  const confirm = root.querySelector<HTMLButtonElement>("[data-capture-confirm]")!;
  const done = root.querySelector<HTMLElement>("[data-capture-done]")!;
  const transcript = root.querySelector<HTMLElement>(".transcript")!;
  const fullTranscript = transcript.textContent ?? "";
  let tl: gsap.core.Timeline | null = null;

  const setStep = (i: number) =>
    steps.forEach((li, n) => {
      li.classList.toggle("on", n <= i);
      li.classList.toggle("now", n === i && i < steps.length - 1);
    });

  function renderItems(src: Source) {
    list.replaceChildren(
      ...CAPTURE[src].items.map((item) => {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.textContent = item.name;
        const where = document.createElement("small");
        where.textContent = item.where;
        name.append(where);
        const qty = document.createElement("span");
        qty.textContent = item.qty;
        li.append(name, qty);
        return li;
      }),
    );
  }

  function run(src: Source) {
    tl?.kill();
    const data = CAPTURE[src];
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.src === src)));
    panels.forEach((p) => (p.hidden = p.dataset.panel !== src));
    const panel = root.querySelector<HTMLElement>(`[data-panel="${src}"]`)!;
    const scan = panel.querySelector<HTMLElement>(".scanline");
    const boxes = panel.querySelectorAll<HTMLElement>(".box");
    const lines = panel.querySelectorAll<HTMLElement>(".receipt li");
    const voice = panel.querySelector<HTMLElement>(".voice");

    uploadLabel.textContent = data.upload;
    head.textContent = "Analysing…";
    list.replaceChildren();
    extra.hidden = true;
    result.classList.remove("ready");
    confirm.disabled = false;
    confirm.textContent = `Confirm and add ${data.items.length} items`;
    done.hidden = true;
    gsap.set(boxes, { opacity: 0, scale: 1.15 });
    lines.forEach((l) => l.classList.remove("hit"));
    if (scan) gsap.set(scan, { top: "-22%", opacity: 0 });
    if (voice) {
      voice.classList.add("live");
      transcript.textContent = "";
    }

    const instant = reduce;
    tl = gsap.timeline();
    tl.call(() => setStep(0));
    tl.from(panel, { opacity: 0, y: 10, duration: instant ? 0 : 0.35 });

    if (src === "voice") {
      const words = fullTranscript.split(" ");
      words.forEach((_, i) => {
        tl!.call(() => (transcript.textContent = words.slice(0, i + 1).join(" ")), [], instant ? 0 : `+=${i === 0 ? 0.3 : 0.28}`);
      });
      tl.call(() => {
        voice!.classList.remove("live");
        setStep(1);
      }, [], instant ? 0 : "+=0.3");
    } else {
      tl.call(() => setStep(1), [], instant ? 0 : "+=0.3");
      if (scan && !instant) {
        tl.to(scan, { opacity: 1, duration: 0.15 });
        tl.to(scan, { top: "100%", duration: 1.3, ease: "power1.inOut" });
        tl.to(scan, { opacity: 0, duration: 0.2 });
      }
      if (boxes.length) tl.to(boxes, { opacity: 1, scale: 1, duration: instant ? 0 : 0.3, stagger: instant ? 0 : 0.15, ease: "back.out(2)" }, instant ? 0 : "-=1.1");
      lines.forEach((line, i) => tl!.call(() => line.classList.add("hit"), [], instant ? 0 : i === 0 ? "-=1.2" : "+=0.25"));
    }

    tl.call(() => {
      setStep(2);
      head.textContent = data.head;
      renderItems(src);
      if (data.extra) {
        extra.textContent = data.extra;
        extra.hidden = false;
      }
    }, [], instant ? 0 : "+=0.35");
    if (!instant) tl.from(() => list.children, { opacity: 0, x: -12, duration: 0.3, stagger: 0.1 });
    tl.call(() => {
      setStep(3);
      result.classList.add("ready");
    });
  }

  tabs.forEach((t) => t.addEventListener("click", () => run(t.dataset.src as Source)));

  confirm.addEventListener("click", () => {
    confirm.disabled = true;
    confirm.textContent = "Added";
    done.hidden = false;
    if (!fridgy) return;
    const cycle = gsap.timeline({ defaults: { duration: reduce ? 0 : 0.6, ease: "power2.out" } });
    cycle.to(fridgy.extra, { open: 1 }).to(fridgy.extra, { open: 0, delay: reduce ? 0 : 0.6 });
  });

  // Plays the photo demo once, the first time the section scrolls into view
  ScrollTrigger.create({ trigger: root, start: "top 70%", once: true, onEnter: () => run("photo") });
  setStep(-1);
}

// The pin is created first so the scroll-driven Fridgy states below measure the pinned spacing
initRail();
const fridgy = initStage();
initDoors();
initChat(fridgy);
initPlanner();
initCapture(fridgy);
initTeam(fridgy);
initAgentic();
keepTriggersFresh();

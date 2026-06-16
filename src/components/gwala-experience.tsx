import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";

type Phase = "intro" | "roses" | "reveal" | "lyrics";

export function GwalaExperience() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("intro");

  // Three.js handles
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rosesRef = useRef<THREE.Group[]>([]);
  const panelsRef = useRef<{ left: THREE.Mesh; right: THREE.Mesh } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0508, 0.025);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 4, 22);
    camera.lookAt(0, 5, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;

    // --- Lighting: luxe theatre ---
    scene.add(new THREE.AmbientLight(0x2a0a0a, 0.35));

    const key = new THREE.SpotLight(0xffd9a0, 4, 60, Math.PI / 5, 0.6, 1);
    key.position.set(-8, 18, 14);
    key.target.position.set(0, 4, 0);
    scene.add(key, key.target);

    const rim = new THREE.PointLight(0xff3344, 2.5, 40, 2);
    rim.position.set(8, 6, -4);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0xffeacc, 0.4);
    fill.position.set(0, 10, 20);
    scene.add(fill);

    // Subtle floor for shadow/anchor feel
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a0a10,
      roughness: 0.9,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -3;
    scene.add(floor);

    // --- Reveal panels (curtain replacement) ---
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x12060a,
      roughness: 0.4,
      metalness: 0.6,
      emissive: 0x1a0410,
      emissiveIntensity: 0.4,
    });
    const panelGeo = new THREE.PlaneGeometry(14, 22);
    const left = new THREE.Mesh(panelGeo, panelMat);
    left.position.set(-7, 5, 10);
    const right = new THREE.Mesh(panelGeo, panelMat.clone());
    right.position.set(7, 5, 10);
    // Gold trim
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xc9a44a,
      emissive: 0x6a4810,
      emissiveIntensity: 0.5,
      metalness: 1,
      roughness: 0.3,
    });
    const trimL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 22, 0.15), trimMat);
    trimL.position.set(7 - 0.05, 0, 0.1);
    left.add(trimL);
    const trimR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 22, 0.15), trimMat);
    trimR.position.set(-7 + 0.05, 0, 0.1);
    right.add(trimR);

    left.visible = false;
    right.visible = false;
    scene.add(left, right);
    panelsRef.current = { left, right };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    let last = performance.now();
    let elapsed = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;

      // physics for roses — gentler gravity + air drag + wobble
      const g = 13.5;
      rosesRef.current.forEach((rose) => {
        const ud = rose.userData as {
          velocity: THREE.Vector3;
          rotSpeed: THREE.Vector3;
          wobble: number;
          wobbleAxis: THREE.Vector3;
          landed?: boolean;
          settleT?: number;
        };
        if (ud.landed) return;

        // gravity
        ud.velocity.y -= g * dt;

        // quadratic-ish air drag (stronger when faster) — creates that floaty tumble
        const speed = ud.velocity.length();
        const drag = 0.6 + speed * 0.04;
        ud.velocity.multiplyScalar(Math.max(0, 1 - drag * dt));
        // re-apply gravity portion lost to drag for vertical realism
        ud.velocity.y -= g * dt * 0.35;

        // subtle horizontal sway like leaves catching air
        const sway = Math.sin(elapsed * 1.3 + ud.wobble) * 0.6 * dt;
        ud.velocity.x += sway * ud.wobbleAxis.x;
        ud.velocity.z += sway * ud.wobbleAxis.z;

        rose.position.addScaledVector(ud.velocity, dt);

        // angular damping — tumble slows as drag bleeds energy
        ud.rotSpeed.multiplyScalar(Math.max(0, 1 - 0.35 * dt));
        rose.rotation.x += ud.rotSpeed.x * dt;
        rose.rotation.y += ud.rotSpeed.y * dt;
        rose.rotation.z += ud.rotSpeed.z * dt;

        if (rose.position.y < -2.7) {
          // soft settle — small bounce + slow rotational rest instead of hard stop
          if (!ud.settleT) ud.settleT = 0;
          ud.settleT += dt;
          rose.position.y = -2.7;
          ud.velocity.y = Math.max(0, -ud.velocity.y * 0.15);
          ud.velocity.x *= 0.4;
          ud.velocity.z *= 0.4;
          ud.rotSpeed.multiplyScalar(0.7);
          if (ud.settleT > 0.6 || ud.rotSpeed.length() < 0.05) {
            ud.velocity.set(0, 0, 0);
            ud.rotSpeed.set(0, 0, 0);
            ud.landed = true;
          }
        }
      });

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);


    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      renderer.dispose();
    };
  }, []);

  function makeRose(): THREE.Group {
    const g = new THREE.Group();
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0x5c0712,
      roughness: 0.55,
      metalness: 0.1,
      emissive: 0x1a0205,
      emissiveIntensity: 0.4,
    });
    // Core bud
    const bud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), petalMat);
    bud.scale.set(1, 0.85, 1);
    bud.position.y = 1.8;
    g.add(bud);
    // Layered petals
    for (let ring = 0; ring < 3; ring++) {
      const count = 5 + ring * 2;
      const r = 0.35 + ring * 0.28;
      for (let i = 0; i < count; i++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), petalMat);
        petal.scale.set(0.9, 0.35, 0.6);
        const a = (i / count) * Math.PI * 2 + ring * 0.3;
        petal.position.set(Math.cos(a) * r, 1.8 - ring * 0.05, Math.sin(a) * r);
        petal.lookAt(petal.position.x * 2, petal.position.y + 1.2, petal.position.z * 2);
        g.add(petal);
      }
    }
    // Stem
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.04, 3.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x1f3a1c, roughness: 0.8 })
    );
    stem.position.y = 0.2;
    g.add(stem);
    // Leaves
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x244a22,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 2; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.1), leafMat);
      leaf.position.set(i ? 0.3 : -0.3, 0.8 + i * 0.5, 0);
      leaf.rotation.set(0.3, i ? 0.7 : -0.7, i ? 0.6 : -0.6);
      g.add(leaf);
    }
    return g;
  }

  function throwRoses() {
    const scene = sceneRef.current;
    if (!scene) return;
    rosesRef.current.forEach((r) => scene.remove(r));
    rosesRef.current = [];
    const count = 55;
    for (let i = 0; i < count; i++) {
      const rose = makeRose();

      // varied scale — a bouquet has different blooms
      const s = 0.75 + Math.random() * 0.55;
      rose.scale.setScalar(s);

      // start tightly clustered like a held bouquet
      const clusterR = 0.6 + Math.random() * 0.7;
      const clusterA = Math.random() * Math.PI * 2;
      rose.position.set(
        Math.cos(clusterA) * clusterR,
        1.4 + Math.random() * 1.2,
        Math.sin(clusterA) * clusterR
      );
      // pre-tilt each stem like it was in a hand
      rose.rotation.set(
        (Math.random() - 0.5) * 0.6,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.6
      );

      // outward + upward throw — fan-shaped, biased upward
      const ang = clusterA + (Math.random() - 0.5) * 0.9;
      const outward = 2.5 + Math.random() * 5.5;
      const up = 11 + Math.random() * 5;
      const ud = rose.userData as Record<string, unknown>;
      ud.velocity = new THREE.Vector3(
        Math.cos(ang) * outward,
        up,
        Math.sin(ang) * outward
      );
      // gentler, more varied tumble — heavier roses spin slower
      const spin = (1 / s) * 4;
      ud.rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * spin,
        (Math.random() - 0.5) * spin * 1.3,
        (Math.random() - 0.5) * spin
      );
      ud.wobble = Math.random() * Math.PI * 2;
      ud.wobbleAxis = new THREE.Vector3(
        Math.random() - 0.5,
        0,
        Math.random() - 0.5
      ).normalize();

      scene.add(rose);
      rosesRef.current.push(rose);
    }
  }



  function openPanels() {
    const panels = panelsRef.current;
    const camera = cameraRef.current;
    if (!panels || !camera) return;
    panels.left.visible = true;
    panels.right.visible = true;
    panels.left.position.set(-7, 5, 10);
    panels.right.position.set(7, 5, 10);

    const tl = gsap.timeline();
    // Panels swoop in fast then slide apart majestically
    tl.to([panels.left.position, panels.right.position], {
      z: 0,
      duration: 0.6,
      ease: "power3.out",
    })
      .to(camera.position, { z: 18, duration: 1.2, ease: "power2.inOut" }, "<")
      .to(
        panels.left.position,
        { x: -16, duration: 2.2, ease: "power3.inOut" },
        "+=0.3"
      )
      .to(
        panels.right.position,
        { x: 16, duration: 2.2, ease: "power3.inOut" },
        "<"
      )
      .call(() => setPhase("lyrics"), [], "-=0.6");
  }

  function start() {
    if (phase !== "intro") return;
    setPhase("roses");
    throwRoses();
    setTimeout(() => {
      setPhase("reveal");
      openPanels();
    }, 3200);
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, oklch(0.06 0.02 25 / 0.85) 100%)",
        }}
      />

      {/* Intro */}
      {phase === "intro" && <IntroOverlay onStart={start} />}

      {/* Lyrics */}
      {phase === "lyrics" && <LyricsOverlay />}
    </div>
  );
}

function IntroOverlay({ onStart }: { onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex animate-fade-in flex-col items-center justify-center px-6 text-center">
      <p className="mb-4 text-xs uppercase tracking-[0.4em] text-accent/80">
        A small toast · est. 35
      </p>
      <h1 className="font-display text-4xl font-bold leading-[1.05] text-foreground sm:text-6xl md:text-7xl">
        I heard Gwala&apos;s
        <br />
        <span className="italic text-accent">got moves.</span>
      </h1>
      <p className="mt-6 max-w-md text-base text-muted-foreground sm:text-lg">
        Headphones on. Lights low. Press the thing.
      </p>
      <button
        onClick={onStart}
        className="group relative mt-12 inline-flex items-center gap-3 rounded-full border border-accent/40 bg-card/40 px-10 py-4 font-display text-sm uppercase tracking-[0.3em] text-foreground backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-accent hover:bg-primary/30 hover:shadow-[0_0_60px_-10px_var(--accent)]"
      >
        <span className="relative h-2 w-2 rounded-full bg-accent">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent" />
        </span>
        Begin the ceremony
      </button>
      <p className="mt-8 text-xs text-muted-foreground/70">
        From your friend, with very serious choreography.
      </p>
    </div>
  );
}

function LyricsOverlay() {
  const lines = [
    "I got a friend named Gwala",
    "Gwala is my friend",
    "Get up and dance, Gwala",
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
      <p
        className="mb-10 text-[0.7rem] uppercase tracking-[0.5em] text-accent opacity-0"
        style={{ animation: "fade-in 0.8s ease-out 0.2s forwards" }}
      >
        Sing it with me
      </p>
      <div className="space-y-6">
        {lines.map((l, i) => (
          <h2
            key={l}
            className="font-display text-3xl font-bold leading-tight text-foreground opacity-0 sm:text-5xl md:text-6xl"
            style={{
              animation: `fade-in 1.1s cubic-bezier(.2,.7,.2,1) ${0.6 + i * 0.7}s forwards`,
              textShadow: "0 0 40px oklch(0.45 0.18 25 / 0.6)",
            }}
          >
            {i === 2 ? (
              <>
                Get up and dance,{" "}
                <span className="italic text-accent">Gwala.</span>
              </>
            ) : (
              l
            )}
          </h2>
        ))}
      </div>
      <p
        className="pointer-events-auto mt-16 text-xs uppercase tracking-[0.4em] text-muted-foreground opacity-0"
        style={{ animation: "fade-in 1s ease-out 3.5s forwards" }}
      >
        Happy 35, friend.
      </p>
    </div>
  );
}

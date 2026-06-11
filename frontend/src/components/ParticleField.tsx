import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Subtiles 3D-"Wissensnetz" im Hintergrund: zwei langsam rotierende
 * Punktwolken (Creme + Orange) mit Mouse-Parallax. Läuft mit gedrosseltem
 * DPR und pausiert, wenn der Tab nicht sichtbar ist.
 */
export default function ParticleField() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.z = 9;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // weiche, runde Punkt-Sprites statt harter Quadrate
    const spriteCanvas = document.createElement("canvas");
    spriteCanvas.width = spriteCanvas.height = 64;
    const sctx = spriteCanvas.getContext("2d")!;
    const grad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(spriteCanvas);

    const makeCloud = (count: number, spread: number, color: number, size: number, opacity: number) => {
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        // flache Ellipsoid-Verteilung, dichter zur Mitte
        const r = Math.cbrt(Math.random()) * spread;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta) * 1.6;
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.85;
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color,
        size,
        map: sprite,
        sizeAttenuation: true,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      return new THREE.Points(geo, mat);
    };

    const cream = makeCloud(620, 7, 0xfff5ef, 0.035, 0.5);
    const ember = makeCloud(240, 6, 0xffa874, 0.06, 0.65);
    const mintFar = makeCloud(160, 9, 0x8fd8c7, 0.045, 0.25);
    scene.add(cream, ember, mintFar);

    const target = { x: 0, y: 0 };
    const onMouse = (e: MouseEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 0.35;
      target.y = (e.clientY / window.innerHeight - 0.5) * 0.25;
    };
    window.addEventListener("mousemove", onMouse);

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    let running = true;
    const start = performance.now();

    const loop = () => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      const t = (performance.now() - start) / 1000;

      cream.rotation.y = t * 0.025 + target.x * 0.6;
      cream.rotation.x = Math.sin(t * 0.08) * 0.06 + target.y * 0.4;
      ember.rotation.y = -t * 0.035 + target.x * 0.9;
      ember.rotation.x = Math.cos(t * 0.06) * 0.05 + target.y * 0.6;
      mintFar.rotation.y = t * 0.012 + target.x * 0.3;

      renderer.render(scene, camera);
    };
    loop();

    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      if (visible && !running) {
        running = true;
        loop();
      } else if (!visible) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      [cream, ember, mintFar].forEach((p) => {
        p.geometry.dispose();
        (p.material as THREE.Material).dispose();
      });
      sprite.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden
      className="fixed inset-0 z-0 pointer-events-none opacity-60"
    />
  );
}

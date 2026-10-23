"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeFrame } from "../../lib/clock";

const TEXTURE = "/textures/black-marble-2016.jpg";
/** One full revolution every 30 minutes: present, but never distracting. */
const RADIANS_PER_MS = (Math.PI * 2) / (30 * 60_000);

const PLANET_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// Boosts the NASA night-lights texture toward warm sodium tones and adds an
// atmospheric rim where the surface turns away from the viewer.
const PLANET_FRAGMENT = /* glsl */ `
  uniform sampler2D lights;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vec3 texel = texture2D(lights, vUv).rgb;
    float luminance = dot(texel, vec3(0.299, 0.587, 0.114));
    vec3 city = pow(texel, vec3(1.35)) * vec3(1.9, 1.45, 0.95) * 1.6;
    vec3 surface = mix(vec3(0.004, 0.012, 0.035), city, smoothstep(0.08, 0.6, luminance));
    float facing = clamp(vNormal.z, 0.0, 1.0);
    // Only the upper limb is visible, where facing is small everywhere, so the
    // rim is kept to a narrow band right at the edge.
    float rim = pow(1.0 - facing, 14.0);
    vec3 color = surface * (0.55 + 0.45 * smoothstep(0.0, 0.35, facing)) + vec3(0.12, 0.5, 1.0) * rim * 1.1;
    gl_FragColor = vec4(color, 1.0);
  }
`;
const HALO_FRAGMENT = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.2);
    gl_FragColor = vec4(0.22, 0.62, 1.0, 1.0) * intensity * 1.6;
  }
`;
const HALO_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * The planet's upper limb seen from orbit, rendered as a textured sphere far
 * below an orthographic camera so the horizon reads as a wide, shallow arc.
 */
export default function EarthHorizon() {
  const host = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import("three");
      if (disposed) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "low-power",
        });
      } catch {
        setFallback(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      element.append(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
      camera.position.set(0, 0, 40);
      const texture = new THREE.TextureLoader().load(TEXTURE, () => {
        dirty = true;
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(
        8,
        renderer.capabilities.getMaxAnisotropy(),
      );
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(1, 160, 96),
        new THREE.ShaderMaterial({
          uniforms: { lights: { value: texture } },
          vertexShader: PLANET_VERTEX,
          fragmentShader: PLANET_FRAGMENT,
        }),
      );
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(1.045, 96, 64),
        new THREE.ShaderMaterial({
          vertexShader: HALO_VERTEX,
          fragmentShader: HALO_FRAGMENT,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
      );
      // Tilt the globe so populated mid-northern latitudes face the viewer,
      // then spin about the planet's own axis.
      const tilt = new THREE.Group();
      tilt.rotation.x = 1.35;
      tilt.add(planet);
      const orbit = new THREE.Group();
      orbit.add(tilt, halo);
      scene.add(orbit);
      let dirty = true;
      const resize = () => {
        const width = element.clientWidth;
        const height = element.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        const aspect = width / height;
        camera.left = -aspect;
        camera.right = aspect;
        camera.top = 1;
        camera.bottom = -1;
        camera.updateProjectionMatrix();
        // Size the sphere so its limb peaks near the top of the canvas and
        // meets the lower corners: a² + (b - c)² = (t - c)², radius = t - c.
        const peak = 0.3;
        const corner = -1.1;
        const center =
          (corner * corner - peak * peak + aspect * aspect) /
          (2 * (corner - peak));
        const radius = peak - center;
        orbit.scale.setScalar(radius);
        orbit.position.set(0, center, -radius - 1);
        camera.far = radius * 3 + 50;
        camera.updateProjectionMatrix();
        dirty = true;
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
      // Start on Europe and Africa at night, matching the map's centre of gravity.
      const startAngle = 1.31;
      const stopFrame = subscribeFrame((now) => {
        if (!motion.matches) {
          planet.rotation.y = startAngle + now * RADIANS_PER_MS;
          dirty = true;
        } else if (planet.rotation.y === 0) {
          planet.rotation.y = startAngle;
          dirty = true;
        }
        if (!dirty) return;
        renderer.render(scene, camera);
        dirty = false;
      });
      cleanup = () => {
        stopFrame();
        observer.disconnect();
        texture.dispose();
        planet.geometry.dispose();
        halo.geometry.dispose();
        (
          planet.material as InstanceType<typeof THREE.ShaderMaterial>
        ).dispose();
        (halo.material as InstanceType<typeof THREE.ShaderMaterial>).dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);
  return (
    <div
      ref={host}
      className={`earth-horizon ${fallback ? "is-fallback" : ""}`}
      aria-hidden="true"
    />
  );
}

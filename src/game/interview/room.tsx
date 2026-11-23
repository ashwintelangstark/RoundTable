import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { EnvironmentState } from "@/lib/environment";
import { INTERVIEW_PANEL, type PanelAgentName, type PanelMember } from "./team";

export interface InterviewRoomProps {
  activeSpeaker?: PanelAgentName | null;
  isSpeaking?: boolean;
  speakingAmplitudeRef?: React.MutableRefObject<number>;
  hasCandidateSetup?: boolean;
  environment?: EnvironmentState;
  onTableClick?: () => void;
  onSelectAgent?: (agent: PanelAgentName) => void;
}

const FALLBACK_COLORS = {
  "room-walnut": "#694831",
  "room-walnut-light": "#8d6747",
  "room-walnut-dark": "#422c1d",
  "room-brass": "#d2a957",
  "room-pine": "#364f40",
  "room-pine-light": "#55745f",
  "room-glass": "#8cb4b8",
  "room-rug": "#5c4d41",
  "room-skin": "#c88f68",
  "room-ivory": "#f5f4e6",
  "room-suit": "#354657",
  "room-shirt": "#ece9d8",
  "room-glass-back": "#a8c7c4",
};

type RoomColorPalette = typeof FALLBACK_COLORS;

function roomColors(): RoomColorPalette {
  if (typeof document === "undefined") return FALLBACK_COLORS;
  const keys = Object.keys(FALLBACK_COLORS) as Array<keyof RoomColorPalette>;
  const probe = document.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.append(probe);
  const colors = Object.fromEntries(
    keys.map((key) => {
      probe.style.color = `var(--${key})`;
      const resolved = getComputedStyle(probe).color;
      return [key, resolved || FALLBACK_COLORS[key]];
    }),
  ) as RoomColorPalette;
  probe.remove();
  return colors;
}

function makeNameplateTexture(
  name: string,
  title: string,
  colors: RoomColorPalette,
  isActive: boolean,
) {
  const surface = document.createElement("canvas");
  surface.width = 640;
  surface.height = 224;
  const context = surface.getContext("2d");
  if (!context) return null;

  context.fillStyle = isActive ? "#fffef4" : (colors["room-ivory"] ?? "#f5f4e6");
  context.fillRect(0, 0, 640, 224);
  context.fillStyle = isActive ? "#526e50" : (colors["room-pine"] ?? "#364f40");
  context.fillRect(0, 0, 16, 224);
  context.fillStyle = colors["room-brass"] ?? "#d2a957";
  context.fillRect(38, 34, isActive ? 92 : 44, 5);

  if (isActive) {
    context.fillStyle = "#526e50";
    context.font = "700 20px DM Sans, Segoe UI, sans-serif";
    context.fillText("SPEAKING NOW", 145, 43);
  }

  context.fillStyle = colors["room-walnut-dark"] ?? "#422c1d";
  context.font = "700 44px Playfair Display, Georgia, serif";
  context.fillText(name, 38, 108, 560);

  context.fillStyle = colors["room-pine"] ?? "#364f40";
  context.font = "500 24px DM Sans, Segoe UI, sans-serif";
  const words = title.split(" ");
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > 560 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  });
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((item, index) => context.fillText(item, 38, 155 + index * 32, 560));

  const texture = new CanvasTexture(surface);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeFolioTexture(hasSetup: boolean) {
  const surface = document.createElement("canvas");
  surface.width = 512;
  surface.height = 360;
  const ctx = surface.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#f7f6eb";
  ctx.fillRect(0, 0, 512, 360);
  ctx.strokeStyle = "#789575";
  ctx.lineWidth = 8;
  ctx.strokeRect(18, 18, 476, 324);

  ctx.fillStyle = "#526e50";
  ctx.font = "700 22px DM Sans, sans-serif";
  ctx.fillText("ROUNDTABLE CANDIDATE FOLIO", 46, 74);

  ctx.fillStyle = "#263328";
  ctx.font = "600 32px Playfair Display, Georgia, serif";
  ctx.fillText(hasSetup ? "Brief & Resume Loaded" : "Drop Resume & Setup", 46, 134);

  ctx.fillStyle = "#5c6757";
  ctx.font = "500 21px DM Sans, sans-serif";
  ctx.fillText(
    hasSetup
      ? "Click table anytime to inspect or edit"
      : "Click table to drop PDF / DOCX & details",
    46,
    182,
  );

  // Decorative resume lines
  ctx.fillStyle = "#d3d9c4";
  for (let i = 0; i < 4; i += 1) {
    ctx.fillRect(46, 224 + i * 24, i === 3 ? 250 : 410, 10);
  }

  const texture = new CanvasTexture(surface);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * Creates dynamic sky gradient texture matching the time of day.
 */
function makeSkyTexture(topHex: string, horizonHex: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, topHex);
  gradient.addColorStop(0.65, horizonHex);
  gradient.addColorStop(1, horizonHex);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 512);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * First-person Seated Interactive Camera.
 * Strictly limited inside the boardroom:
 * - Seated in the candidate chair positioned further back from the walnut table.
 * - Click-and-drag ONLY to smoothly look around 360° on all sides (no hover movement on mouse move).
 * - Smooth exponential damping on both horizontal 360° yaw and vertical ceiling-to-floor pitch.
 */
function SeatedInteractiveCamera({
  lookAnglesRef,
  dragDeltaRef,
}: {
  lookAnglesRef: React.MutableRefObject<{ yaw: number; pitch: number; isDragging: boolean }>;
  dragDeltaRef: React.MutableRefObject<number>;
}) {
  const { camera, size, gl } = useThree();
  const currentYaw = useRef(0);
  const currentPitch = useRef(-0.04);
  const targetLook = useMemo(() => new Vector3(0, 1.75, -1.8), []);

  useEffect(() => {
    const perspective = camera as PerspectiveCamera;
    const portrait = size.width < 768;
    // Far-view seated distance inside enclosed boardroom
    perspective.fov = portrait ? 50 : 44;
    perspective.near = 0.1;
    perspective.far = 140;
    perspective.position.set(0, portrait ? 2.55 : 2.34, portrait ? 9.1 : 8.2);
    perspective.updateProjectionMatrix();
  }, [camera, size.width]);

  // Smooth click-and-drag only look around on all sides
  useEffect(() => {
    const dom = gl.domElement;
    dom.style.cursor = "grab";
    let isDown = false;
    let startX = 0;
    let startY = 0;
    let baseYaw = 0;
    let basePitch = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      isDown = true;
      startX = e.clientX;
      startY = e.clientY;
      dragDeltaRef.current = 0;
      baseYaw = lookAnglesRef.current.yaw;
      basePitch = lookAnglesRef.current.pitch;
      lookAnglesRef.current.isDragging = true;
      dom.style.cursor = "grabbing";
      try {
        dom.setPointerCapture?.(e.pointerId);
      } catch {
        // Safe fallback
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      // Only update camera look when actively clicking & dragging
      if (!isDown) return;
      const moveX = e.clientX - startX;
      const moveY = e.clientY - startY;
      dragDeltaRef.current = Math.max(dragDeltaRef.current, Math.hypot(moveX, moveY));

      const sensitivity = 0.0042;
      // Full continuous 360-degree horizontal look (all 4 walls & panoramic windows)
      lookAnglesRef.current.yaw = baseYaw - moveX * sensitivity;
      // Smooth pitch from floor rug up to walnut coffered ceiling
      lookAnglesRef.current.pitch = MathUtils.clamp(basePitch - moveY * sensitivity, -0.75, 0.82);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDown) return;
      isDown = false;
      lookAnglesRef.current.isDragging = false;
      dom.style.cursor = "grab";
      try {
        dom.releasePointerCapture?.(e.pointerId);
      } catch {
        // Safe fallback
      }
    };

    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      dom.style.cursor = "auto";
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [gl, lookAnglesRef, dragDeltaRef]);

  useFrame((_, delta) => {
    const dt = Math.min(0.1, delta);
    const perspective = camera as PerspectiveCamera;

    currentYaw.current = MathUtils.damp(currentYaw.current, lookAnglesRef.current.yaw, 11, dt);
    currentPitch.current = MathUtils.damp(
      currentPitch.current,
      lookAnglesRef.current.pitch,
      11,
      dt,
    );

    const lookDirX = Math.sin(currentYaw.current) * Math.cos(currentPitch.current);
    const lookDirY = Math.sin(currentPitch.current);
    const lookDirZ = -Math.cos(currentYaw.current) * Math.cos(currentPitch.current);

    targetLook.set(
      perspective.position.x + lookDirX * 10,
      perspective.position.y + lookDirY * 10,
      perspective.position.z + lookDirZ * 10,
    );
    perspective.lookAt(targetLook);
  });

  return null;
}

function Seat({
  position,
  colors,
}: {
  position: [number, number, number];
  colors: RoomColorPalette;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 1.04, -0.12]} castShadow>
        <boxGeometry args={[0.88, 0.14, 0.8]} />
        <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.57, -0.48]} castShadow>
        <boxGeometry args={[0.84, 0.93, 0.13]} />
        <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.58} />
      </mesh>
      <mesh position={[-0.35, 1.28, -0.12]}>
        <boxGeometry args={[0.1, 0.47, 0.12]} />
        <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.56} />
      </mesh>
      <mesh position={[0.35, 1.28, -0.12]}>
        <boxGeometry args={[0.1, 0.47, 0.12]} />
        <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.56} />
      </mesh>
      {[-0.32, 0.32].map((x) =>
        [-0.4, 0.22].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.52, z]} castShadow>
            <boxGeometry args={[0.095, 1.04, 0.095]} />
            <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.65} />
          </mesh>
        )),
      )}
    </group>
  );
}

function RobloxHair({ member }: { member: PanelMember }) {
  switch (member.hairStyle) {
    case "long":
      return (
        <group>
          <mesh position={[0, 2.66, -0.02]} castShadow>
            <boxGeometry args={[0.62, 0.18, 0.56]} />
            <meshStandardMaterial color={member.hairColor} roughness={0.85} />
          </mesh>
          <mesh position={[0, 2.34, -0.25]} castShadow>
            <boxGeometry args={[0.62, 0.62, 0.14]} />
            <meshStandardMaterial color={member.hairColor} roughness={0.85} />
          </mesh>
          {[-0.29, 0.29].map((side) => (
            <mesh key={side} position={[side, 2.32, -0.02]} castShadow>
              <boxGeometry args={[0.1, 0.56, 0.38]} />
              <meshStandardMaterial color={member.hairColor} roughness={0.85} />
            </mesh>
          ))}
        </group>
      );
    case "bob":
      return (
        <group>
          <mesh position={[0, 2.66, -0.03]} castShadow>
            <boxGeometry args={[0.61, 0.18, 0.54]} />
            <meshStandardMaterial color={member.hairColor} roughness={0.84} />
          </mesh>
          <mesh position={[0, 2.42, -0.24]} castShadow>
            <boxGeometry args={[0.6, 0.44, 0.13]} />
            <meshStandardMaterial color={member.hairColor} roughness={0.84} />
          </mesh>
          <mesh position={[0, 2.44, -0.35]} castShadow>
            <boxGeometry args={[0.24, 0.24, 0.16]} />
            <meshStandardMaterial color={member.hairColor} roughness={0.84} />
          </mesh>
        </group>
      );
    case "textured":
      return (
        <group>
          <mesh position={[0, 2.67, -0.02]} castShadow>
            <boxGeometry args={[0.58, 0.17, 0.52]} />
            <meshStandardMaterial color={member.hairColor} roughness={0.88} />
          </mesh>
          <mesh position={[-0.08, 2.75, 0.08]} rotation={[0.15, 0, -0.15]} castShadow>
            <boxGeometry args={[0.38, 0.11, 0.36]} />
            <meshStandardMaterial color={member.hairColor} roughness={0.88} />
          </mesh>
        </group>
      );
    case "executive":
      return (
        <group>
          <mesh position={[0, 2.66, -0.02]} castShadow>
            <boxGeometry args={[0.58, 0.16, 0.52]} />
            <meshStandardMaterial color={member.hairColor} roughness={0.86} />
          </mesh>
          {[-0.29, 0.29].map((side) => (
            <mesh key={side} position={[side, 2.49, -0.03]}>
              <boxGeometry args={[0.04, 0.18, 0.34]} />
              <meshStandardMaterial color="#8c908e" roughness={0.8} />
            </mesh>
          ))}
        </group>
      );
    case "parted":
    default:
      return (
        <group>
          <mesh position={[0, 2.66, -0.03]} castShadow>
            <boxGeometry args={[0.59, 0.18, 0.53]} />
            <meshStandardMaterial color={member.hairColor} roughness={0.86} />
          </mesh>
          <mesh position={[0.12, 2.68, 0.14]} rotation={[0.1, 0, 0.08]} castShadow>
            <boxGeometry args={[0.32, 0.1, 0.28]} />
            <meshStandardMaterial color={member.hairColor} roughness={0.86} />
          </mesh>
        </group>
      );
  }
}

function RobloxGlasses({ kind }: { kind: PanelMember["hasGlasses"] }) {
  if (kind === "none") return null;
  const frameColor = kind === "round" ? "#3b2c20" : "#1f2933";
  return (
    <group position={[0, 2.39, 0.258]}>
      {[-0.12, 0.12].map((gx) => (
        <mesh key={gx} position={[gx, 0, 0]}>
          <boxGeometry args={[0.15, kind === "round" ? 0.12 : 0.1, 0.02]} />
          <meshStandardMaterial color={frameColor} metalness={0.35} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.08, 0.02, 0.02]} />
        <meshStandardMaterial color={frameColor} metalness={0.35} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Avatar({
  member,
  x,
  colors,
  grain,
  isActive,
  isSpeaking,
  speakingAmplitudeRef,
  onSelect,
}: {
  member: PanelMember;
  x: number;
  colors: RoomColorPalette;
  grain: CanvasTexture | null;
  isActive: boolean;
  isSpeaking: boolean;
  speakingAmplitudeRef?: React.MutableRefObject<number> | undefined;
  onSelect?: () => void;
}) {
  const figure = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const mouthRef = useRef<Mesh>(null);
  const rightArmRef = useRef<Mesh>(null);
  const leftEyeRef = useRef<Mesh>(null);
  const rightEyeRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const amp = isSpeaking && speakingAmplitudeRef ? speakingAmplitudeRef.current : 0;

    if (figure.current) {
      figure.current.position.y = 0.014 * Math.sin(t * 0.95 + x) + (isActive ? 0.02 : 0);
      figure.current.rotation.x = isActive ? 0.045 : 0;
    }

    if (headRef.current) {
      headRef.current.rotation.y = isActive
        ? Math.sin(t * 1.8) * 0.08
        : Math.sin(t * 0.45 + x) * 0.04;
      headRef.current.rotation.x = isSpeaking ? -0.03 + Math.sin(t * 6.5) * (0.04 + amp * 0.05) : 0;
    }

    if (mouthRef.current) {
      const openScale = isSpeaking ? 1 + amp * 2.4 + Math.abs(Math.sin(t * 14)) * 1.1 : 1;
      mouthRef.current.scale.y = openScale;
    }

    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = isSpeaking ? -0.35 + Math.sin(t * 4.2) * 0.14 : -0.15;
    }

    // Natural Roblox eye blink every ~4.5 seconds
    const blinkCycle = (t + Math.abs(x) * 0.7) % 4.6;
    const eyeScaleY = blinkCycle > 4.46 ? 0.12 : 1;
    if (leftEyeRef.current) leftEyeRef.current.scale.y = eyeScaleY;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = eyeScaleY;
  });

  const torsoWidth =
    member.name === "Marcus"
      ? 0.88
      : member.name === "ananya" || member.name === "sarah"
        ? 0.77
        : 0.83;

  return (
    <group
      position={[x, 0, -1.88]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      <Seat position={[0, 0, 0]} colors={colors} />
      {isActive && (
        <pointLight position={[0, 3.6, 0.7]} intensity={14} distance={5} color="#f7dca4" />
      )}
      <group ref={figure} position={[0, 0, 0.06]}>
        {/* Roblox Torso */}
        <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
          <boxGeometry args={[torsoWidth, 0.86, 0.4]} />
          <meshStandardMaterial color={member.jacketColor} map={grain ?? null} roughness={0.78} />
        </mesh>
        {/* Shirt V */}
        <mesh position={[0, 1.7, 0.218]}>
          <boxGeometry args={[0.21, 0.73, 0.035]} />
          <meshStandardMaterial color={colors["room-shirt"]} roughness={0.65} />
        </mesh>
        {/* Tie / Accent */}
        <mesh position={[0, 1.48, 0.25]}>
          <boxGeometry args={[0.085, 0.37, 0.055]} />
          <meshStandardMaterial color={member.accentColor} roughness={0.55} />
        </mesh>
        {/* Neck */}
        <mesh position={[0, 2.03, 0]} castShadow>
          <cylinderGeometry args={[0.105, 0.11, 0.25, 10]} />
          <meshStandardMaterial color={member.skinColor} roughness={0.85} />
        </mesh>

        {/* Head */}
        <group ref={headRef} position={[0, 0, 0]}>
          <mesh position={[0, 2.35, 0.005]} castShadow>
            <boxGeometry args={[0.55, 0.59, 0.48]} />
            <meshStandardMaterial color={member.skinColor} roughness={0.88} />
          </mesh>
          {/* Lip-synced mouth */}
          <mesh ref={mouthRef} position={[0, 2.22, 0.252]}>
            <boxGeometry args={[0.21, 0.045, 0.022]} />
            <meshStandardMaterial color="#4e2e24" roughness={0.82} />
          </mesh>
          {/* Eyes */}
          <mesh ref={leftEyeRef} position={[-0.115, 2.39, 0.255]}>
            <boxGeometry args={[0.06, 0.08, 0.02]} />
            <meshStandardMaterial color="#1f2922" roughness={0.7} />
          </mesh>
          <mesh ref={rightEyeRef} position={[0.115, 2.39, 0.255]}>
            <boxGeometry args={[0.06, 0.08, 0.02]} />
            <meshStandardMaterial color="#1f2922" roughness={0.7} />
          </mesh>
          <RobloxGlasses kind={member.hasGlasses} />
          <RobloxHair member={member} />
        </group>

        {/* Arms */}
        <mesh position={[-0.5, 1.62, 0.08]} rotation={[-0.18, 0, 0.08]} castShadow>
          <boxGeometry args={[0.22, 0.64, 0.26]} />
          <meshStandardMaterial color={member.jacketColor} roughness={0.8} />
        </mesh>
        <mesh
          ref={rightArmRef}
          position={[0.5, 1.62, 0.08]}
          rotation={[-0.18, 0, -0.08]}
          castShadow
        >
          <boxGeometry args={[0.22, 0.64, 0.26]} />
          <meshStandardMaterial color={member.jacketColor} roughness={0.8} />
        </mesh>
        {/* Hands */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.5, 1.28, 0.14]} castShadow>
            <boxGeometry args={[0.19, 0.14, 0.2]} />
            <meshStandardMaterial color={member.skinColor} roughness={0.85} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Plant({
  position,
  colors,
}: {
  position: [number, number, number];
  colors: RoomColorPalette;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.48, 0]} castShadow>
        <cylinderGeometry args={[0.44, 0.32, 0.82, 12]} />
        <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.91, 0]}>
        <cylinderGeometry args={[0.39, 0.39, 0.055, 12]} />
        <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.92} />
      </mesh>
      {[0, 1, 2, 3, 4].map((leaf) => (
        <mesh
          key={leaf}
          position={[
            Math.cos(leaf * 1.25) * 0.3,
            1.57 + (leaf % 3) * 0.14,
            Math.sin(leaf * 1.25) * 0.23,
          ]}
          rotation={[0, 0, (leaf - 2) * 0.19]}
          castShadow
        >
          <boxGeometry args={[0.16, 1.1 - (leaf % 2) * 0.16, 0.12]} />
          <meshStandardMaterial
            color={leaf % 2 ? colors["room-pine-light"] : colors["room-pine"]}
            roughness={0.91}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Exterior Scenery with Horizon Mountains and Evergreens.
 */
function ExteriorScenery({
  skyTexture,
  environment,
}: {
  skyTexture: CanvasTexture | null;
  environment: EnvironmentState;
}) {
  const isNight = environment.timeOfDay === "night";

  // Distant mountain ranges
  const mountainSegments = useMemo(
    () => [
      { x: -32, z: -38, scale: 22, color: isNight ? "#0d1b2a" : "#466275" },
      { x: -16, z: -44, scale: 28, color: isNight ? "#09131d" : "#3b5364" },
      { x: 2, z: -40, scale: 24, color: isNight ? "#0d1a27" : "#496377" },
      { x: 20, z: -45, scale: 30, color: isNight ? "#08111a" : "#354a59" },
      { x: 36, z: -38, scale: 23, color: isNight ? "#0d1c2b" : "#456174" },
    ],
    [isNight],
  );

  return (
    <group>
      {/* Sky Sphere */}
      <mesh scale={85}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial
          map={skyTexture ?? null}
          color={skyTexture ? "#ffffff" : environment.skyTopColor}
          side={DoubleSide}
        />
      </mesh>

      {/* Sun / Moon disc in the distance */}
      <mesh position={environment.sunPosition}>
        <sphereGeometry args={[isNight ? 1.6 : 2.4, 20, 20]} />
        <meshBasicMaterial color={environment.sunColor} toneMapped={false} />
      </mesh>

      {/* Distant Mountain Ridges */}
      {mountainSegments.map((m, i) => (
        <mesh key={i} position={[m.x, 3.5, m.z]} rotation={[0, 0.4 * i, 0]}>
          <coneGeometry args={[m.scale, m.scale * 0.8, 6]} />
          <meshStandardMaterial color={m.color} roughness={0.95} />
        </mesh>
      ))}

      {/* Rolling Foothills Outside Left & Right Windows */}
      {[-24, 24].map((sideX) => (
        <group key={sideX} position={[sideX, -1, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[26, 38]} />
            <meshStandardMaterial color={isNight ? "#0c1722" : "#2d4436"} roughness={0.96} />
          </mesh>
          {/* Outdoor Evergreen Trees */}
          {[-8, -4, 0, 4, 8].map((tz) => (
            <group key={tz} position={[(sideX > 0 ? -1 : 1) * 3, 2, tz]}>
              <mesh position={[0, 1.2, 0]}>
                <coneGeometry args={[1.4, 3.2, 7]} />
                <meshStandardMaterial color={isNight ? "#0d1c1a" : "#223b2c"} roughness={0.9} />
              </mesh>
              <mesh position={[0, 2.6, 0]}>
                <coneGeometry args={[1.0, 2.4, 7]} />
                <meshStandardMaterial color={isNight ? "#112421" : "#2c4a38"} roughness={0.9} />
              </mesh>
              <mesh position={[0, -0.2, 0]}>
                <cylinderGeometry args={[0.2, 0.25, 1.4, 6]} />
                <meshStandardMaterial color="#2d1e15" roughness={0.9} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * Precipitation particle system for Rain / Snow outside the windows.
 */
function WeatherParticles({ mode }: { mode: "none" | "rain" | "snow" }) {
  const particlesRef = useRef<Group>(null);
  const particleCount = 140;

  const positions = useMemo(() => {
    const arr: [number, number, number][] = [];
    for (let i = 0; i < particleCount; i += 1) {
      // Positioned outside window openings (x < -10 or x > 10 or z < -8)
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = (Math.random() * 4 + 10.5) * side;
      const y = Math.random() * 8 + 0.5;
      const z = Math.random() * 18 - 8;
      arr.push([x, y, z]);
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!particlesRef.current || mode === "none") return;
    const speed = mode === "rain" ? 18 : 2.5;
    particlesRef.current.children.forEach((child) => {
      child.position.y -= speed * delta;
      if (child.position.y < -0.5) {
        child.position.y = 8.5;
      }
    });
  });

  if (mode === "none") return null;

  return (
    <group ref={particlesRef}>
      {positions.map((pos, idx) => (
        <mesh key={idx} position={pos}>
          {mode === "rain" ? (
            <boxGeometry args={[0.03, 0.55, 0.03]} />
          ) : (
            <sphereGeometry args={[0.06, 6, 6]} />
          )}
          <meshBasicMaterial
            color={mode === "rain" ? "#c8e2f0" : "#ffffff"}
            transparent
            opacity={0.65}
          />
        </mesh>
      ))}
    </group>
  );
}

export function InterviewRoom({
  activeSpeaker = "Nikhil",
  isSpeaking = false,
  speakingAmplitudeRef,
  hasCandidateSetup = false,
  environment = {
    timeOfDay: "day",
    weather: "clear",
    temperature: "22°C",
    timeString: "14:00",
    locationName: "Executive Room",
    isDay: true,
    skyTopColor: "#3a7eb8",
    skyHorizonColor: "#c0dded",
    ambientColor: "#dceaf2",
    ambientIntensity: 1.45,
    sunColor: "#fff4df",
    sunIntensity: 2.4,
    sunPosition: [-5, 16, -6],
    fogColor: "#8ea8b5",
    fogNear: 30,
    fogFar: 75,
    interiorLightColor: "#fbf5e6",
    interiorLightIntensity: 0.85,
    windowGlowColor: "#bfe0f0",
    windowGlowIntensity: 0.35,
    precipitation: "none",
  },
  onTableClick,
  onSelectAgent,
}: InterviewRoomProps) {
  const { size, gl } = useThree();
  const colors = useMemo(roomColors, []);
  const [tableHovered, setTableHovered] = useState(false);
  const dragDeltaRef = useRef(0);
  const lookAnglesRef = useRef({ yaw: 0, pitch: -0.04, isDragging: false });

  useEffect(() => {
    const dom = gl.domElement;
    if (!lookAnglesRef.current.isDragging) {
      dom.style.cursor = tableHovered ? "pointer" : "grab";
    }
    return () => {
      dom.style.cursor = "auto";
    };
  }, [tableHovered, gl]);

  const grain = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 384;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = colors["room-walnut"] ?? "#694831";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 132; index += 1) {
      const y = (index / 132) * canvas.height;
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(
        230,
        y + Math.sin(index * 1.4) * 9,
        760,
        y + Math.cos(index) * 12,
        1024,
        y + Math.sin(index * 0.6) * 4,
      );
      context.strokeStyle = index % 6 === 0 ? "rgba(239, 194, 126, .21)" : "rgba(40, 23, 12, .13)";
      context.lineWidth = index % 9 === 0 ? 3 : 1;
      context.stroke();
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }, [colors]);

  const skyTexture = useMemo(
    () => makeSkyTexture(environment.skyTopColor, environment.skyHorizonColor),
    [environment.skyTopColor, environment.skyHorizonColor],
  );

  const nameplateTextures = useMemo(
    () =>
      INTERVIEW_PANEL.map((member) =>
        makeNameplateTexture(
          member.name,
          member.title,
          colors,
          activeSpeaker?.toLowerCase() === member.name.toLowerCase(),
        ),
      ),
    [colors, activeSpeaker],
  );

  const folioTexture = useMemo(() => makeFolioTexture(hasCandidateSetup), [hasCandidateSetup]);

  const xScale = size.width < 768 ? 0.6 : 1;
  const avatarPositions = [-4.75, -2.38, 0, 2.38, 4.75];

  function handleTableClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    if (dragDeltaRef.current > 5) return;
    onTableClick?.();
  }

  return (
    <>
      {/* Dynamic Lighting & Atmospheric Fog */}
      <color attach="background" args={[environment.fogColor]} />
      <fog attach="fog" args={[environment.fogColor, environment.fogNear, environment.fogFar]} />
      <ambientLight color={environment.ambientColor} intensity={environment.ambientIntensity} />
      <directionalLight
        position={environment.sunPosition}
        color={environment.sunColor}
        intensity={environment.sunIntensity}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
      />

      {/* Warm Interior Boardroom Ceiling Lights */}
      <pointLight
        position={[0, 4.8, -1.0]}
        intensity={45 * environment.interiorLightIntensity}
        distance={22}
        color={environment.interiorLightColor}
      />
      <pointLight
        position={[-4.5, 4.8, -1.0]}
        intensity={30 * environment.interiorLightIntensity}
        distance={18}
        color={environment.interiorLightColor}
      />
      <pointLight
        position={[4.5, 4.8, -1.0]}
        intensity={30 * environment.interiorLightIntensity}
        distance={18}
        color={environment.interiorLightColor}
      />

      {/* Exterior Vista Scenery (Visible through all windows) */}
      <ExteriorScenery skyTexture={skyTexture} environment={environment} />

      {/* Rain / Snow weather particles outside windows */}
      <WeatherParticles mode={environment.precipitation} />

      {/* Seated First-Person Interactive Camera bounded in the room */}
      <SeatedInteractiveCamera lookAnglesRef={lookAnglesRef} dragDeltaRef={dragDeltaRef} />

      <group scale={[xScale, 1, 1]}>
        {/* ============================================================ */}
        {/* FLOOR & BOARDROOM RUG */}
        {/* ============================================================ */}
        <mesh position={[0, -0.12, 1.5]} receiveShadow>
          <boxGeometry args={[20.5, 0.24, 24]} />
          <meshStandardMaterial
            color={colors["room-walnut-dark"]}
            roughness={0.86}
            map={grain ?? null}
          />
        </mesh>
        <mesh position={[0, 0.012, 1.2]} receiveShadow>
          <boxGeometry args={[18.5, 0.025, 19.5]} />
          <meshStandardMaterial color={colors["room-rug"]} roughness={0.99} />
        </mesh>

        {/* Candidate Chair (Seated far back from the conference desk) */}
        <group position={[0, 0, 8.2]} rotation={[0, Math.PI, 0]}>
          <Seat position={[0, 0, 0]} colors={colors} />
        </group>

        {/* ============================================================ */}
        {/* ENCLOSED ARCHITECTURAL CEILING (CLOSED ON TOP) */}
        {/* ============================================================ */}
        <group position={[0, 5.65, 1.2]}>
          {/* Main Ceiling Slab */}
          <mesh receiveShadow>
            <boxGeometry args={[20.6, 0.22, 23]} />
            <meshStandardMaterial color="#ebece0" roughness={0.9} />
          </mesh>

          {/* Heavy Architectural Walnut Beams along X (Transverse) */}
          {[-7.2, -4.2, -1.2, 1.8, 4.8, 7.8].map((bz) => (
            <mesh key={bz} position={[0, -0.15, bz]} castShadow>
              <boxGeometry args={[20.4, 0.26, 0.38]} />
              <meshStandardMaterial
                color={colors["room-walnut-dark"]}
                roughness={0.62}
                map={grain ?? null}
              />
            </mesh>
          ))}

          {/* Longitudinal Walnut Beams along Z */}
          {[-6.8, -3.4, 0, 3.4, 6.8].map((bx) => (
            <mesh key={bx} position={[bx, -0.12, 0]} castShadow>
              <boxGeometry args={[0.34, 0.22, 22.8]} />
              <meshStandardMaterial
                color={colors["room-walnut-dark"]}
                roughness={0.62}
                map={grain ?? null}
              />
            </mesh>
          ))}

          {/* Recessed Warm LED Downlight Troffers */}
          {[-4.8, 0, 4.8].map((lx) =>
            [-2.7, 0.3, 3.3].map((lz) => (
              <group key={`${lx}-${lz}`} position={[lx, -0.09, lz]}>
                <mesh>
                  <boxGeometry args={[2.2, 0.05, 1.8]} />
                  <meshStandardMaterial
                    color="#ffffff"
                    emissive={environment.interiorLightColor}
                    emissiveIntensity={environment.interiorLightIntensity * 1.1}
                    roughness={0.3}
                  />
                </mesh>
                <mesh position={[0, -0.02, 0]}>
                  <boxGeometry args={[2.32, 0.03, 1.92]} />
                  <meshStandardMaterial
                    color={colors["room-brass"]}
                    metalness={0.6}
                    roughness={0.3}
                  />
                </mesh>
              </group>
            )),
          )}
        </group>

        {/* ============================================================ */}
        {/* LEFT WALL WITH LARGE ARCHITECTURAL PANORAMIC WINDOWS */}
        {/* ============================================================ */}
        <group position={[-9.85, 2.75, 1.6]}>
          {/* Lower Wainscot Wall beneath sill */}
          <mesh position={[0, -2.15, 0]} receiveShadow>
            <boxGeometry args={[0.26, 1.15, 23.6]} />
            <meshStandardMaterial color={colors["room-pine"]} roughness={0.88} />
          </mesh>
          {/* Top Soffit Wall above window header */}
          <mesh position={[0, 2.3, 0]} receiveShadow>
            <boxGeometry args={[0.26, 1.0, 23.6]} />
            <meshStandardMaterial color={colors["room-pine"]} roughness={0.88} />
          </mesh>
          {/* Corner Wall Pillars */}
          {[-10.4, 10.4].map((pz) => (
            <mesh key={pz} position={[0, 0, pz]}>
              <boxGeometry args={[0.28, 5.6, 2.8]} />
              <meshStandardMaterial color={colors["room-pine"]} roughness={0.88} />
            </mesh>
          ))}

          {/* Large Left Panoramic Window Frame (18m wide!) */}
          <group position={[0, 0.08, 0]}>
            {/* Walnut Sill & Header Moldings */}
            <mesh position={[0.02, -1.55, 0]}>
              <boxGeometry args={[0.34, 0.16, 18.2]} />
              <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.48} />
            </mesh>
            <mesh position={[0.02, 1.76, 0]}>
              <boxGeometry args={[0.34, 0.16, 18.2]} />
              <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.48} />
            </mesh>

            {/* Vertical Mullions */}
            {[-7.2, -4.3, -1.4, 1.4, 4.3, 7.2].map((mz) => (
              <mesh key={mz} position={[0.03, 0.1, mz]}>
                <boxGeometry args={[0.22, 3.2, 0.14]} />
                <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.52} />
              </mesh>
            ))}

            {/* Horizontal Transom divider */}
            <mesh position={[0.03, 0.2, 0]}>
              <boxGeometry args={[0.2, 0.12, 17.8]} />
              <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.52} />
            </mesh>

            {/* Translucent Window Glass Pane */}
            <mesh position={[0, 0.1, 0]}>
              <boxGeometry args={[0.04, 3.2, 17.8]} />
              <meshStandardMaterial
                color={environment.windowGlowColor}
                emissive={environment.windowGlowColor}
                emissiveIntensity={environment.windowGlowIntensity * 0.25}
                roughness={0.12}
                metalness={0.15}
                transparent
                opacity={0.62}
              />
            </mesh>
          </group>
        </group>

        {/* ============================================================ */}
        {/* RIGHT WALL WITH MATCHING PANORAMIC WINDOWS */}
        {/* ============================================================ */}
        <group position={[9.85, 2.75, 1.6]}>
          {/* Lower Wainscot Wall */}
          <mesh position={[0, -2.15, 0]} receiveShadow>
            <boxGeometry args={[0.26, 1.15, 23.6]} />
            <meshStandardMaterial color={colors["room-pine"]} roughness={0.88} />
          </mesh>
          {/* Top Soffit */}
          <mesh position={[0, 2.3, 0]} receiveShadow>
            <boxGeometry args={[0.26, 1.0, 23.6]} />
            <meshStandardMaterial color={colors["room-pine"]} roughness={0.88} />
          </mesh>
          {/* Corner Pillars */}
          {[-10.4, 10.4].map((pz) => (
            <mesh key={pz} position={[0, 0, pz]}>
              <boxGeometry args={[0.28, 5.6, 2.8]} />
              <meshStandardMaterial color={colors["room-pine"]} roughness={0.88} />
            </mesh>
          ))}

          {/* Large Right Panoramic Window Frame */}
          <group position={[0, 0.08, 0]}>
            <mesh position={[-0.02, -1.55, 0]}>
              <boxGeometry args={[0.34, 0.16, 18.2]} />
              <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.48} />
            </mesh>
            <mesh position={[-0.02, 1.76, 0]}>
              <boxGeometry args={[0.34, 0.16, 18.2]} />
              <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.48} />
            </mesh>

            {/* Vertical Mullions */}
            {[-7.2, -4.3, -1.4, 1.4, 4.3, 7.2].map((mz) => (
              <mesh key={mz} position={[-0.03, 0.1, mz]}>
                <boxGeometry args={[0.22, 3.2, 0.14]} />
                <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.52} />
              </mesh>
            ))}

            <mesh position={[-0.03, 0.2, 0]}>
              <boxGeometry args={[0.2, 0.12, 17.8]} />
              <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.52} />
            </mesh>

            <mesh position={[0, 0.1, 0]}>
              <boxGeometry args={[0.04, 3.2, 17.8]} />
              <meshStandardMaterial
                color={environment.windowGlowColor}
                emissive={environment.windowGlowColor}
                emissiveIntensity={environment.windowGlowIntensity * 0.25}
                roughness={0.12}
                metalness={0.15}
                transparent
                opacity={0.62}
              />
            </mesh>
          </group>
        </group>

        {/* ============================================================ */}
        {/* REAR ENTRY WALL BEHIND CANDIDATE (FOR FULL 360° ROTATION) */}
        {/* ============================================================ */}
        <group position={[0, 2.85, 11.4]}>
          <mesh receiveShadow>
            <boxGeometry args={[20.2, 5.7, 0.34]} />
            <meshStandardMaterial color={colors["room-pine"]} roughness={0.89} />
          </mesh>
          {/* Decorative Walnut Acoustic Slats on Left & Right Wings */}
          {[-7.4, -6.5, -5.6, -4.7, 4.7, 5.6, 6.5, 7.4].map((sx) => (
            <mesh key={sx} position={[sx, 0.1, -0.22]} castShadow>
              <boxGeometry args={[0.32, 4.7, 0.08]} />
              <meshStandardMaterial
                color={colors["room-walnut"]}
                roughness={0.62}
                map={grain ?? null}
              />
            </mesh>
          ))}
          {/* Center Walnut Double Entry Doors with Frosted Glass Inserts */}
          <group position={[0, -0.35, -0.2]}>
            <mesh position={[0, 2.38, 0]}>
              <boxGeometry args={[4.4, 0.22, 0.2]} />
              <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.5} />
            </mesh>
            {[-1.05, 1.05].map((dx) => (
              <group key={dx} position={[dx, 0, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[1.95, 4.5, 0.1]} />
                  <meshStandardMaterial
                    color={colors["room-walnut"]}
                    roughness={0.55}
                    map={grain ?? null}
                  />
                </mesh>
                <mesh position={[0, 0.25, -0.06]}>
                  <boxGeometry args={[1.15, 2.85, 0.03]} />
                  <meshStandardMaterial
                    color="#d8e3da"
                    roughness={0.22}
                    metalness={0.1}
                    transparent
                    opacity={0.48}
                  />
                </mesh>
                <mesh position={[dx > 0 ? -0.78 : 0.78, -0.15, -0.1]}>
                  <boxGeometry args={[0.06, 0.56, 0.06]} />
                  <meshStandardMaterial
                    color={colors["room-brass"]}
                    metalness={0.82}
                    roughness={0.22}
                  />
                </mesh>
              </group>
            ))}
          </group>
        </group>

        {/* ============================================================ */}
        {/* BACK WALL & REAR PANORAMIC WINDOW BEHIND PANELISTS */}
        {/* ============================================================ */}
        <group position={[0, 2.85, -7.8]}>
          {/* Lower wall */}
          <mesh position={[0, -2.15, 0]} receiveShadow>
            <boxGeometry args={[20.2, 1.25, 0.32]} />
            <meshStandardMaterial color={colors["room-pine"]} roughness={0.91} />
          </mesh>
          {/* Top header */}
          <mesh position={[0, 2.25, 0]} receiveShadow>
            <boxGeometry args={[20.2, 1.05, 0.32]} />
            <meshStandardMaterial color={colors["room-pine"]} roughness={0.91} />
          </mesh>
          {/* Left & right returns */}
          {[-8.5, 8.5].map((bx) => (
            <mesh key={bx} position={[bx, 0, 0]}>
              <boxGeometry args={[3.2, 5.6, 0.34]} />
              <meshStandardMaterial color={colors["room-pine"]} roughness={0.91} />
            </mesh>
          ))}

          {/* Panoramic center window */}
          <group position={[0, 0.1, 0.08]}>
            <mesh position={[0, -1.5, 0]}>
              <boxGeometry args={[14.2, 0.18, 0.24]} />
              <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.5} />
            </mesh>
            <mesh position={[0, 1.68, 0]}>
              <boxGeometry args={[14.2, 0.18, 0.24]} />
              <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.5} />
            </mesh>

            {/* Rear vertical window mullions */}
            {[-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4].map((x) => (
              <mesh key={x} position={[x, 0.1, 0.05]}>
                <boxGeometry args={[0.08, 3.0, 0.12]} />
                <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.48} />
              </mesh>
            ))}

            {/* Translucent Rear Window Glass */}
            <mesh position={[0, 0.1, 0]}>
              <boxGeometry args={[13.8, 3.0, 0.04]} />
              <meshStandardMaterial
                color={environment.windowGlowColor}
                emissive={environment.windowGlowColor}
                emissiveIntensity={environment.windowGlowIntensity * 0.3}
                roughness={0.14}
                metalness={0.12}
                transparent
                opacity={0.65}
              />
            </mesh>
          </group>
        </group>

        {/* ============================================================ */}
        {/* INTERACTIVE WALNUT CONFERENCE TABLE */}
        {/* ============================================================ */}
        <group
          onClick={handleTableClick}
          onPointerOver={(e) => {
            e.stopPropagation();
            setTableHovered(true);
          }}
          onPointerOut={() => setTableHovered(false)}
        >
          <mesh position={[0, 1.08, -0.98]} castShadow receiveShadow>
            <boxGeometry args={[12.1, 0.22, 3.9]} />
            <meshStandardMaterial
              color={colors["room-walnut"]}
              emissive={tableHovered ? "#d2a957" : "#000000"}
              emissiveIntensity={tableHovered ? 0.14 : 0}
              roughness={0.46}
              metalness={0.03}
              map={grain ?? null}
            />
          </mesh>
          <mesh position={[0, 0.953, -0.98]}>
            <boxGeometry args={[11.95, 0.055, 3.75]} />
            <meshStandardMaterial
              color={colors["room-walnut-light"]}
              roughness={0.52}
              metalness={0.04}
            />
          </mesh>
          <mesh position={[0, 0.57, -0.98]} castShadow>
            <boxGeometry args={[3.35, 0.68, 1.12]} />
            <meshStandardMaterial
              color={colors["room-walnut-dark"]}
              roughness={0.63}
              map={grain ?? null}
            />
          </mesh>
          {[-4.55, 4.55].map((x) => (
            <mesh key={x} position={[x, 0.48, -0.98]} castShadow>
              <boxGeometry args={[0.2, 0.92, 1.18]} />
              <meshStandardMaterial
                color={colors["room-walnut-dark"]}
                roughness={0.6}
                map={grain ?? null}
              />
            </mesh>
          ))}

          {/* Candidate Folio directly in front of the seated user */}
          <group position={[0, 1.205, 0.52]} rotation={[-0.02, 0, 0]}>
            <mesh castShadow>
              <boxGeometry args={[1.65, 0.03, 1.1]} />
              <meshStandardMaterial color={tableHovered ? "#789575" : "#422c1d"} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[1.48, 0.96]} />
              <meshBasicMaterial map={folioTexture ?? null} toneMapped={false} />
            </mesh>
            {/* Brass pen resting beside folio */}
            <mesh position={[0.72, 0.032, 0.08]} rotation={[0, 0.14, Math.PI / 2]}>
              <cylinderGeometry args={[0.018, 0.018, 0.52, 8]} />
              <meshStandardMaterial color={colors["room-brass"]} metalness={0.8} roughness={0.22} />
            </mesh>
          </group>
        </group>

        {/* ============================================================ */}
        {/* FIVE UNIQUE ROBLOX CHARACTERS & TABLE NAMEPLATES */}
        {/* ============================================================ */}
        {avatarPositions.map((x, index) => {
          const member = INTERVIEW_PANEL[index]!;
          const texture = nameplateTextures[index];
          const isActive = activeSpeaker?.toLowerCase() === member.name.toLowerCase();
          return (
            <group key={member.name} position={[x, 0, 0]}>
              <Avatar
                member={member}
                x={0}
                colors={colors}
                grain={grain}
                isActive={isActive}
                isSpeaking={isActive && isSpeaking}
                speakingAmplitudeRef={speakingAmplitudeRef}
                onSelect={() => {
                  if (dragDeltaRef.current > 5) return;
                  onSelectAgent?.(member.name);
                }}
              />
              <mesh position={[0, 1.46, -0.08]} castShadow>
                <boxGeometry args={[1.88, 0.77, 0.11]} />
                <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.47} />
              </mesh>
              <mesh position={[0, 1.47, -0.013]}>
                <planeGeometry args={[1.76, 0.64]} />
                <meshBasicMaterial map={texture ?? null} toneMapped={false} />
              </mesh>
              <mesh position={[0, 1.07, -0.05]} castShadow>
                <boxGeometry args={[1.84, 0.065, 0.18]} />
                <meshStandardMaterial
                  color={colors["room-brass"]}
                  emissive={isActive ? "#d2a957" : "#000000"}
                  emissiveIntensity={isActive ? 0.5 : 0}
                  metalness={0.74}
                  roughness={0.28}
                />
              </mesh>
            </group>
          );
        })}

        {/* Plants & Walnut floor trim */}
        {[-5.8, 5.8].map((x) => (
          <Plant key={x} position={[x, 0, -4.9]} colors={colors} />
        ))}
        <mesh position={[0, 0.04, -5.9]}>
          <boxGeometry args={[8.8, 0.07, 0.13]} />
          <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.43} />
        </mesh>
      </group>
    </>
  );
}

/**
 * Interactive Standing 3D Roblox Character Figure for the Agents Landing Showcase.
 * Supports smooth 360-degree click-and-drag inspection, gentle cursor eye-contact tracking,
 * natural breathing & blinking, and a cheerful wave greeting animation on click.
 */
function InteractiveRobloxCharacter({
  member,
  dragRotationRef,
  pointerRef,
  waveUntilRef,
  onWave,
}: {
  member: PanelMember;
  dragRotationRef: React.MutableRefObject<{ yaw: number; pitch: number; isDragging: boolean }>;
  pointerRef: React.MutableRefObject<{ x: number; y: number }>;
  waveUntilRef: React.MutableRefObject<number>;
  onWave: () => void;
}) {
  const rootRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const rightArmPivotRef = useRef<Group>(null);
  const leftArmPivotRef = useRef<Group>(null);
  const mouthRef = useRef<Mesh>(null);
  const leftEyeRef = useRef<Mesh>(null);
  const rightEyeRef = useRef<Mesh>(null);
  const ringMatRef = useRef<{ emissiveIntensity: number }>(null);

  const currentYaw = useRef(0.18);
  const currentPitch = useRef(0.02);

  const torsoWidth =
    member.name === "Marcus"
      ? 0.88
      : member.name === "ananya" || member.name === "sarah"
        ? 0.77
        : 0.83;

  const trouserColor =
    member.name === "ananya" ? "#4a594c" : member.name === "sarah" ? "#4a3f3d" : "#2a3430";

  useFrame(({ clock }, delta) => {
    const dt = Math.min(0.1, delta);
    const t = clock.elapsedTime;
    const now = performance.now();
    const waveRemaining = Math.max(0, (waveUntilRef.current - now) / 1000);
    const isWaving = waveRemaining > 0;

    // Gentle idle studio sway when user isn't dragging
    if (!dragRotationRef.current.isDragging && !isWaving) {
      dragRotationRef.current.yaw += dt * 0.22;
    }

    currentYaw.current = MathUtils.damp(currentYaw.current, dragRotationRef.current.yaw, 9, dt);
    currentPitch.current = MathUtils.damp(
      currentPitch.current,
      dragRotationRef.current.pitch,
      9,
      dt,
    );

    if (rootRef.current) {
      rootRef.current.rotation.y = currentYaw.current;
      rootRef.current.rotation.x = currentPitch.current;
      const breath = Math.sin(t * 1.6) * 0.018;
      const bounce = isWaving ? Math.abs(Math.sin(t * 7.2)) * 0.055 : 0;
      rootRef.current.position.y = -1.35 + breath + bounce;
    }

    if (headRef.current) {
      const targetHeadY = MathUtils.clamp(pointerRef.current.x * 0.28, -0.32, 0.32);
      const targetHeadX = isWaving
        ? -0.06 + Math.sin(t * 6.4) * 0.06
        : MathUtils.clamp(-pointerRef.current.y * 0.16, -0.18, 0.18);
      headRef.current.rotation.y = MathUtils.damp(headRef.current.rotation.y, targetHeadY, 8, dt);
      headRef.current.rotation.x = MathUtils.damp(headRef.current.rotation.x, targetHeadX, 8, dt);
    }

    if (rightArmPivotRef.current) {
      const targetZ = isWaving ? 2.45 + Math.sin(t * 11.5) * 0.36 : -0.08;
      const targetX = isWaving ? -0.25 : Math.sin(t * 1.4) * 0.05;
      rightArmPivotRef.current.rotation.z = MathUtils.damp(
        rightArmPivotRef.current.rotation.z,
        targetZ,
        12,
        dt,
      );
      rightArmPivotRef.current.rotation.x = MathUtils.damp(
        rightArmPivotRef.current.rotation.x,
        targetX,
        10,
        dt,
      );
    }

    if (leftArmPivotRef.current) {
      const targetX = isWaving ? -0.14 : -Math.sin(t * 1.4) * 0.05;
      leftArmPivotRef.current.rotation.x = MathUtils.damp(
        leftArmPivotRef.current.rotation.x,
        targetX,
        8,
        dt,
      );
    }

    if (mouthRef.current) {
      const targetMouthScaleY = isWaving ? 1.55 + Math.abs(Math.sin(t * 10)) * 0.75 : 1;
      mouthRef.current.scale.y = MathUtils.damp(
        mouthRef.current.scale.y,
        targetMouthScaleY,
        12,
        dt,
      );
    }

    const blinkCycle = (t + member.name.length * 0.65) % 4.4;
    const eyeScaleY = blinkCycle > 4.26 ? 0.12 : 1;
    if (leftEyeRef.current) leftEyeRef.current.scale.y = eyeScaleY;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = eyeScaleY;

    if (ringMatRef.current) {
      ringMatRef.current.emissiveIntensity = MathUtils.damp(
        ringMatRef.current.emissiveIntensity,
        isWaving ? 0.75 : 0.16,
        8,
        dt,
      );
    }
  });

  return (
    <group>
      {/* Frosted Studio Pedestal */}
      <group position={[0, -1.42, 0]}>
        <mesh receiveShadow>
          <cylinderGeometry args={[1.08, 1.18, 0.14, 36]} />
          <meshStandardMaterial color="#e8eee4" roughness={0.35} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.075, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.03, 0.024, 12, 48]} />
          <meshStandardMaterial
            ref={ringMatRef as never}
            color="#c8a35f"
            emissive="#d4af64"
            emissiveIntensity={0.16}
            metalness={0.78}
            roughness={0.25}
          />
        </mesh>
      </group>

      {/* Standing Full-Body Roblox Character */}
      <group
        ref={rootRef}
        position={[0, -1.35, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onWave();
        }}
      >
        {/* Standing Legs & Dress Shoes */}
        {[-0.21, 0.21].map((lx) => (
          <group key={lx} position={[lx, 0, 0]}>
            <mesh position={[0, 0.64, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.34, 1.02, 0.34]} />
              <meshStandardMaterial color={trouserColor} roughness={0.82} />
            </mesh>
            <mesh position={[0, 0.08, 0.05]} castShadow>
              <boxGeometry args={[0.35, 0.16, 0.44]} />
              <meshStandardMaterial color="#27201c" roughness={0.48} />
            </mesh>
          </group>
        ))}

        {/* Torso & Blazer */}
        <mesh position={[0, 1.62, 0]} castShadow receiveShadow>
          <boxGeometry args={[torsoWidth, 0.94, 0.42]} />
          <meshStandardMaterial color={member.jacketColor} roughness={0.76} />
        </mesh>
        {/* Crisp Shirt V */}
        <mesh position={[0, 1.64, 0.22]}>
          <boxGeometry args={[0.22, 0.78, 0.035]} />
          <meshStandardMaterial color="#f2efe3" roughness={0.62} />
        </mesh>
        {/* Accent Tie / Lapel */}
        <mesh position={[0, 1.44, 0.25]}>
          <boxGeometry args={[0.09, 0.4, 0.05]} />
          <meshStandardMaterial color={member.accentColor} roughness={0.5} />
        </mesh>
        {/* Neck */}
        <mesh position={[0, 2.02, 0]} castShadow>
          <cylinderGeometry args={[0.105, 0.115, 0.24, 12]} />
          <meshStandardMaterial color={member.skinColor} roughness={0.84} />
        </mesh>

        {/* Head Assembly (reuses exact boardroom hair & glasses) */}
        <group ref={headRef} position={[0, 0, 0]}>
          <mesh position={[0, 2.35, 0.005]} castShadow>
            <boxGeometry args={[0.56, 0.59, 0.48]} />
            <meshStandardMaterial color={member.skinColor} roughness={0.86} />
          </mesh>
          <mesh ref={mouthRef} position={[0, 2.22, 0.254]}>
            <boxGeometry args={[0.21, 0.045, 0.022]} />
            <meshStandardMaterial color="#4e2e24" roughness={0.82} />
          </mesh>
          <mesh ref={leftEyeRef} position={[-0.115, 2.39, 0.256]}>
            <boxGeometry args={[0.06, 0.08, 0.02]} />
            <meshStandardMaterial color="#1f2922" roughness={0.68} />
          </mesh>
          <mesh ref={rightEyeRef} position={[0.115, 2.39, 0.256]}>
            <boxGeometry args={[0.06, 0.08, 0.02]} />
            <meshStandardMaterial color="#1f2922" roughness={0.68} />
          </mesh>
          <RobloxGlasses kind={member.hasGlasses} />
          <RobloxHair member={member} />
        </group>

        {/* Left Shoulder-Pivoted Arm */}
        <group ref={leftArmPivotRef} position={[-(torsoWidth / 2 + 0.13), 1.98, 0]}>
          <mesh position={[0, -0.36, 0]} castShadow>
            <boxGeometry args={[0.24, 0.72, 0.26]} />
            <meshStandardMaterial color={member.jacketColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.78, 0.01]} castShadow>
            <boxGeometry args={[0.21, 0.17, 0.22]} />
            <meshStandardMaterial color={member.skinColor} roughness={0.84} />
          </mesh>
        </group>

        {/* Right Shoulder-Pivoted Arm (raises cleanly to wave on click) */}
        <group ref={rightArmPivotRef} position={[torsoWidth / 2 + 0.13, 1.98, 0]}>
          <mesh position={[0, -0.36, 0]} castShadow>
            <boxGeometry args={[0.24, 0.72, 0.26]} />
            <meshStandardMaterial color={member.jacketColor} roughness={0.78} />
          </mesh>
          <mesh position={[0, -0.78, 0.01]} castShadow>
            <boxGeometry args={[0.21, 0.17, 0.22]} />
            <meshStandardMaterial color={member.skinColor} roughness={0.84} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export interface InteractiveAgentShowcaseProps {
  member: PanelMember;
  waveSignal?: number;
  resetSignal?: number;
  onInteract?: () => void;
}

export function InteractiveAgentShowcaseCanvas({
  member,
  waveSignal = 0,
  resetSignal = 0,
  onInteract,
}: InteractiveAgentShowcaseProps) {
  const dragRotationRef = useRef({ yaw: 0.22, pitch: 0.03, isDragging: false });
  const pointerRef = useRef({ x: 0, y: 0 });
  const waveUntilRef = useRef(0);
  const dragStartRef = useRef<{ x: number; y: number; yaw: number; pitch: number; moved: number }>({
    x: 0,
    y: 0,
    yaw: 0.22,
    pitch: 0.03,
    moved: 0,
  });

  useEffect(() => {
    if (waveSignal > 0) {
      waveUntilRef.current = performance.now() + 2400;
      dragRotationRef.current.yaw = 0;
      dragRotationRef.current.pitch = 0.02;
    }
  }, [waveSignal]);

  useEffect(() => {
    if (resetSignal > 0) {
      dragRotationRef.current.yaw = 0.18;
      dragRotationRef.current.pitch = 0.03;
    }
  }, [resetSignal]);

  const triggerWave = () => {
    if (dragStartRef.current.moved > 6) return;
    waveUntilRef.current = performance.now() + 2400;
    dragRotationRef.current.yaw = 0;
    dragRotationRef.current.pitch = 0.02;
    onInteract?.();
  };

  return (
    <div
      className="relative w-full h-[330px] sm:h-[360px] rt-agent-3d-stage overflow-hidden select-none cursor-grab active:cursor-grabbing"
      onPointerDown={(e) => {
        dragRotationRef.current.isDragging = true;
        dragStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          yaw: dragRotationRef.current.yaw,
          pitch: dragRotationRef.current.pitch,
          moved: 0,
        };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore unsupported capture
        }
      }}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        pointerRef.current.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
        pointerRef.current.y = -(((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);

        if (!dragRotationRef.current.isDragging) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        dragStartRef.current.moved = Math.max(dragStartRef.current.moved, Math.hypot(dx, dy));
        dragRotationRef.current.yaw = dragStartRef.current.yaw + dx * 0.011;
        dragRotationRef.current.pitch = MathUtils.clamp(
          dragStartRef.current.pitch + dy * 0.004,
          -0.28,
          0.32,
        );
      }}
      onPointerUp={(e) => {
        dragRotationRef.current.isDragging = false;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore unsupported capture
        }
      }}
      onPointerLeave={() => {
        dragRotationRef.current.isDragging = false;
        pointerRef.current.x = 0;
        pointerRef.current.y = 0;
      }}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.35, 4.45], fov: 38 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.95} color="#fffef8" />
        <hemisphereLight args={["#f7faf4", "#b4c5b0", 0.8]} />
        <directionalLight position={[3.5, 5.2, 4.5]} intensity={1.35} color="#fffaf0" castShadow />
        <directionalLight position={[-3.2, 2.8, -2.5]} intensity={0.55} color="#d9ead6" />
        <pointLight position={[0, 2.2, 2.2]} intensity={0.85} color="#fff5e0" />
        <InteractiveRobloxCharacter
          member={member}
          dragRotationRef={dragRotationRef}
          pointerRef={pointerRef}
          waveUntilRef={waveUntilRef}
          onWave={triggerWave}
        />
      </Canvas>
    </div>
  );
}

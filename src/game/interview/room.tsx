import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { CanvasTexture, Color, Group, PerspectiveCamera, SRGBColorSpace } from "three";
import { INTERVIEW_PANEL } from "./team";

function roomColors() {
  const names = [
    "--room-walnut", "--room-walnut-light", "--room-walnut-dark", "--room-brass",
    "--room-pine", "--room-pine-light", "--room-glass", "--room-rug",
    "--room-skin", "--room-ivory", "--room-suit", "--room-shirt", "--room-glass-back",
  ];
  const probe = document.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.append(probe);
  const colors = Object.fromEntries(names.map((name) => {
    probe.style.color = `var(${name})`;
    return [name.slice(2), getComputedStyle(probe).color];
  })) as Record<string, string>;
  probe.remove();
  return colors;
}

function makeNameplateTexture(name: string, title: string, colors: Record<string, string>) {
  const surface = document.createElement("canvas");
  surface.width = 640;
  surface.height = 224;
  const context = surface.getContext("2d");
  if (!context) return null;

  context.fillStyle = colors["room-ivory"];
  context.fillRect(0, 0, 640, 224);
  context.fillStyle = colors["room-pine"];
  context.fillRect(0, 0, 12, 224);
  context.fillStyle = colors["room-brass"];
  context.fillRect(35, 35, 39, 4);
  context.fillStyle = colors["room-walnut-dark"];
  context.font = "700 42px Avenir Next, Avenir, Segoe UI, sans-serif";
  context.fillText(name, 35, 106, 560);

  context.fillStyle = colors["room-pine"];
  context.font = "500 25px Avenir Next, Avenir, Segoe UI, sans-serif";
  const words = title.split(" ");
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > 570 && line) {
      lines.push(line);
      line = word;
    } else line = next;
  });
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((item, index) => context.fillText(item, 35, 155 + index * 34, 570));

  const texture = new CanvasTexture(surface);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function RoomCamera() {
  const { camera, size } = useThree();

  useMemo(() => {
    const perspective = camera as PerspectiveCamera;
    const portrait = size.width < 640;
    perspective.fov = portrait ? 56 : 52;
    perspective.position.set(0, portrait ? 2.55 : 2.05, portrait ? 20 : 13);
    perspective.lookAt(0, 1.45, -1.15);
    perspective.updateProjectionMatrix();
  }, [camera, size.width]);

  return null;
}

function WoodGrain({ width = 1024, height = 512 }: { width?: number; height?: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#694831";
    context.fillRect(0, 0, width, height);
    for (let index = 0; index < 170; index += 1) {
      const y = (index / 170) * height;
      context.beginPath();
      context.moveTo(0, y + Math.sin(index * 1.7) * 3);
      context.bezierCurveTo(width * 0.26, y + Math.cos(index) * 14, width * 0.71, y + Math.sin(index * 0.8) * 10, width, y + Math.cos(index * 1.3) * 4);
      context.strokeStyle = index % 5 === 0 ? "rgba(232, 182, 119, .2)" : "rgba(32, 19, 12, .11)";
      context.lineWidth = index % 7 === 0 ? 3 : 1;
      context.stroke();
    }
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    result.wrapS = result.wrapT = 1000;
    result.anisotropy = 8;
    return result;
  }, [height, width]);

  return texture;
}

function Seat({ position, colors }: { position: [number, number, number]; colors: Record<string, string> }) {
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
      {[-0.32, 0.32].map((x) => [-0.4, 0.22].map((z) => (
        <mesh key={`${x}-${z}`} position={[x, 0.52, z]} castShadow>
          <boxGeometry args={[0.095, 1.04, 0.095]} />
          <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.65} />
        </mesh>
      )))}
    </group>
  );
}

type AvatarStyle = "analyst" | "recruiter" | "engineer" | "people" | "leader";

const STYLE_COLORS: Record<AvatarStyle, { jacket: "room-suit" | "room-pine" | "room-walnut" | "room-pine-light"; accent: "room-walnut-light" | "room-brass" | "room-glass" | "room-walnut-dark" }> = {
  analyst: { jacket: "room-suit", accent: "room-walnut-light" },
  recruiter: { jacket: "room-pine", accent: "room-brass" },
  engineer: { jacket: "room-suit", accent: "room-glass" },
  people: { jacket: "room-pine-light", accent: "room-walnut-dark" },
  leader: { jacket: "room-walnut", accent: "room-brass" },
};

function Avatar({ member, x, colors, grain }: { member: (typeof INTERVIEW_PANEL)[number]; x: number; colors: Record<string, string>; grain: CanvasTexture | null }) {
  const figure = useRef<Group>(null);
  const style = STYLE_COLORS[member.avatar];

  useFrame(({ clock }) => {
    if (figure.current) figure.current.position.y = 0.012 * Math.sin(clock.elapsedTime * 0.8 + x);
  });

  return (
    <group position={[x, 0, -1.88]}>
      <Seat position={[0, 0, 0]} colors={colors} />
      <group ref={figure} position={[0, 0, 0.06]}>
        <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.83, 0.86, 0.4]} />
          <meshStandardMaterial color={colors[style.jacket]} map={grain ?? undefined} roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.7, 0.218]}>
          <boxGeometry args={[0.21, 0.73, 0.035]} />
          <meshStandardMaterial color={colors["room-shirt"]} roughness={0.65} />
        </mesh>
        <mesh position={[0, 1.48, 0.25]}>
          <boxGeometry args={[0.085, 0.37, 0.055]} />
          <meshStandardMaterial color={colors[style.accent]} roughness={0.6} />
        </mesh>
        <mesh position={[0, 2.03, 0]} castShadow>
          <cylinderGeometry args={[0.105, 0.11, 0.25, 8]} />
          <meshStandardMaterial color={colors["room-skin"]} roughness={0.85} />
        </mesh>
        <mesh position={[0, 2.35, 0.005]} castShadow>
          <boxGeometry args={[0.55, 0.59, 0.48]} />
          <meshStandardMaterial color={colors["room-skin"]} roughness={0.9} />
        </mesh>
        <mesh position={[0, 2.24, 0.252]}>
          <boxGeometry args={[0.25, 0.052, 0.018]} />
          <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.85} />
        </mesh>
        <mesh position={[-0.112, 2.39, 0.256]}>
          <boxGeometry args={[0.052, 0.07, 0.018]} />
          <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.85} />
        </mesh>
        <mesh position={[0.112, 2.39, 0.256]}>
          <boxGeometry args={[0.052, 0.07, 0.018]} />
          <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.85} />
        </mesh>
        <mesh position={[0, 2.66, -0.045]} castShadow>
          <boxGeometry args={[0.59, 0.19, 0.53]} />
          <meshStandardMaterial color={colors[style.jacket === "room-walnut" ? "room-walnut-dark" : style.jacket]} roughness={0.88} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.49, 1.62, 0.065]} rotation={[0, 0, side * -0.1]} castShadow>
            <boxGeometry args={[0.23, 0.64, 0.27]} />
            <meshStandardMaterial color={colors[style.jacket]} roughness={0.82} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Plant({ position, colors }: { position: [number, number, number]; colors: Record<string, string> }) {
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
        <mesh key={leaf} position={[Math.cos(leaf * 1.25) * 0.3, 1.57 + (leaf % 3) * 0.14, Math.sin(leaf * 1.25) * 0.23]} rotation={[0, 0, (leaf - 2) * 0.19]} castShadow>
          <boxGeometry args={[0.16, 1.1 - (leaf % 2) * 0.16, 0.12]} />
          <meshStandardMaterial color={leaf % 2 ? colors["room-pine-light"] : colors["room-pine"]} roughness={0.91} />
        </mesh>
      ))}
    </group>
  );
}

export function InterviewRoom() {
  const { size } = useThree();
  const colors = useMemo(roomColors, []);
  const grain = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 384;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = colors["room-walnut"];
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 132; index += 1) {
      const y = (index / 132) * canvas.height;
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(230, y + Math.sin(index * 1.4) * 9, 760, y + Math.cos(index) * 12, 1024, y + Math.sin(index * 0.6) * 4);
      context.strokeStyle = index % 6 === 0 ? "rgba(239, 194, 126, .21)" : "rgba(40, 23, 12, .13)";
      context.lineWidth = index % 9 === 0 ? 3 : 1;
      context.stroke();
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }, [colors]);
  const nameplateTextures = useMemo(() => INTERVIEW_PANEL.map((member) => makeNameplateTexture(member.name, member.title, colors)), [colors]);
  const xScale = size.width < 640 ? 0.57 : 1;
  const avatarPositions = [-4.75, -2.38, 0, 2.38, 4.75];

  return (
    <>
      <RoomCamera />
      <group scale={[xScale, 1, 1]}>
        <mesh position={[0, -0.12, -1.1]} receiveShadow>
          <boxGeometry args={[24, 0.24, 28]} />
          <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.86} map={grain ?? undefined} />
        </mesh>
        <mesh position={[0, 0.012, -1.2]} receiveShadow>
          <boxGeometry args={[20, 0.025, 18]} />
          <meshStandardMaterial color={colors["room-rug"]} roughness={0.99} />
        </mesh>
        {[-9.85, 9.85].map((x) => (
          <group key={x} position={[x, 2.8, -2.8]}>
            <mesh receiveShadow>
              <boxGeometry args={[0.24, 5.6, 14]} />
              <meshStandardMaterial color={colors["room-pine"]} roughness={0.9} />
            </mesh>
            {[-2, -0.7, 0.7, 2].map((y) => (
              <mesh key={y} position={[-x * 0.025, y, 0]}>
                <boxGeometry args={[0.28, 0.065, 14.1]} />
                <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.56} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 2.95, -7.8]} receiveShadow>
          <boxGeometry args={[20, 5.9, 0.3]} />
          <meshStandardMaterial color={colors["room-pine"]} roughness={0.91} />
        </mesh>
        <mesh position={[0, 0.2, -7.57]}>
          <boxGeometry args={[20, 0.22, 0.22]} />
          <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.5} />
        </mesh>
        <mesh position={[0, 4.9, -7.57]}>
          <boxGeometry args={[20, 0.18, 0.22]} />
          <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.5} />
        </mesh>

        <group position={[0, 3.0, -7.57]}>
          <mesh>
            <boxGeometry args={[8.3, 2.95, 0.09]} />
            <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.53} />
          </mesh>
          <mesh position={[0, 0, 0.056]}>
            <boxGeometry args={[7.9, 2.58, 0.035]} />
            <meshStandardMaterial color={colors["room-glass-back"]} emissive={colors["room-glass"]} emissiveIntensity={0.35} roughness={0.24} metalness={0.12} />
          </mesh>
          {[-3.98, -2.65, -1.33, 0, 1.33, 2.65, 3.98].map((x) => (
            <mesh key={x} position={[x, 0, 0.095]}>
              <boxGeometry args={[0.06, 2.76, 0.07]} />
              <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.45} />
            </mesh>
          ))}
          <mesh position={[0, -0.1, 0.097]}>
            <boxGeometry args={[8.02, 0.075, 0.07]} />
            <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.45} />
          </mesh>
          {[-3.3, 0, 3.3].map((x, index) => (
            <mesh key={x} position={[x, -0.5, -0.24 + index * 0.05]} castShadow>
              <boxGeometry args={[0.8, 1.3 + (index % 2) * 0.45, 0.3]} />
              <meshStandardMaterial color={index === 1 ? colors["room-pine"] : colors["room-walnut-dark"]} roughness={0.76} />
            </mesh>
          ))}
        </group>

        {[-7.4, 7.4].map((x) => (
          <group key={x} position={[x, 3.0, -7.35]}>
            <mesh position={[0, 0.45, 0]}>
              <boxGeometry args={[1.1, 2.75, 0.08]} />
              <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.48, 0.055]}>
              <boxGeometry args={[0.84, 2.35, 0.035]} />
              <meshStandardMaterial color={colors["room-glass"]} emissive={colors["room-glass"]} emissiveIntensity={0.27} roughness={0.3} />
            </mesh>
          </group>
        ))}

        <mesh position={[0, 1.08, -0.98]} castShadow receiveShadow>
          <boxGeometry args={[12.1, 0.22, 3.9]} />
          <meshStandardMaterial color={colors["room-walnut"]} roughness={0.46} metalness={0.03} map={grain ?? undefined} />
        </mesh>
        <mesh position={[0, 0.953, -0.98]}>
          <boxGeometry args={[11.95, 0.055, 3.75]} />
          <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.52} metalness={0.04} />
        </mesh>
        <mesh position={[0, 0.57, -0.98]} castShadow>
          <boxGeometry args={[3.35, 0.68, 1.12]} />
          <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.63} map={grain ?? undefined} />
        </mesh>
        {[-4.55, 4.55].map((x) => (
          <mesh key={x} position={[x, 0.48, -0.98]} castShadow>
            <boxGeometry args={[0.2, 0.92, 1.18]} />
            <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.6} map={grain ?? undefined} />
          </mesh>
        ))}

        {avatarPositions.map((x, index) => {
          const member = INTERVIEW_PANEL[index];
          const texture = nameplateTextures[index];
          return (
            <group key={member.name} position={[x, 0, 0]}>
              <Avatar member={member} x={0} colors={colors} grain={grain} />
              <mesh position={[0, 1.46, -0.08]} castShadow>
                <boxGeometry args={[1.88, 0.77, 0.11]} />
                <meshStandardMaterial color={colors["room-walnut-dark"]} roughness={0.47} />
              </mesh>
              <mesh position={[0, 1.47, -0.013]}>
                <planeGeometry args={[1.76, 0.64]} />
                <meshBasicMaterial map={texture ?? undefined} toneMapped={false} />
              </mesh>
              <mesh position={[0, 1.07, -0.05]} castShadow>
                <boxGeometry args={[1.84, 0.065, 0.18]} />
                <meshStandardMaterial color={colors["room-brass"]} metalness={0.74} roughness={0.28} />
              </mesh>
            </group>
          );
        })}

        {[-5.8, 5.8].map((x) => <Plant key={x} position={[x, 0, -4.9]} colors={colors} />)}
        <mesh position={[0, 0.04, -5.9]}>
          <boxGeometry args={[8.8, 0.07, 0.13]} />
          <meshStandardMaterial color={colors["room-walnut-light"]} roughness={0.43} />
        </mesh>
      </group>
    </>
  );
}
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InterviewRoom } from "@/game/interview/room";
import { Camera, Circle, Eye, ShieldCheck, Video, VideoOff } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "The Panel — First-Person Interview Room" },
      { name: "description", content: "Take your seat in a warm, first-person interview room with five specialist interviewers. Your camera stays off unless you choose to turn it on." },
      { property: "og:title", content: "The Panel — Interview Room" },
      { property: "og:description", content: "A private first-person boardroom for a five-specialist interview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
    return () => stream?.getTracks().forEach((track) => track.stop());
  }, [stream]);

  async function toggleCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setCameraError(null);
      return;
    }

    setCameraError(null);
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setStream(nextStream);
    } catch {
      setCameraError("Camera access wasn’t granted. Check your device permission and try again.");
    }
  }

  return (
    <main className="interview-shell">
      <Canvas
        className="interview-canvas"
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
        camera={{ position: [0, 2.05, 13], fov: 52, near: 0.1, far: 80 }}
        aria-label="First-person 3D view from the candidate’s seat across the conference table toward five interviewers"
      >
        <color attach="background" args={["#78939a"]} />
        <fog attach="fog" args={["#78939a", 24, 58]} />
        <ambientLight intensity={1.65} />
        <directionalLight position={[-4, 9, 5]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
        <pointLight position={[0, 4.5, -4]} intensity={65} distance={18} color="#f1c879" />
        <Environment resolution={128}>
          <mesh scale={100}>
            <sphereGeometry args={[1, 24, 24]} />
            <meshBasicMaterial color="#94adb0" side={2} />
          </mesh>
          <directionalLight position={[0, 3, 3]} intensity={1.1} />
        </Environment>
        <InterviewRoom />
      </Canvas>

      <header className="interview-topbar">
        <div className="interview-brand">
          <div className="brand-mark" aria-hidden="true"><Eye size={18} strokeWidth={1.8} /></div>
          <div className="brand-copy">
            <div className="brand-name">THE PANEL</div>
            <div className="brand-caption">PRIVATE INTERVIEW ROOM</div>
          </div>
        </div>
        <div className="interview-presence" aria-label="Five interviewers are seated and ready">
          <span className="presence-dot" aria-hidden="true" />
          <span>5 interviewers</span>
          <span className="footer-divider" aria-hidden="true" />
          <span>Ready</span>
        </div>
      </header>

      <footer className="interview-footer" aria-label="Session information">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>Private session</span>
        <span className="footer-divider" aria-hidden="true" />
        <span className="footer-count">01 <span aria-hidden="true">/</span> 05</span>
        <span className="camera-footer-label">specialists</span>
      </footer>

      <section className="camera-panel" aria-label="Your camera preview">
        <div className="camera-panel-header">
          <span className="camera-panel-title"><Camera size={14} /> Your camera</span>
          <span className="camera-status">
            <Circle size={7} fill="currentColor" aria-hidden="true" />
            {stream ? "On" : "Off"}
          </span>
        </div>
        <div className="camera-view">
          {stream ? (
            <video ref={videoRef} className="camera-video" autoPlay muted playsInline aria-label="Live mirrored camera preview" />
          ) : (
            <div className="camera-empty">
              <div className="camera-empty-icon"><VideoOff size={18} aria-hidden="true" /></div>
              <span className="camera-empty-copy">Your camera is off. Turn it on when you’re ready.</span>
            </div>
          )}
        </div>
        <div className="camera-panel-action">
          <span className="camera-status"><ShieldCheck size={13} aria-hidden="true" /> Only shared from this device</span>
          <Button
            className="camera-enable"
            size="sm"
            onClick={toggleCamera}
            aria-label={stream ? "Turn camera off" : "Turn camera on"}
          >
            {stream ? <><VideoOff size={13} /> Turn off</> : <><Video size={13} /> Turn on</>}
          </Button>
        </div>
        {cameraError && <p className="camera-error" role="status">{cameraError}</p>}
      </section>
    </main>
  );
}

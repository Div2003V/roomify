import { Canvas } from "@react-three/fiber";
import { Environment, Grid, OrbitControls } from "@react-three/drei";
import { useMemo, useState } from "react";
import * as THREE from "three";

type Props = {
  scene?: FloorPlanSceneData;
};

type CameraPreset = "iso" | "top";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const computeScene = (scene?: FloorPlanSceneData) => {
  const points = Array.isArray(scene?.points) ? scene!.points! : [];
  const classes = Array.isArray(scene?.classes) ? scene!.classes! : [];
  const width = typeof scene?.Width === "number" && scene.Width > 0 ? scene.Width : 1024;
  const height = typeof scene?.Height === "number" && scene.Height > 0 ? scene.Height : 1024;

  const items = points.map((p, i) => ({
    box: {
      x1: Math.min(p.x1, p.x2),
      y1: Math.min(p.y1, p.y2),
      x2: Math.max(p.x1, p.x2),
      y2: Math.max(p.y1, p.y2),
    },
    kind: classes[i]?.name ?? "wall",
  }));

  // normalize into a centered XY plane (we'll render on XZ for a "floor")
  const norm = items.map((it) => {
    const w = Math.max(1, it.box.x2 - it.box.x1);
    const h = Math.max(1, it.box.y2 - it.box.y1);
    const cx = it.box.x1 + w / 2;
    const cy = it.box.y1 + h / 2;
    return {
      kind: it.kind,
      w,
      h,
      cx,
      cy,
    };
  });

  return { width, height, items: norm };
};

function SceneMeshes({
  scene,
  selectedIndex,
  onSelect,
}: {
  scene: ReturnType<typeof computeScene>;
  selectedIndex: number | null;
  onSelect: (idx: number | null) => void;
}) {
  const { width, height, items } = scene;

  const scale = 10 / Math.max(width, height); // keep consistent world size
  const baseY = 0;

  const wallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#d2d0cb",
        roughness: 0.95,
        metalness: 0.0,
      }),
    [],
  );
  const doorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#b88a5a",
        roughness: 0.7,
        metalness: 0.0,
      }),
    [],
  );
  const windowMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#9bd7ff",
        roughness: 0.05,
        transmission: 0.85,
        thickness: 0.4,
        ior: 1.35,
      }),
    [],
  );
  const selectedMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#111827",
        roughness: 0.6,
        metalness: 0.05,
        emissive: new THREE.Color("#3b82f6"),
        emissiveIntensity: 0.15,
      }),
    [],
  );

  const floorSize = 12;

  return (
    <>
      <mesh receiveShadow position={[0, baseY - 0.02, 0]}>
        <boxGeometry args={[floorSize, 0.04, floorSize]} />
        <meshStandardMaterial color="#f5f3ef" roughness={1} />
      </mesh>

      {items.map((it, idx) => {
        const kind = (it.kind || "wall").toLowerCase();
        const thickness = kind === "wall" ? 0.25 : kind === "door" ? 0.18 : 0.12;
        const extrusion = kind === "wall" ? 1.6 : kind === "door" ? 1.2 : 1.2;

        const sx = it.w * scale;
        const sz = it.h * scale;
        const x = (it.cx - width / 2) * scale;
        const z = (it.cy - height / 2) * scale;

        const geomArgs: [number, number, number] = [
          clamp(sx, 0.05, 20),
          extrusion,
          clamp(sz, 0.05, 20),
        ];

        const mat =
          selectedIndex === idx
            ? selectedMat
            : kind === "window"
              ? windowMat
              : kind === "door"
                ? doorMat
                : wallMat;

        return (
          <mesh
            key={idx}
            castShadow
            receiveShadow
            position={[x, baseY + extrusion / 2, z]}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(selectedIndex === idx ? null : idx);
            }}
          >
            <boxGeometry args={geomArgs} />
            <primitive object={mat} attach="material" />
            {/* visual hint for "thickness" via a subtle inset outline */}
            <mesh position={[0, 0, 0]} scale={[1 - thickness * 0.02, 1, 1 - thickness * 0.02]}>
              <boxGeometry args={geomArgs} />
              <meshStandardMaterial color="#000000" transparent opacity={0.02} />
            </mesh>
          </mesh>
        );
      })}
    </>
  );
}

function SceneRoot({
  scene,
  preset,
  showGrid,
  selectedIndex,
  setSelectedIndex,
}: {
  scene: ReturnType<typeof computeScene>;
  preset: CameraPreset;
  showGrid: boolean;
  selectedIndex: number | null;
  setSelectedIndex: (v: number | null) => void;
}) {
  const cameraPos = useMemo(() => {
    if (preset === "top") return new THREE.Vector3(0, 10, 0.01);
    return new THREE.Vector3(7, 6, 7);
  }, [preset]);

  return (
    <>
      <color attach="background" args={["#f6f6f6"]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-6, 4, -8]} intensity={0.35} />

      <Environment preset="city" />

      {showGrid && (
        <Grid
          position={[0, -0.001, 0]}
          infiniteGrid={false}
          cellSize={0.5}
          cellThickness={0.8}
          sectionSize={2}
          sectionThickness={1.4}
          fadeDistance={18}
          fadeStrength={1}
          cellColor="#d1d5db"
          sectionColor="#9ca3af"
        />
      )}

      <group
        onPointerDown={() => {
          setSelectedIndex(null);
        }}
      >
        <SceneMeshes scene={scene} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
      </group>

      <OrbitControls
        makeDefault
        enablePan
        enableRotate={preset !== "top"}
        maxPolarAngle={preset === "top" ? Math.PI / 2 : Math.PI * 0.495}
        minPolarAngle={preset === "top" ? Math.PI / 2 : 0}
        target={[0, 0.7, 0]}
      />

      <perspectiveCamera position={cameraPos.toArray()} fov={45} />
    </>
  );
}

export default function Floorplan3DViewer({ scene: rawScene }: Props) {
  const [preset, setPreset] = useState<CameraPreset>("iso");
  const [showGrid, setShowGrid] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const scene = useMemo(() => computeScene(rawScene), [rawScene]);
  const hasAny = scene.items.length > 0;

  return (
    <div className="relative w-full h-[420px] md:h-[520px]">
      {!hasAny ? (
        <div className="w-full h-full flex items-center justify-center text-sm text-zinc-500">
          Generate a project to see the interactive 3D view.
        </div>
      ) : (
        <>
          <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white/90 backdrop-blur px-2 py-1 shadow-sm">
            <button
              type="button"
              onClick={() => setPreset("iso")}
              className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wide rounded-md transition-colors ${
                preset === "iso" ? "bg-black text-white" : "text-zinc-600 hover:text-black hover:bg-black/5"
              }`}
            >
              Iso
            </button>
            <button
              type="button"
              onClick={() => setPreset("top")}
              className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wide rounded-md transition-colors ${
                preset === "top" ? "bg-black text-white" : "text-zinc-600 hover:text-black hover:bg-black/5"
              }`}
            >
              Top
            </button>
            <button
              type="button"
              onClick={() => setShowGrid((v) => !v)}
              className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wide rounded-md transition-colors ${
                showGrid ? "bg-zinc-100 text-black" : "text-zinc-600 hover:text-black hover:bg-black/5"
              }`}
            >
              Grid
            </button>
          </div>

          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{ position: [7, 6, 7], fov: 45, near: 0.1, far: 100 }}
          >
            <SceneRoot
              scene={scene}
              preset={preset}
              showGrid={showGrid}
              selectedIndex={selectedIndex}
              setSelectedIndex={setSelectedIndex}
            />
          </Canvas>
        </>
      )}
    </div>
  );
}


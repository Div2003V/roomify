import { Canvas } from "@react-three/fiber";
import { Environment, Grid, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { FloorPlanSceneData } from "../lib/ai.action";

type Props = {
  scene?: FloorPlanSceneData;
};

type CameraPreset = "iso" | "top";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

type WallFaceIndex = 0 | 1 | 2 | 3 | 4 | 5;
type WallFaceColorState = Record<number, [string, string, string, string, string, string]>;

const DEFAULT_WALL_FACE_COLORS: [string, string, string, string, string, string] = [
  "#d2d0cb",
  "#d2d0cb",
  "#d2d0cb",
  "#d2d0cb",
  "#d2d0cb",
  "#d2d0cb",
];

const computeScene = (scene?: FloorPlanSceneData) => {
  const points = Array.isArray(scene?.points) ? scene.points ?? [] : [];
  const classes = Array.isArray(scene?.classes) ? scene.classes ?? [] : [];
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
  wallFaceColors,
  onRequestWallFaceColorPick,
}: {
  scene: ReturnType<typeof computeScene>;
  selectedIndex: number | null;
  onSelect: (idx: number | null) => void;
  wallFaceColors: WallFaceColorState;
  onRequestWallFaceColorPick: (args: {
    wallIndex: number;
    faceIndex: WallFaceIndex;
    clientX: number;
    clientY: number;
    currentColor: string;
  }) => void;
}) {
  const { width, height, items } = scene;

  const scale = 10 / Math.max(width, height); // keep consistent world size
  const baseY = 0;

  const wallMatsRef = useRef<Record<number, THREE.MeshStandardMaterial[]>>({});

  useEffect(() => {
    return () => {
      for (const mats of Object.values(wallMatsRef.current) as THREE.MeshStandardMaterial[][]) {
        for (const m of mats) m.dispose();
      }
      wallMatsRef.current = {};
    };
  }, []);

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
  const miscMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#d2d0cb",
        roughness: 0.95,
        metalness: 0.0,
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
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
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

        const isWall = kind === "wall";
        const wallColors = wallFaceColors[idx] ?? DEFAULT_WALL_FACE_COLORS;

        if (isWall && !wallMatsRef.current[idx]) {
          wallMatsRef.current[idx] = wallColors.map(
            (c) =>
              new THREE.MeshStandardMaterial({
                color: c,
                roughness: 0.95,
                metalness: 0.0,
              }),
          );
        }

        if (isWall) {
          const mats = wallMatsRef.current[idx]!;
          for (let i = 0; i < 6; i++) {
            mats[i].color.set(wallColors[i]);
          }
        }

        return (
          <mesh
            key={idx}
            castShadow
            receiveShadow
            position={[x, baseY + extrusion / 2, z]}
            onPointerDown={(e) => {
              if (e.button === 2) return;
              e.stopPropagation();
              onSelect(selectedIndex === idx ? null : idx);
            }}
            onContextMenu={(e) => {
              if (!isWall) return;
              e.stopPropagation();
              e.nativeEvent.preventDefault();

              const mi = e.face?.materialIndex;
              if (typeof mi !== "number") return;
              if (mi < 0 || mi > 5) return;

              onRequestWallFaceColorPick({
                wallIndex: idx,
                faceIndex: mi as WallFaceIndex,
                clientX: e.nativeEvent.clientX,
                clientY: e.nativeEvent.clientY,
                currentColor: wallColors[mi],
              });
            }}
            material={
              isWall
                ? (wallMatsRef.current[idx] as unknown as THREE.Material | THREE.Material[])
                : kind === "window"
                  ? windowMat
                  : kind === "door"
                    ? doorMat
                    : miscMat
            }
          >
            <boxGeometry args={geomArgs} />
            {/* visual hint for "thickness" via a subtle inset outline */}
            <mesh position={[0, 0, 0]} scale={[1 - thickness * 0.02, 1, 1 - thickness * 0.02]}>
              <boxGeometry args={geomArgs} />
              <meshStandardMaterial color="#000000" transparent opacity={0.02} />
            </mesh>

            {selectedIndex === idx && (
              <mesh scale={[1.01, 1.01, 1.01]}>
                <boxGeometry args={geomArgs} />
                <primitive object={selectedMat} attach="material" />
              </mesh>
            )}
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
  wallFaceColors,
  onRequestWallFaceColorPick,
  onClearOverlays,
}: {
  scene: ReturnType<typeof computeScene>;
  preset: CameraPreset;
  showGrid: boolean;
  selectedIndex: number | null;
  setSelectedIndex: (v: number | null) => void;
  wallFaceColors: WallFaceColorState;
  onRequestWallFaceColorPick: (args: {
    wallIndex: number;
    faceIndex: WallFaceIndex;
    clientX: number;
    clientY: number;
    currentColor: string;
  }) => void;
  onClearOverlays: () => void;
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
          onClearOverlays();
        }}
      >
        <SceneMeshes
          scene={scene}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          wallFaceColors={wallFaceColors}
          onRequestWallFaceColorPick={onRequestWallFaceColorPick}
        />
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
  const [wallFaceColors, setWallFaceColors] = useState<WallFaceColorState>({});
  const [colorPicker, setColorPicker] = useState<
    | null
    | {
        wallIndex: number;
        faceIndex: WallFaceIndex;
        x: number;
        y: number;
        color: string;
      }
  >(null);

  const rootRef = useRef<HTMLDivElement | null>(null);

  const scene = useMemo(() => computeScene(rawScene), [rawScene]);
  const hasAny = scene.items.length > 0;

  return (
    <div
      ref={rootRef}
      className="relative w-full h-[420px] md:h-[520px]"
      onContextMenu={(e) => {
        // prevent the browser menu so right-click is usable for coloring
        e.preventDefault();
      }}
    >
      {!hasAny ? (
        <div className="w-full h-full flex items-center justify-center text-sm text-zinc-500">
          Generate a project to see the interactive 3D view.
        </div>
      ) : (
        <>
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
              wallFaceColors={wallFaceColors}
              onRequestWallFaceColorPick={({ wallIndex, faceIndex, clientX, clientY, currentColor }) => {
                const rect = rootRef.current?.getBoundingClientRect();
                const x = rect ? clientX - rect.left : clientX;
                const y = rect ? clientY - rect.top : clientY;
                setColorPicker({ wallIndex, faceIndex, x, y, color: currentColor });
              }}
              onClearOverlays={() => setColorPicker(null)}
            />
          </Canvas>

          {colorPicker && (
            <div
              className="absolute z-20"
              style={{
                left: Math.max(8, Math.min(colorPicker.x, (rootRef.current?.clientWidth ?? 0) - 56)),
                top: Math.max(8, Math.min(colorPicker.y, (rootRef.current?.clientHeight ?? 0) - 40)),
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                type="color"
                value={colorPicker.color}
                onChange={(e) => {
                  const next = e.target.value;
                  setColorPicker((p) => (p ? { ...p, color: next } : p));
                  setWallFaceColors((prev) => {
                    const existing = prev[colorPicker.wallIndex] ?? DEFAULT_WALL_FACE_COLORS;
                    const updated: [string, string, string, string, string, string] = [...existing] as any;
                    updated[colorPicker.faceIndex] = next;
                    return { ...prev, [colorPicker.wallIndex]: updated };
                  });
                }}
                onBlur={() => setColorPicker(null)}
                className="h-9 w-12 cursor-pointer rounded-md border border-zinc-200 bg-white shadow"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}


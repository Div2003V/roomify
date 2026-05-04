import {FLOORPLAN_TO_3D_API_URL, IMAGE_RENDER_DIMENSION} from "./constants";
import {fetchBlobFromUrl} from "./utils";

type FloorPlanTo3DBox = { x1: number; y1: number; x2: number; y2: number };
type FloorPlanTo3DClass = { name: "wall" | "window" | "door" | string };
export type FloorPlanSceneData = {
  points?: FloorPlanTo3DBox[];
  classes?: FloorPlanTo3DClass[];
  Width?: number;
  Height?: number;
  averageDoor?: number;
};

export const fetchAsDataUrl = async (url: string): Promise<string> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generate3DView = async ({ sourceImage }: Generate3DViewParams) => {
    if (!FLOORPLAN_TO_3D_API_URL) {
        throw new Error("Missing VITE_FLOORPLAN_TO_3D_API_URL");
    }

    const fetched = await fetchBlobFromUrl(sourceImage);
    if (!fetched?.blob) throw new Error("Failed to load source image");

    const contentType = fetched.contentType || fetched.blob.type || "image/png";
    const file = new File([fetched.blob], "floorplan.png", { type: contentType });

    const form = new FormData();
    form.append("image", file);

    const resp = await fetch(FLOORPLAN_TO_3D_API_URL, {
        method: "POST",
        body: form,
    });

    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`FloorPlanTo3D API failed: ${resp.status} ${text}`);
    }

    const scene = (await resp.json()) as FloorPlanSceneData;
    const renderedImage = await renderFloorPlan3DPreview(scene);

    return { renderedImage, renderedPath: undefined, scene };
}

const renderFloorPlan3DPreview = async (api: FloorPlanSceneData): Promise<string | null> => {
    if (typeof window === "undefined") return null;

    const points = Array.isArray(api.points) ? api.points : [];
    const classes = Array.isArray(api.classes) ? api.classes : [];
    const srcW = typeof api.Width === "number" && api.Width > 0 ? api.Width : 1024;
    const srcH = typeof api.Height === "number" && api.Height > 0 ? api.Height : 1024;

    const size = IMAGE_RENDER_DIMENSION;
    const sx = size / srcW;
    const sy = size / srcH;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // base "floor"
    ctx.fillStyle = "#f5f3ef";
    ctx.fillRect(0, 0, size, size);

    // subtle grid/noise feel
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#000";
    for (let y = 0; y < size; y += 24) ctx.fillRect(0, y, size, 1);
    for (let x = 0; x < size; x += 24) ctx.fillRect(x, 0, 1, size);
    ctx.globalAlpha = 1;

    // pseudo-extrusion parameters
    const lift = 10;
    const shadow = 6;

    const drawExtrudedRect = (x: number, y: number, w: number, h: number, top: string, side: string) => {
        // shadow
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(x + shadow, y + shadow, w, h);

        // side (down-right)
        ctx.fillStyle = side;
        ctx.beginPath();
        ctx.moveTo(x + w, y);
        ctx.lineTo(x + w + lift, y + lift);
        ctx.lineTo(x + w + lift, y + h + lift);
        ctx.lineTo(x + w, y + h);
        ctx.closePath();
        ctx.fill();

        // top (up-left)
        ctx.fillStyle = top;
        ctx.fillRect(x, y, w, h);

        // edge highlight
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    };

    // draw order: walls first, then windows/doors
    const items = points.map((p, i) => ({ p, c: classes[i]?.name || "wall" }));
    const order = (name: string) => (name === "wall" ? 0 : name === "window" ? 1 : 2);
    items.sort((a, b) => order(a.c) - order(b.c));

    for (const { p, c } of items) {
        const x1 = Math.min(p.x1, p.x2) * sx;
        const y1 = Math.min(p.y1, p.y2) * sy;
        const x2 = Math.max(p.x1, p.x2) * sx;
        const y2 = Math.max(p.y1, p.y2) * sy;
        const w = Math.max(1, x2 - x1);
        const h = Math.max(1, y2 - y1);

        if (c === "wall") {
            drawExtrudedRect(x1, y1, w, h, "#c9c7c2", "#9a9893");
        } else if (c === "window") {
            ctx.globalAlpha = 0.9;
            drawExtrudedRect(x1, y1, w, h, "rgba(140,200,255,0.55)", "rgba(70,130,180,0.55)");
            ctx.globalAlpha = 1;
        } else if (c === "door") {
            drawExtrudedRect(x1, y1, w, h, "#b88a5a", "#8a623b");
        } else {
            // unknown class: draw lightly
            ctx.globalAlpha = 0.6;
            drawExtrudedRect(x1, y1, w, h, "#d6d4cf", "#a9a7a2");
            ctx.globalAlpha = 1;
        }
    }

    return canvas.toDataURL("image/png");
};

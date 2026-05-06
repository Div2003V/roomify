
export const FLOORPLAN_TO_3D_API_URL =
    import.meta.env.VITE_FLOORPLAN_TO_3D_API_URL || "";


export const STORAGE_PATHS = {
    ROOT: "roomify",
    SOURCES: "roomify/sources",
    RENDERS: "roomify/renders",
} as const;


export const SHARE_STATUS_RESET_DELAY_MS = 1500;
export const PROGRESS_INCREMENT = 15;
export const REDIRECT_DELAY_MS = 600;
export const PROGRESS_INTERVAL_MS = 100;
export const PROGRESS_STEP = 5;


export const GRID_OVERLAY_SIZE = "60px 60px";
export const GRID_COLOR = "#3B82F6";


export const UNAUTHORIZED_STATUSES = [401, 403];


export const IMAGE_RENDER_DIMENSION = 1024;

const STORAGE_KEY = "roomify_projects_v1";

type StoredProjects = Record<string, DesignItem>;

const safeParse = (raw: string | null): StoredProjects => {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object") return {};
        return parsed as StoredProjects;
    } catch {
        return {};
    }
};

const readAll = (): StoredProjects => {
    if (typeof window === "undefined") return {};
    return safeParse(window.localStorage.getItem(STORAGE_KEY));
};

const writeAll = (projects: StoredProjects) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
};

export const listProjects = async (): Promise<DesignItem[]> => {
    const all = readAll();
    return Object.values(all).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
};

export const saveProject = async (item: DesignItem): Promise<DesignItem> => {
    const all = readAll();
    all[item.id] = item;
    writeAll(all);
    return item;
};

export const getProject = async ({ id }: { id: string }): Promise<DesignItem | null> => {
    const all = readAll();
    return all[id] ?? null;
};


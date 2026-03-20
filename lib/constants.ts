export const MODEL = "claude-sonnet-4-20250514";
export const MAX_TOKENS = 4096;
export const MAX_FILE_SIZE_MB = 500;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const DEFAULT_FRAME_COUNT = 6;
export const MIN_FRAME_COUNT = 3;
export const MAX_FRAME_COUNT = 12;
export const MAX_FRAME_BASE64_BYTES = 4 * 1024 * 1024; // 4MB per frame

export const RESOLUTION_MAP = {
  "720p": 1280,
  "1080p": 1920,
  "4K": 3840,
} as const;

export type Resolution = keyof typeof RESOLUTION_MAP;
export const DEFAULT_RESOLUTION: Resolution = "720p";

// Room scale
export const ROOM_SCALES = ["small", "medium", "large"] as const;
export type RoomScale = (typeof ROOM_SCALES)[number];
export const DEFAULT_ROOM_SCALE: RoomScale = "medium";

// Detail level
export const DETAIL_LEVELS = ["walls", "openings", "full"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];
export const DEFAULT_DETAIL_LEVEL: DetailLevel = "openings";

// Blender version
export const BLENDER_VERSIONS = [3, 4] as const;
export type BlenderVersion = (typeof BLENDER_VERSIONS)[number];
export const DEFAULT_BLENDER_VERSION: BlenderVersion = 4;

const BASE_SYSTEM_PROMPT = `You are an expert in 3D modeling and Blender Python scripting (bpy).
Analyze the provided architectural video frames and produce a complete, runnable Blender Python script.

Rules:
- Use only bpy primitives: planes, cubes, cylinders
- Floors = flat scaled planes, walls = tall scaled cubes, ceilings = flat planes
- Position all objects at correct world coordinates
- Call bpy.ops.object.transform_apply after scaling
- Add a camera aimed at the scene center
- Add a sun lamp for basic lighting
- Add clear comments explaining each section
- Output ONLY the Python script — no explanation, no markdown fences`;

const ROOM_SCALE_HINTS: Record<RoomScale, string> = {
  small: "This is a small room (bathroom, closet, utility room). Typical dimensions: 2-3m × 2-3m, ceiling 2.4m.",
  medium: "This is a medium room (office, bedroom, kitchen). Typical dimensions: 3-5m × 3-5m, ceiling 2.5-2.7m.",
  large: "This is a large room (open plan, warehouse, conference hall). Typical dimensions: 6-15m × 6-15m, ceiling 3-4m.",
};

const DETAIL_LEVEL_HINTS: Record<DetailLevel, string> = {
  walls: "Focus only on walls, floor, and ceiling. Do not add doors, windows, or other openings.",
  openings: "Include walls, floor, ceiling, plus visible doors and windows as cutouts or inset planes.",
  full: "Include all visible structural elements: walls, floor, ceiling, doors, windows, columns, stairs, and any other major features.",
};

const BLENDER_VERSION_HINTS: Record<BlenderVersion, string> = {
  3: "Generate script compatible with Blender 3.x (Python bpy API).",
  4: "Generate script compatible with Blender 4.x (Python bpy API). Use updated API calls where the API changed between 3.x and 4.x.",
};

export function buildSystemPrompt(
  roomScale: RoomScale,
  detailLevel: DetailLevel,
  blenderVersion: BlenderVersion
): string {
  return `${BASE_SYSTEM_PROMPT}
- ${ROOM_SCALE_HINTS[roomScale]}
- ${DETAIL_LEVEL_HINTS[detailLevel]}
- ${BLENDER_VERSION_HINTS[blenderVersion]}`;
}

const DETAIL_STRUCTURE_TEXT: Record<DetailLevel, string> = {
  walls: "walls, floor, and ceiling",
  openings: "walls, floor, ceiling, doors, and windows",
  full: "walls, floor, ceiling, doors, windows, and major structural elements",
};

export function buildUserPrompt(n: number, detailLevel: DetailLevel): string {
  return `Analyze these ${n} frames from an architectural walkthrough video.
Identify the room structure: ${DETAIL_STRUCTURE_TEXT[detailLevel]}.
Produce a complete Blender bpy Python script that reconstructs this space using basic mesh primitives with estimated real-world dimensions.`;
}

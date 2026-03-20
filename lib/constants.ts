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

export const SYSTEM_PROMPT = `You are an expert in 3D modeling and Blender Python scripting (bpy).
Analyze the provided architectural video frames and produce a complete, runnable Blender Python script.

Rules:
- Use only bpy primitives: planes, cubes, cylinders
- Floors = flat scaled planes, walls = tall scaled cubes, ceilings = flat planes
- Estimate real-world dimensions from visual cues (doorways ~2m tall, standard ceilings ~2.5–3m)
- Position all objects at correct world coordinates
- Call bpy.ops.object.transform_apply after scaling
- Add a camera aimed at the scene center
- Add a sun lamp for basic lighting
- Add clear comments explaining each section
- Output ONLY the Python script — no explanation, no markdown fences`;

export const USER_PROMPT_TEMPLATE = (n: number) =>
  `Analyze these ${n} frames from an architectural walkthrough video.
Identify the room structure: walls, floor, ceiling, doors, windows, and major structural elements.
Produce a complete Blender bpy Python script that reconstructs this space using basic mesh primitives with estimated real-world dimensions.`;

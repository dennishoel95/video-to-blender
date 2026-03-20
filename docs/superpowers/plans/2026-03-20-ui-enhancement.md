# UI Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 3D wireframe room hero, tighter layout, three new generation parameters (room scale, detail level, Blender version), and mobile optimization.

**Architecture:** Adds React Three Fiber for a decorative 3D hero element with cursor-tracking tilt. Extends the existing constants/API/UI pipeline to support three new prompt-influencing parameters. Container narrows from max-w-2xl to max-w-lg for a focused tool aesthetic.

**Tech Stack:** React Three Fiber, @react-three/drei, three.js, Next.js 16 dynamic imports

**Spec:** `docs/superpowers/specs/2026-03-20-ui-enhancement-design.md`

**IMPORTANT (Next.js 16):** This project uses Next.js 16.2.0 with Tailwind CSS v4. Tailwind v4 uses `@import "tailwindcss"` and `@theme inline` syntax. Check `node_modules/next/dist/docs/` if unsure about any Next.js API.

---

### Task 1: Install React Three Fiber Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd "/Users/dennishoel/Documents/Claude Dennis/Company directory/Development company/video-to-blender"
npm install three @react-three/fiber @react-three/drei
npm install -D @types/three
```

- [ ] **Step 2: Verify installation**

```bash
npx tsc --noEmit
```

Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add React Three Fiber, drei, and three.js"
```

---

### Task 2: Update Constants — New Types & Dynamic Prompts

**Files:**
- Modify: `lib/constants.ts`

- [ ] **Step 1: Add new types and constants**

Add after the existing `DEFAULT_RESOLUTION` line (line 17) and before the `SYSTEM_PROMPT`:

```ts
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
```

- [ ] **Step 2: Replace static SYSTEM_PROMPT with buildSystemPrompt()**

Remove the existing `export const SYSTEM_PROMPT = ...` block (lines 19-31) and `export const USER_PROMPT_TEMPLATE = ...` block (lines 33-36). Replace with:

```ts
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
```

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: type error in `app/api/generate/route.ts` because it still imports `SYSTEM_PROMPT` and `USER_PROMPT_TEMPLATE` which no longer exist. This is expected — Task 4 will fix it.

- [ ] **Step 4: Commit**

```bash
git add lib/constants.ts
git commit -m "feat: add room scale, detail level, Blender version types and dynamic prompts"
```

---

### Task 3: Create WireframeRoom Component

**Files:**
- Create: `components/WireframeRoom.tsx`

- [ ] **Step 1: Create the WireframeRoom component**

```tsx
"use client";

import { useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";

function Room() {
  const groupRef = useRef<THREE.Group>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const isTouchDevice = useRef(false);

  useEffect(() => {
    isTouchDevice.current = "ontouchstart" in window;
    if (isTouchDevice.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Normalize to -1..1 range relative to viewport
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const maxTilt = 0.14; // ~8 degrees in radians
    const lerpSpeed = 3;

    // Target rotation based on mouse position
    const targetX = isTouchDevice.current ? 0 : -mouseRef.current.y * maxTilt;
    const targetY = isTouchDevice.current ? 0 : mouseRef.current.x * maxTilt;

    // Lerp toward target
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetX + 0.2, // base tilt for perspective
      delta * lerpSpeed
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetY - 0.35, // base rotation for 3/4 view
      delta * lerpSpeed
    );

    // Subtle idle bob
    groupRef.current.position.y = Math.sin(Date.now() * 0.001) * 0.02;
  });

  // Room dimensions (normalized units)
  const w = 1.6; // width
  const h = 1.0; // height
  const d = 1.2; // depth

  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;

  // Floor corners
  const floorBL: [number, number, number] = [-hw, -hh, hd];
  const floorBR: [number, number, number] = [hw, -hh, hd];
  const floorTL: [number, number, number] = [-hw, -hh, -hd];
  const floorTR: [number, number, number] = [hw, -hh, -hd];

  // Ceiling corners
  const ceilBL: [number, number, number] = [-hw, hh, hd];
  const ceilBR: [number, number, number] = [hw, hh, hd];
  const ceilTL: [number, number, number] = [-hw, hh, -hd];
  const ceilTR: [number, number, number] = [hw, hh, -hd];

  // Door opening on back wall (centered, bottom half)
  const doorW = 0.3;
  const doorH = 0.6;
  const doorLeft = -doorW / 2;
  const doorRight = doorW / 2;
  const doorTop = -hh + doorH;

  const indigo = "#818cf8";
  const indigoFaint = "#6366f1";

  return (
    <group ref={groupRef}>
      {/* Floor */}
      <Line
        points={[floorBL, floorBR, floorTR, floorTL, floorBL]}
        color={indigoFaint}
        lineWidth={1.5}
        opacity={0.3}
        transparent
      />

      {/* Ceiling */}
      <Line
        points={[ceilBL, ceilBR, ceilTR, ceilTL, ceilBL]}
        color={indigoFaint}
        lineWidth={1}
        opacity={0.15}
        transparent
      />

      {/* Vertical edges */}
      <Line points={[floorBL, ceilBL]} color={indigoFaint} lineWidth={1.5} opacity={0.25} transparent />
      <Line points={[floorBR, ceilBR]} color={indigoFaint} lineWidth={1.5} opacity={0.15} transparent />
      <Line points={[floorTL, ceilTL]} color={indigoFaint} lineWidth={1.5} opacity={0.4} transparent />
      <Line points={[floorTR, ceilTR]} color={indigoFaint} lineWidth={1.5} opacity={0.35} transparent />

      {/* Back wall with door opening */}
      <Line
        points={[floorTL, floorTR]}
        color={indigo}
        lineWidth={1.5}
        opacity={0.5}
        transparent
      />
      <Line
        points={[ceilTL, ceilTR]}
        color={indigo}
        lineWidth={1}
        opacity={0.3}
        transparent
      />

      {/* Door frame on back wall */}
      <Line
        points={[
          [doorLeft, -hh, -hd],
          [doorLeft, doorTop, -hd],
          [doorRight, doorTop, -hd],
          [doorRight, -hh, -hd],
        ]}
        color={indigo}
        lineWidth={1}
        opacity={0.25}
        transparent
      />

      {/* Semi-transparent back wall face */}
      <mesh position={[0, 0, -hd]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#6366f1" transparent opacity={0.03} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function WireframeRoom() {
  return (
    <div className="w-[80px] h-[65px] sm:w-[90px] sm:h-[75px] flex-shrink-0">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 35 }}
        style={{ background: "transparent" }}
        gl={{ alpha: true, antialias: true }}
      >
        <Room />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: may still have the route.ts error from Task 2 — ignore that. No new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add components/WireframeRoom.tsx
git commit -m "feat: add WireframeRoom component with cursor-tracking tilt"
```

---

### Task 4: Update API Route — New Parameters

**Files:**
- Modify: `app/api/generate/route.ts`

- [ ] **Step 1: Update imports and add validation**

Replace the entire content of `app/api/generate/route.ts` with:

```ts
import Anthropic from "@anthropic-ai/sdk";
import {
  MODEL,
  MAX_TOKENS,
  buildSystemPrompt,
  buildUserPrompt,
  ROOM_SCALES,
  DETAIL_LEVELS,
  BLENDER_VERSIONS,
  DEFAULT_ROOM_SCALE,
  DEFAULT_DETAIL_LEVEL,
  DEFAULT_BLENDER_VERSION,
  type RoomScale,
  type DetailLevel,
  type BlenderVersion,
} from "@/lib/constants";

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      frames: string[];
      roomScale?: unknown;
      detailLevel?: unknown;
      blenderVersion?: unknown;
    };

    const { frames } = body;

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return new Response("No frames provided", { status: 400 });
    }

    // Server-side payload size check (~20MB limit)
    const totalSize = frames.reduce((sum, f) => sum + f.length, 0);
    if (totalSize > 20 * 1024 * 1024) {
      return new Response("Payload too large. Reduce frame count or resolution.", { status: 413 });
    }

    // Validate new params with fallback to defaults
    const roomScale: RoomScale =
      typeof body.roomScale === "string" && (ROOM_SCALES as readonly string[]).includes(body.roomScale)
        ? (body.roomScale as RoomScale)
        : DEFAULT_ROOM_SCALE;

    const detailLevel: DetailLevel =
      typeof body.detailLevel === "string" && (DETAIL_LEVELS as readonly string[]).includes(body.detailLevel)
        ? (body.detailLevel as DetailLevel)
        : DEFAULT_DETAIL_LEVEL;

    const blenderVersion: BlenderVersion =
      typeof body.blenderVersion === "number" &&
      Number.isInteger(body.blenderVersion) &&
      (BLENDER_VERSIONS as readonly number[]).includes(body.blenderVersion)
        ? (body.blenderVersion as BlenderVersion)
        : DEFAULT_BLENDER_VERSION;

    // Build image content blocks
    const imageBlocks: Anthropic.Messages.ImageBlockParam[] = frames.map((base64) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: base64,
      },
    }));

    const userContent: Anthropic.Messages.ContentBlockParam[] = [
      ...imageBlocks,
      { type: "text", text: buildUserPrompt(frames.length, detailLevel) },
    ];

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(roomScale, detailLevel, blenderVersion),
      messages: [{ role: "user", content: userContent }],
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(
                new TextEncoder().encode(event.delta.text)
              );
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("Generate API error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: zero type errors now (the old SYSTEM_PROMPT/USER_PROMPT_TEMPLATE imports are gone).

- [ ] **Step 3: Commit**

```bash
git add app/api/generate/route.ts
git commit -m "feat: accept room scale, detail level, and Blender version in API route"
```

---

### Task 5: Update SettingsBar — New Parameter Controls

**Files:**
- Modify: `components/SettingsBar.tsx`

- [ ] **Step 1: Replace SettingsBar with expanded version**

Replace the entire content of `components/SettingsBar.tsx` with:

```tsx
"use client";

import {
  MIN_FRAME_COUNT,
  MAX_FRAME_COUNT,
  RESOLUTION_MAP,
  ROOM_SCALES,
  DETAIL_LEVELS,
  BLENDER_VERSIONS,
  type Resolution,
  type RoomScale,
  type DetailLevel,
  type BlenderVersion,
} from "@/lib/constants";

interface Props {
  frameCount: number;
  resolution: Resolution;
  roomScale: RoomScale;
  detailLevel: DetailLevel;
  blenderVersion: BlenderVersion;
  onFrameCountChange: (count: number) => void;
  onResolutionChange: (res: Resolution) => void;
  onRoomScaleChange: (scale: RoomScale) => void;
  onDetailLevelChange: (level: DetailLevel) => void;
  onBlenderVersionChange: (version: BlenderVersion) => void;
}

const ROOM_SCALE_LABELS: Record<RoomScale, { full: string; short: string }> = {
  small: { full: "Small", short: "S" },
  medium: { full: "Medium", short: "M" },
  large: { full: "Large", short: "L" },
};

const DETAIL_LEVEL_LABELS: Record<DetailLevel, { full: string; short: string }> = {
  walls: { full: "Walls", short: "Walls" },
  openings: { full: "+ Openings", short: "+ Open" },
  full: { full: "Full", short: "Full" },
};

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  renderLabel,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  renderLabel: (v: T) => React.ReactNode;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-zinc-800 p-0.5">
      {options.map((opt) => (
        <button
          key={String(opt)}
          onClick={() => onChange(opt)}
          className={`
            flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors text-center
            ${value === opt
              ? "bg-indigo-500 text-white"
              : "text-zinc-400 hover:text-zinc-200"
            }
          `}
        >
          {renderLabel(opt)}
        </button>
      ))}
    </div>
  );
}

export function SettingsBar({
  frameCount,
  resolution,
  roomScale,
  detailLevel,
  blenderVersion,
  onFrameCountChange,
  onResolutionChange,
  onRoomScaleChange,
  onDetailLevelChange,
  onBlenderVersionChange,
}: Props) {
  const resolutions = Object.keys(RESOLUTION_MAP) as Resolution[];

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Frame count + Resolution */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-zinc-400 text-sm mb-1 block">
            Frames: {frameCount}
          </label>
          <input
            type="range"
            min={MIN_FRAME_COUNT}
            max={MAX_FRAME_COUNT}
            step={1}
            value={frameCount}
            onChange={(e) => onFrameCountChange(parseInt(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </div>
        <SegmentedControl
          options={resolutions}
          value={resolution}
          onChange={onResolutionChange}
          renderLabel={(r) => r}
        />
      </div>

      {/* Row 2: Room Scale + Detail Level */}
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Room Scale</div>
          <SegmentedControl
            options={ROOM_SCALES}
            value={roomScale}
            onChange={onRoomScaleChange}
            renderLabel={(s) => (
              <>
                <span className="hidden sm:inline">{ROOM_SCALE_LABELS[s].full}</span>
                <span className="sm:hidden">{ROOM_SCALE_LABELS[s].short}</span>
              </>
            )}
          />
        </div>
        <div className="flex-1">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Detail</div>
          <SegmentedControl
            options={DETAIL_LEVELS}
            value={detailLevel}
            onChange={onDetailLevelChange}
            renderLabel={(d) => (
              <>
                <span className="hidden sm:inline">{DETAIL_LEVEL_LABELS[d].full}</span>
                <span className="sm:hidden">{DETAIL_LEVEL_LABELS[d].short}</span>
              </>
            )}
          />
        </div>
      </div>

      {/* Row 3: Blender Version */}
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Blender</div>
        <div className="inline-flex">
          <SegmentedControl
            options={BLENDER_VERSIONS}
            value={blenderVersion}
            onChange={onBlenderVersionChange}
            renderLabel={(v) => `${v}.x`}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: type error in `app/page.tsx` because it doesn't pass the new props yet. This is expected — Task 6 will fix it.

- [ ] **Step 3: Commit**

```bash
git add components/SettingsBar.tsx
git commit -m "feat: add room scale, detail level, and Blender version controls to SettingsBar"
```

---

### Task 6: Update Main Page — Hero Layout, Container, New State

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace page.tsx with updated version**

Replace the entire content of `app/page.tsx` with:

```tsx
"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { VideoUploader } from "@/components/VideoUploader";
import { SettingsBar } from "@/components/SettingsBar";
import { FramePreview } from "@/components/FramePreview";
import { ScriptOutput } from "@/components/ScriptOutput";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { extractFrames } from "@/lib/extractFrames";
import { stripFences } from "@/lib/stripFences";
import {
  DEFAULT_FRAME_COUNT,
  DEFAULT_RESOLUTION,
  DEFAULT_ROOM_SCALE,
  DEFAULT_DETAIL_LEVEL,
  DEFAULT_BLENDER_VERSION,
  RESOLUTION_MAP,
  type Resolution,
  type RoomScale,
  type DetailLevel,
  type BlenderVersion,
} from "@/lib/constants";

const WireframeRoom = dynamic(
  () => import("@/components/WireframeRoom").then((mod) => mod.WireframeRoom),
  { ssr: false }
);

type AppState =
  | { step: "upload"; file: File | null }
  | { step: "extracting"; file: File; progress: string; frames: string[] }
  | { step: "generating"; frames: string[]; script: string }
  | { step: "done"; frames: string[]; script: string }
  | { step: "error"; frames: string[]; script: string; error: string };

export default function Home() {
  const [state, setState] = useState<AppState>({ step: "upload", file: null });
  const [frameCount, setFrameCount] = useState(DEFAULT_FRAME_COUNT);
  const [resolution, setResolution] = useState<Resolution>(DEFAULT_RESOLUTION);
  const [roomScale, setRoomScale] = useState<RoomScale>(DEFAULT_ROOM_SCALE);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(DEFAULT_DETAIL_LEVEL);
  const [blenderVersion, setBlenderVersion] = useState<BlenderVersion>(DEFAULT_BLENDER_VERSION);

  const reset = useCallback(() => {
    setState({ step: "upload", file: null });
  }, []);

  const generateScript = useCallback(async (frames: string[]) => {
    setState({ step: "generating", frames, script: "" });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, roomScale, detailLevel, blenderVersion }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let script = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        script += decoder.decode(value, { stream: true });
        setState((prev) => {
          if (prev.step === "generating" || prev.step === "done") {
            return { step: "generating", frames: prev.frames, script: stripFences(script) };
          }
          return prev;
        });
      }

      setState({ step: "done", frames, script: stripFences(script) });
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setState((prev) => ({
        step: "error",
        frames,
        script: "script" in prev ? prev.script : "",
        error: message,
      }));
    }
  }, [roomScale, detailLevel, blenderVersion]);

  const handleGenerate = useCallback(async () => {
    if (state.step !== "upload" || !state.file) return;

    const file = state.file;
    setState({ step: "extracting", file, progress: "Starting...", frames: [] });

    try {
      const frames = await extractFrames(
        file,
        frameCount,
        RESOLUTION_MAP[resolution],
        (progress) => {
          setState((prev) => {
            if (prev.step === "extracting") {
              return { ...prev, progress };
            }
            return prev;
          });
        }
      );

      setState({ step: "extracting", file, progress: "Sending to AI...", frames });

      await generateScript(frames);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Frame extraction failed";
      setState({ step: "error", frames: [], script: "", error: message });
    }
  }, [state, frameCount, resolution, generateScript]);

  const handleRetry = useCallback(() => {
    if (state.step === "error" && state.frames.length > 0) {
      generateScript(state.frames);
    }
  }, [state, generateScript]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <ThemeToggle />
      <div className="w-full max-w-lg space-y-6">
        {/* Hero: 3D room + title */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-6">
          <WireframeRoom />
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight">
              VIDEO → BLENDER
            </h1>
            <p className="text-zinc-600 dark:text-zinc-500 text-sm mt-1">
              Walkthrough video in, Blender scene out. Seconds.
            </p>
          </div>
        </div>

        {/* Upload state */}
        {state.step === "upload" && (
          <>
            <VideoUploader
              onFileSelect={(file) => setState({ step: "upload", file })}
              disabled={false}
            />

            {state.file && (
              <div className="text-sm text-zinc-400">
                Selected: {state.file.name} ({(state.file.size / 1024 / 1024).toFixed(1)}MB)
              </div>
            )}

            <SettingsBar
              frameCount={frameCount}
              resolution={resolution}
              roomScale={roomScale}
              detailLevel={detailLevel}
              blenderVersion={blenderVersion}
              onFrameCountChange={setFrameCount}
              onResolutionChange={setResolution}
              onRoomScaleChange={setRoomScale}
              onDetailLevelChange={setDetailLevel}
              onBlenderVersionChange={setBlenderVersion}
            />

            {state.file && (
              <button
                onClick={handleGenerate}
                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold transition-colors"
              >
                Generate Blender Script
              </button>
            )}
          </>
        )}

        {/* Extracting state */}
        {state.step === "extracting" && (
          <>
            <div className="text-sm text-zinc-400">{state.progress}</div>
            <FramePreview frames={state.frames} totalCount={frameCount} />
          </>
        )}

        {/* Generating / Done state */}
        {(state.step === "generating" || state.step === "done") && (
          <>
            <FramePreview frames={state.frames} totalCount={state.frames.length} />
            <ScriptOutput
              script={state.script}
              isStreaming={state.step === "generating"}
              onReset={reset}
            />
          </>
        )}

        {/* Error state */}
        {state.step === "error" && (
          <>
            {state.frames.length > 0 && (
              <FramePreview frames={state.frames} totalCount={state.frames.length} />
            )}
            {state.script && (
              <ScriptOutput script={state.script} isStreaming={false} onReset={reset} />
            )}
            <ErrorBanner
              message={state.error}
              onRetry={handleRetry}
              onReset={reset}
            />
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: zero type errors.

- [ ] **Step 3: Run dev server and verify**

```bash
npm run dev
```

Open http://localhost:3000. Verify:
- 3D wireframe room appears left of title on desktop
- Room tilts subtly when moving cursor
- Title says "VIDEO → BLENDER" with new subtitle
- Container is narrower
- Settings bar shows all 5 controls (frames, resolution, room scale, detail, Blender version)
- On narrow viewport: hero stacks vertically, labels abbreviate

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: integrate hero layout, new params, and narrower container"
```

---

### Task 7: Build Verification & Push

**Files:**
- Possibly modify: any file needing fixes

- [ ] **Step 1: Full build check**

```bash
npx next build
```

Expected: clean build, no errors.

- [ ] **Step 2: Fix any issues found**

Address any build errors, runtime errors, or styling issues.

- [ ] **Step 3: Push to GitHub**

```bash
git push
```

- [ ] **Step 4: Final commit if any fixes were made**

```bash
git add -A
git commit -m "fix: address issues found during build verification"
git push
```

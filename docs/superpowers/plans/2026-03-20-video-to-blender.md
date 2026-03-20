# Video → Blender Script Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js app that extracts frames from architectural video, sends them to Claude Vision API, and returns a streaming Blender Python script.

**Architecture:** Single-page app with three UI states (upload/processing/result), client-side ffmpeg.wasm frame extraction, and a single streaming API route that calls Claude. No database, no auth — pure stateless.

**Tech Stack:** Next.js 14+ (App Router), Tailwind CSS, @ffmpeg/ffmpeg (WASM), @anthropic-ai/sdk, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-20-video-to-blender-design.md`

**Future note:** v2 should migrate from native Anthropic SDK streaming to Vercel AI SDK (`@ai-sdk/anthropic` + `streamText`) for token usage tracking needed for auth + billing.

---

### Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `next.config.js`
- Create: `lib/constants.ts`
- Create: `.env.local`, `.gitignore`

- [ ] **Step 1: Create Next.js project**

```bash
cd "/Users/dennishoel/Documents/Claude Dennis/Company directory/Development company/video-to-blender"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

Select defaults when prompted. This creates the base Next.js project with TypeScript and Tailwind.

- [ ] **Step 2: Install dependencies**

```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util @ffmpeg/core @anthropic-ai/sdk
```

- [ ] **Step 3: Configure next.config.js with COOP/COEP headers**

Replace the generated `next.config.ts` (or `.js`) with:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

- [ ] **Step 4: Create constants file**

Create `lib/constants.ts`:

```ts
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
```

- [ ] **Step 5: Create .env.local**

```env
ANTHROPIC_API_KEY=your_key_here
```

- [ ] **Step 6: Update .gitignore**

Append to the generated `.gitignore`:

```
.env.local
.superpowers/
```

- [ ] **Step 7: Copy ffmpeg.wasm files to public/**

```bash
mkdir -p public/ffmpeg
cp node_modules/@ffmpeg/ffmpeg/dist/umd/* public/ffmpeg/ 2>/dev/null || true
cp node_modules/@ffmpeg/core/dist/umd/* public/ffmpeg/ 2>/dev/null || true
```

Note: The exact paths may vary by version. Check `node_modules/@ffmpeg/ffmpeg/dist/` and `node_modules/@ffmpeg/core/dist/` for the actual file locations. The key files needed are `ffmpeg-core.js`, `ffmpeg-core.wasm`, and `ffmpeg-core.worker.js`.

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Open `http://localhost:3000` — should see default Next.js page. Check browser console for no COOP/COEP errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with ffmpeg.wasm and Anthropic SDK"
```

---

### Task 2: Utility — Markdown Fence Stripping

**Files:**
- Create: `lib/stripFences.ts`

- [ ] **Step 1: Create stripFences utility**

```ts
/**
 * Strips markdown code fences from Claude output.
 * Handles ```python, ```, and leading/trailing whitespace.
 */
export function stripFences(text: string): string {
  return text
    .replace(/^```(?:python|py)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/stripFences.ts
git commit -m "feat: add markdown fence stripping utility"
```

---

### Task 3: Frame Extraction Module

**Files:**
- Create: `lib/extractFrames.ts`

- [ ] **Step 1: Implement extractFrames**

```ts
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { MAX_FRAME_BASE64_BYTES } from "./constants";

let ffmpeg: FFmpeg | null = null;

async function getFFmpeg(onProgress?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  onProgress?.("Loading video engine...");
  ffmpeg = new FFmpeg();

  const baseURL = "/ffmpeg";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript"),
  });

  return ffmpeg;
}

export async function extractFrames(
  file: File,
  count: number,
  maxDim: number,
  onProgress?: (msg: string) => void
): Promise<string[]> {
  const ff = await getFFmpeg(onProgress);

  const inputName = "input" + file.name.substring(file.name.lastIndexOf("."));
  onProgress?.("Reading video file...");
  await ff.writeFile(inputName, await fetchFile(file));

  // Get video duration
  let duration = 0;
  ff.on("log", ({ message }) => {
    const match = message.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
    if (match) {
      duration =
        parseInt(match[1]) * 3600 +
        parseInt(match[2]) * 60 +
        parseInt(match[3]) +
        parseInt(match[4]) / 100;
    }
  });

  // Probe duration with a quick pass
  await ff.exec(["-i", inputName, "-f", "null", "-t", "0.001", "/dev/null"]);

  if (duration <= 0) {
    // Fallback: try to extract without duration knowledge
    duration = 10; // assume 10s, frames will be evenly distributed
  }

  const frames: string[] = [];

  for (let i = 0; i < count; i++) {
    const timestamp = (duration * i) / count;
    const outName = `frame_${i}.jpg`;
    let quality = 5; // ffmpeg JPEG quality (2-31, lower = better)

    onProgress?.(`Extracting frame ${i + 1}/${count}...`);

    await ff.exec([
      "-ss", timestamp.toFixed(2),
      "-i", inputName,
      "-frames:v", "1",
      "-vf", `scale='min(${maxDim},iw)':'min(${maxDim},ih)':force_original_aspect_ratio=decrease`,
      "-q:v", quality.toString(),
      outName,
    ]);

    const data = await ff.readFile(outName);
    let base64 = bufferToBase64(data as Uint8Array);

    // Size guard: reduce quality if frame exceeds 4MB base64
    while (base64.length > MAX_FRAME_BASE64_BYTES && quality < 20) {
      quality += 3;
      await ff.exec([
        "-ss", timestamp.toFixed(2),
        "-i", inputName,
        "-frames:v", "1",
        "-vf", `scale='min(${maxDim},iw)':'min(${maxDim},ih)':force_original_aspect_ratio=decrease`,
        "-q:v", quality.toString(),
        "-y", outName,
      ]);
      const redata = await ff.readFile(outName);
      base64 = bufferToBase64(redata as Uint8Array);
    }

    frames.push(base64);
    await ff.deleteFile(outName);
  }

  await ff.deleteFile(inputName);
  return frames;
}

function bufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no type errors (may have warnings about unused vars — that's ok).

- [ ] **Step 3: Commit**

```bash
git add lib/extractFrames.ts
git commit -m "feat: implement client-side frame extraction with ffmpeg.wasm"
```

---

### Task 4: API Route — Claude Streaming Endpoint

**Files:**
- Create: `app/api/generate/route.ts`

- [ ] **Step 1: Implement streaming API route**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { MODEL, MAX_TOKENS, SYSTEM_PROMPT, USER_PROMPT_TEMPLATE } from "@/lib/constants";

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const { frames } = (await req.json()) as { frames: string[] };

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return new Response("No frames provided", { status: 400 });
    }

    // Server-side payload size check (~20MB limit)
    const totalSize = frames.reduce((sum, f) => sum + f.length, 0);
    if (totalSize > 20 * 1024 * 1024) {
      return new Response("Payload too large. Reduce frame count or resolution.", { status: 413 });
    }

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
      { type: "text", text: USER_PROMPT_TEMPLATE(frames.length) },
    ];

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
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

- [ ] **Step 3: Commit**

```bash
git add app/api/generate/route.ts
git commit -m "feat: add Claude Vision streaming API route"
```

---

### Task 5: UI Components — VideoUploader

**Files:**
- Create: `components/VideoUploader.tsx`

- [ ] **Step 1: Implement VideoUploader**

```tsx
"use client";

import { useCallback, useRef, useState } from "react";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/constants";

interface Props {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function VideoUploader({ onFileSelect, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
        return;
      }
      if (!file.type.startsWith("video/")) {
        setError("Please select a video file.");
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
        transition-colors duration-200
        ${dragOver ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-700 hover:border-zinc-500"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <div className="text-4xl mb-3">🎬</div>
      <p className="text-zinc-400 mb-1">Drop video here or click to browse</p>
      <p className="text-zinc-600 text-sm">
        MP4, MOV, HEVC, WebM &middot; Max {MAX_FILE_SIZE_MB}MB
      </p>
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) validateAndSelect(file);
        }}
        disabled={disabled}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/VideoUploader.tsx
git commit -m "feat: add VideoUploader component with drag-drop and validation"
```

---

### Task 6: UI Components — SettingsBar

**Files:**
- Create: `components/SettingsBar.tsx`

- [ ] **Step 1: Implement SettingsBar**

```tsx
"use client";

import {
  DEFAULT_FRAME_COUNT,
  MIN_FRAME_COUNT,
  MAX_FRAME_COUNT,
  RESOLUTION_MAP,
  DEFAULT_RESOLUTION,
  type Resolution,
} from "@/lib/constants";

interface Props {
  frameCount: number;
  resolution: Resolution;
  onFrameCountChange: (count: number) => void;
  onResolutionChange: (res: Resolution) => void;
}

export function SettingsBar({
  frameCount,
  resolution,
  onFrameCountChange,
  onResolutionChange,
}: Props) {
  const resolutions = Object.keys(RESOLUTION_MAP) as Resolution[];

  return (
    <div className="flex items-center gap-6 py-4">
      {/* Frame count slider */}
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

      {/* Resolution picker */}
      <div className="flex gap-1 rounded-lg bg-zinc-800 p-1">
        {resolutions.map((res) => (
          <button
            key={res}
            onClick={() => onResolutionChange(res)}
            className={`
              px-3 py-1.5 rounded-md text-sm font-medium transition-colors
              ${resolution === res
                ? "bg-indigo-500 text-white"
                : "text-zinc-400 hover:text-zinc-200"
              }
            `}
          >
            {res}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/SettingsBar.tsx
git commit -m "feat: add SettingsBar component with frame slider and resolution picker"
```

---

### Task 7: UI Components — FramePreview

**Files:**
- Create: `components/FramePreview.tsx`

- [ ] **Step 1: Implement FramePreview**

```tsx
"use client";

interface Props {
  frames: string[];
  totalCount: number;
}

export function FramePreview({ frames, totalCount }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto py-3">
      {Array.from({ length: totalCount }).map((_, i) => {
        const frame = frames[i];
        return (
          <div
            key={i}
            className={`
              w-20 h-14 rounded-md flex-shrink-0 overflow-hidden
              ${frame ? "border-2 border-indigo-500" : "border border-zinc-700 bg-zinc-900"}
            `}
          >
            {frame ? (
              <img
                src={`data:image/jpeg;base64,${frame}`}
                alt={`Frame ${i + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                {i + 1}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/FramePreview.tsx
git commit -m "feat: add FramePreview component with progressive thumbnail display"
```

---

### Task 8: UI Components — ScriptOutput

**Files:**
- Create: `components/ScriptOutput.tsx`

- [ ] **Step 1: Implement ScriptOutput**

```tsx
"use client";

import { useRef, useEffect } from "react";

interface Props {
  script: string;
  isStreaming: boolean;
  onReset: () => void;
}

export function ScriptOutput({ script, isStreaming, onReset }: Props) {
  const codeRef = useRef<HTMLPreElement>(null);
  const lineCount = script.split("\n").filter((l) => l.length > 0).length;

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [script, isStreaming]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(script);
  };

  const handleDownload = () => {
    const blob = new Blob([script], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "blender_scene.py";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      {/* Status badges */}
      <div className="flex items-center gap-2">
        {isStreaming ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/20 text-indigo-400 rounded-md text-sm">
            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
            Generating
          </span>
        ) : (
          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-md text-sm">
            ✓ Ready
          </span>
        )}
        {!isStreaming && (
          <span className="px-2.5 py-1 bg-zinc-800 text-zinc-400 rounded-md text-sm">
            {lineCount} lines
          </span>
        )}
      </div>

      {/* Code block */}
      <pre
        ref={codeRef}
        className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 overflow-auto max-h-[60vh] text-sm font-mono text-zinc-300 whitespace-pre"
      >
        {script}
        {isStreaming && <span className="animate-pulse text-indigo-400">▌</span>}
      </pre>

      {/* Action buttons */}
      {!isStreaming && (
        <>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
            >
              Copy
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium transition-colors"
            >
              Download .py
            </button>
            <button
              onClick={onReset}
              className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium transition-colors"
            >
              New Video
            </button>
          </div>

          {/* Blender usage hint */}
          <div className="text-xs text-zinc-500 bg-zinc-900 rounded-md px-3 py-2">
            In Blender: Scripting workspace → New → paste → Run (Alt+P)
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ScriptOutput.tsx
git commit -m "feat: add ScriptOutput component with streaming display and actions"
```

---

### Task 9: UI Components — ErrorBanner

**Files:**
- Create: `components/ErrorBanner.tsx`

- [ ] **Step 1: Implement ErrorBanner**

```tsx
"use client";

interface Props {
  message: string;
  onRetry: () => void;
  onReset: () => void;
}

export function ErrorBanner({ message, onRetry, onReset }: Props) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-3">
      <p className="text-red-400 text-sm">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-md text-sm font-medium transition-colors"
        >
          Retry
        </button>
        <button
          onClick={onReset}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md text-sm font-medium transition-colors"
        >
          Start Over
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ErrorBanner.tsx
git commit -m "feat: add ErrorBanner component with retry and reset actions"
```

---

### Task 10: UI Components — ThemeToggle

**Files:**
- Create: `components/ThemeToggle.tsx`

- [ ] **Step 1: Implement ThemeToggle**

```tsx
"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light") {
      setDark(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <button
      onClick={toggle}
      className="fixed top-4 right-4 p-2 rounded-lg bg-zinc-800 dark:bg-zinc-800 bg-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors text-sm"
      aria-label="Toggle theme"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ThemeToggle.tsx
git commit -m "feat: add ThemeToggle component with localStorage persistence"
```

---

### Task 11: Main Page — State Machine & Integration

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update globals.css with dark theme defaults**

Replace the content of `app/globals.css` with:

```css
@import "tailwindcss";

:root {
  --accent: #6366f1;
}

body {
  @apply bg-white text-zinc-900 antialiased;
}

.dark body {
  @apply bg-zinc-950 text-zinc-100;
}
```

- [ ] **Step 2: Update layout.tsx with metadata**

Replace `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Video → Blender",
  description: "Convert architectural video footage into Blender Python scripts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Implement main page with state machine**

Replace `app/page.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
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
  RESOLUTION_MAP,
  type Resolution,
} from "@/lib/constants";

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

  const reset = useCallback(() => {
    setState({ step: "upload", file: null });
  }, []);

  const generateScript = useCallback(async (frames: string[]) => {
    setState({ step: "generating", frames, script: "" });

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames }),
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
  }, []);

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

      // Update with all frames before transitioning
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

  const isProcessing = state.step === "extracting" || state.step === "generating";

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <ThemeToggle />
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            VIDEO → BLENDER
          </h1>
          <p className="text-zinc-500 dark:text-zinc-500 text-zinc-600 text-sm mt-1">
            Upload architectural footage, get a Blender Python script
          </p>
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
              onFrameCountChange={setFrameCount}
              onResolutionChange={setResolution}
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

- [ ] **Step 4: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Run dev server and verify all states render**

```bash
npm run dev
```

Open `http://localhost:3000`. Verify:
- Upload zone appears with drag-drop styling
- Settings bar shows frame slider and resolution buttons
- File selection shows filename and size
- "Generate Blender Script" button appears after file selection

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/globals.css app/layout.tsx
git commit -m "feat: integrate all components into main page with state machine"
```

---

### Task 12: End-to-End Verification & Polish

**Files:**
- Possibly modify: any file needing fixes

- [ ] **Step 1: Test full flow with a real video**

1. Start dev server: `npm run dev`
2. Open `http://localhost:3000`
3. Upload a short video clip (10-30 seconds)
4. Set frames to 4, resolution to 720p
5. Click "Generate Blender Script"
6. Verify: frames extract and show as thumbnails
7. Verify: script streams in with animated cursor
8. Verify: "Ready" badge appears on completion
9. Verify: Copy, Download, and New Video buttons work

- [ ] **Step 2: Test error states**

1. Try uploading a file > 500MB (or a non-video file) — verify error message
2. Set an invalid API key in `.env.local` — verify error banner shows with Retry/Start Over
3. Click Retry — verify it re-attempts
4. Click Start Over — verify it resets to upload

- [ ] **Step 3: Fix any issues found during testing**

Address any bugs, styling issues, or runtime errors discovered in steps 1-2.

- [ ] **Step 4: Push to GitHub**

```bash
git remote add origin https://github.com/dennishoel95/video-to-blender.git
git push -u origin main
```

- [ ] **Step 5: Final commit if any fixes were made**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end testing"
git push
```

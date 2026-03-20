# Video → Blender Script Generator — Design Spec

## Overview

A Next.js web application that accepts architectural video footage, extracts key frames client-side using ffmpeg.wasm, analyzes spatial structure via Claude Vision API, and returns a ready-to-run Blender Python (`bpy`) script that reconstructs the scene using basic mesh primitives.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Frame extraction**: `@ffmpeg/ffmpeg` + `@ffmpeg/util` (WASM, client-side)
- **AI**: Anthropic Claude API (`claude-sonnet-4-20250514`) with native streaming
- **Deployment**: Vercel

## Architecture & Data Flow

Single-page application with three states and a stateless API backend.

```
Upload → Processing → Result

1. UPLOAD STATE
   User drops video → selects settings (frame count, resolution) → clicks "Generate"

2. PROCESSING STATE
   ffmpeg.wasm loads (first time) → extracts N frames as base64 JPEG
   → POST /api/generate with frames array
   → stream response chunks into code display

3. RESULT STATE
   Full bpy script displayed → copy/download/reset actions
```

### Key Boundaries

- **Client**: video handling, frame extraction, streaming display — all browser-side
- **Server**: single API route `/api/generate` — receives base64 frames, calls Claude, pipes stream back
- **No database, no auth, no state persistence** — pure stateless request/response

### Error Paths

- File too large (>500MB) → reject at upload with message
- ffmpeg load failure → show retry option
- API stream failure → show error with "Retry" + "Start over" options
- Non-Python output → auto-strip markdown fences on client

## Visual Design

- **Style**: Clean modern SaaS
- **Theme**: Dark default with indigo accent (#6366f1), light/dark toggle
- **Typography**: System font stack for UI, monospace for code output
- **Layout**: Centered single-column, max-width container

## File Structure

```
video-to-blender/
├── app/
│   ├── page.tsx                # Single page, manages 3 states
│   ├── layout.tsx              # Root layout, fonts, metadata
│   ├── globals.css             # Tailwind + custom properties
│   └── api/
│       └── generate/
│           └── route.ts        # Claude API streaming endpoint
├── components/
│   ├── VideoUploader.tsx       # Drag-drop zone + file validation (500MB cap)
│   ├── SettingsBar.tsx         # Frame count slider + resolution segmented control
│   ├── FramePreview.tsx        # Thumbnail strip during extraction
│   ├── ScriptOutput.tsx        # Streaming code display + copy/download
│   └── ErrorBanner.tsx         # Error display with Retry + Start Over
├── lib/
│   ├── extractFrames.ts        # ffmpeg.wasm frame extraction
│   ├── stripFences.ts          # Markdown fence stripping utility
│   └── constants.ts            # Model name, resolution map, defaults
├── public/
│   └── ffmpeg/                 # ffmpeg.wasm core + worker (copied from node_modules)
├── next.config.js              # COOP/COEP headers
├── .env.local                  # ANTHROPIC_API_KEY
└── .gitignore
```

## Components

### VideoUploader.tsx

- Drag-and-drop zone + click-to-browse
- Accepts: `video/*` (MP4, MOV, HEVC, WebM)
- 500MB file size cap with clear error message
- Shows file name + size after selection
- Shows ffmpeg loading state ("Loading video engine...") on first use

### SettingsBar.tsx

- Frame count: `<input type="range" min={3} max={12} step={1} />` (default: 6)
- Resolution: segmented button group — 720p (default) / 1080p / 4K
- Visible only in upload state, before generation starts

### FramePreview.tsx

- Horizontal thumbnail strip showing extracted frames
- Thumbnails appear progressively as frames are extracted
- Highlighted border on completed frames, dim placeholder for pending

### ScriptOutput.tsx

- Monospace code block with vertical scroll
- Animated "Generating" badge with pulsing indicator while streaming
- "Ready" badge + line count on completion
- Copy to clipboard button
- Download as `blender_scene.py` button
- "New video" reset button
- Info bar: "In Blender: Scripting workspace → New → paste → Run (Alt+P)"

### ErrorBanner.tsx

- Displays error message (network error, rate limit, etc.)
- "Retry" button — re-sends same frames to API
- "Start over" button — resets to upload state

## API Route — `/api/generate/route.ts`

### Request

- Method: POST
- Body: `{ frames: string[], frameCount: number }`
- Each frame is a base64 JPEG string
- Server-side validation: non-empty array, total payload < 20MB

### Claude Call

- Model: `claude-sonnet-4-20250514`
- `max_tokens`: 4096
- `stream: true`
- Message structure: N image content blocks (one per frame) + analysis instruction text

### System Prompt

```
You are an expert in 3D modeling and Blender Python scripting (bpy).
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
- Output ONLY the Python script — no explanation, no markdown fences
```

### User Message

```
Analyze these [N] frames from an architectural walkthrough video.
Identify the room structure: walls, floor, ceiling, doors, windows, and major structural elements.
Produce a complete Blender bpy Python script that reconstructs this space using basic mesh primitives with estimated real-world dimensions.
```

### Response

- Stream `text_delta` events via `ReadableStream`
- Content-Type: `text/plain`
- No server-side post-processing — fence stripping happens on client

### Future Migration Note (v2)

Replace native Anthropic SDK streaming with Vercel AI SDK (`@ai-sdk/anthropic` + `streamText`) when adding authentication and token-based billing. The SDK provides token usage metadata in response objects needed for metering user consumption.

## Frame Extraction — `lib/extractFrames.ts`

### Loading

- Load ffmpeg.wasm once via `toBlobURL`, cache the instance
- Core files served from `/public/ffmpeg/` (no CDN dependency)
- First load shows "Loading video engine..." progress message

### Extraction Strategy

- Calculate N timestamps evenly spaced across video duration
- Use `-ss` seek + single frame grab per timestamp
- More reliable than `-vf fps=` for variable-length videos

### Output Pipeline

1. Extract frame at timestamp
2. Downscale to max dimension (720p=1280, 1080p=1920, 4K=3840)
3. Encode JPEG at 80% quality
4. Convert to base64
5. Size guard: if frame > 4MB base64, reduce quality incrementally (Claude Vision ~5MB limit)
6. Clean up intermediate files from ffmpeg virtual filesystem

### Signature

```ts
export async function extractFrames(
  file: File,
  count: number,
  maxDim: number,
  onProgress?: (msg: string) => void
): Promise<string[]>
```

## State Management

React `useState` in `page.tsx` — no state library needed for this linear flow.

```ts
type AppState =
  | { step: 'upload'; file: null }
  | { step: 'upload'; file: File }
  | { step: 'extracting'; file: File; progress: string; frames: string[] }
  | { step: 'generating'; frames: string[]; script: string }
  | { step: 'done'; frames: string[]; script: string }
  | { step: 'error'; frames: string[]; script: string; error: string }
```

### Transitions

- **Upload → Extracting**: "Generate" button click
- **Extracting → Generating**: automatic when all frames extracted
- **Generating → Done**: stream completes
- **Any → Error**: on failure, preserving frames + partial script for retry
- **Error → Generating**: "Retry" re-sends same frames
- **Error → Upload**: "Start over" resets everything

## Environment Variables

```env
ANTHROPIC_API_KEY=your_key_here
```

## Infrastructure

### COOP/COEP Headers (next.config.js)

Required for `SharedArrayBuffer` which ffmpeg.wasm depends on:

```js
async headers() {
  return [{
    source: "/(.*)",
    headers: [
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Embedder-Policy", value: "require-corp" }
    ]
  }]
}
```

### Package Dependencies

```json
{
  "@ffmpeg/ffmpeg": "^0.12.x",
  "@ffmpeg/util": "^0.12.x",
  "@anthropic-ai/sdk": "^0.x.x"
}
```

## Out of Scope (v1)

- User accounts / authentication
- Token billing / payments
- Multi-room / multi-video support
- Blender preview rendering
- Texture or material generation
- Chat-based script refinement

# Video → Blender UI Enhancement — Design Spec

## Overview

Enhance the existing video-to-blender app with a 3D hero visual, tighter layout, new generation parameters, and mobile optimization. Target audience: 3D artists who create quick room mockups for business clients.

## Changes Summary

1. **3D wireframe room** — React Three Fiber scene in the hero, subtle cursor-tracking tilt
2. **Side-by-side hero layout** — 3D model (left) + title & subtitle (right), stacks on mobile
3. **Tighter container** — max-width ~480px with generous edge padding on desktop
4. **New subtitle** — "Walkthrough video in, Blender scene out. Seconds."
5. **Three new parameters** — Room Scale, Detail Level, Blender Version
6. **Mobile-first responsive** — stacked hero, abbreviated labels, disabled cursor tilt

## 3D Wireframe Room Component

### Visual

A low-poly wireframe room rendered with React Three Fiber. Abstract architectural wireframe only — walls, floor, ceiling edges, one door opening. No furniture. Indigo (#6366f1) edge color with varying opacity to create depth. Semi-transparent faces.

### Interaction

- **Desktop**: Subtle tilt following cursor position. Max rotation: ~8 degrees on each axis. Smooth eased interpolation (lerp).
- **Mobile**: Static orientation, no cursor tracking (no hover events on touch devices).
- The room should have a slight idle float/bob animation (very subtle, ~2px vertical oscillation over ~4s).

### Technical

- New dependency: `three`, `@react-three/fiber`, `@react-three/drei`
- Component: `components/WireframeRoom.tsx`
- Uses `useFrame` for animation loop, `useThree` for pointer tracking
- Canvas size: ~90×75px on desktop, ~80×65px on mobile
- Transparent background (no canvas background color)
- Room geometry: built with `<lineSegments>` or `<Line>` from drei for clean wireframe edges

## Layout Changes

### Hero Section

Side-by-side on desktop (sm: breakpoint, 640px+):
```
[3D Room]  VIDEO → BLENDER
           Walkthrough video in, Blender scene out.
           Seconds.
```

Stacked and centered on mobile:
```
       [3D Room]
    VIDEO → BLENDER
  Walkthrough video in,
 Blender scene out. Seconds.
```

### Container

- `max-w-lg` (~512px) instead of current `max-w-2xl` (~672px)
- Generous horizontal padding: `px-6` mobile, effectively ~64px visual margin on desktop due to narrow container
- Vertically centered with `min-h-screen flex items-center justify-center`

### Title

- Left-aligned on desktop (within the hero flex row)
- Centered on mobile (stacked layout)
- Font: keep current weight/size (text-2xl font-bold)

### Subtitle

- New copy: "Walkthrough video in, Blender scene out. Seconds."
- `text-zinc-600 dark:text-zinc-500 text-sm`

## New Parameters

### Room Scale

Segmented control with three options. Injected into the system prompt to help Claude estimate dimensions.

| Value | Label (desktop) | Label (mobile) | Prompt hint |
|-------|-----------------|----------------|-------------|
| `small` | Small | S | "This is a small room (bathroom, closet, utility room). Typical dimensions: 2-3m × 2-3m, ceiling 2.4m." |
| `medium` | Medium | M | "This is a medium room (office, bedroom, kitchen). Typical dimensions: 3-5m × 3-5m, ceiling 2.5-2.7m." |
| `large` | Large | L | "This is a large room (open plan, warehouse, conference hall). Typical dimensions: 6-15m × 6-15m, ceiling 3-4m." |

Default: `medium`

### Detail Level

Controls how much structure Claude attempts to infer from the video.

| Value | Label (desktop) | Label (mobile) | Prompt modifier |
|-------|-----------------|----------------|-----------------|
| `walls` | Walls | Walls | "Focus only on walls, floor, and ceiling. Do not add doors, windows, or other openings." |
| `openings` | + Openings | + Open | "Include walls, floor, ceiling, plus visible doors and windows as cutouts or inset planes." |
| `full` | Full | Full | "Include all visible structural elements: walls, floor, ceiling, doors, windows, columns, stairs, and any other major features." |

Default: `openings`

### Blender Version

Adjusts generated bpy API calls for compatibility.

| Value | Label | Prompt modifier |
|-------|-------|-----------------|
| `3` | 3.x | "Generate script compatible with Blender 3.x (Python bpy API)." |
| `4` | 4.x | "Generate script compatible with Blender 4.x (Python bpy API). Use updated API calls where the API changed between 3.x and 4.x." |

Default: `4`

### Settings Layout

Two rows below the upload zone:

**Row 1** (existing): Frame count slider (left) + Resolution segmented control (right)

**Row 2** (new): Room Scale (left) + Detail Level (right) — equal width

**Row 3** (new): Blender version toggle — inline, left-aligned, compact

On mobile, rows stack naturally. Row 2 stays side-by-side (using abbreviated labels).

## API Changes

### Request Body

Add new fields to the POST body:

```ts
{
  frames: string[];
  roomScale: "small" | "medium" | "large";
  detailLevel: "walls" | "openings" | "full";
  blenderVersion: 3 | 4;
}
```

### System Prompt

The system prompt in `lib/constants.ts` becomes a function that incorporates the new parameters:

```ts
export function buildSystemPrompt(
  roomScale: RoomScale,
  detailLevel: DetailLevel,
  blenderVersion: BlenderVersion
): string
```

The base prompt remains the same. The room scale hint, detail level modifier, and Blender version note are appended as additional rules.

### Server-side Validation

The API route validates the new fields:
- `roomScale` must be one of `small`, `medium`, `large`
- `detailLevel` must be one of `walls`, `openings`, `full`
- `blenderVersion` must be `3` or `4`
- Invalid values fall back to defaults (don't reject the request)

## Constants Updates

Add to `lib/constants.ts`:

```ts
export const ROOM_SCALES = ["small", "medium", "large"] as const;
export type RoomScale = (typeof ROOM_SCALES)[number];
export const DEFAULT_ROOM_SCALE: RoomScale = "medium";

export const DETAIL_LEVELS = ["walls", "openings", "full"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];
export const DEFAULT_DETAIL_LEVEL: DetailLevel = "openings";

export const BLENDER_VERSIONS = [3, 4] as const;
export type BlenderVersion = (typeof BLENDER_VERSIONS)[number];
export const DEFAULT_BLENDER_VERSION: BlenderVersion = 4;
```

## Component Changes

### New: `components/WireframeRoom.tsx`

R3F canvas with wireframe room geometry. Accepts no props — purely decorative. Handles its own cursor tracking internally via `useThree` pointer state.

### Modified: `components/SettingsBar.tsx`

Add new props for roomScale, detailLevel, blenderVersion with their change handlers. Render the two new rows of segmented controls. Use abbreviated labels on mobile via responsive classes (`hidden sm:inline` / `sm:hidden`).

### Modified: `app/page.tsx`

- New state variables for roomScale, detailLevel, blenderVersion with defaults
- Pass new params to SettingsBar
- Include new params in the POST body to `/api/generate`
- Hero section restructured: WireframeRoom + title in a flex row
- Container narrowed to max-w-lg

### Modified: `app/api/generate/route.ts`

- Destructure new fields from request body
- Validate new fields with fallback to defaults
- Call `buildSystemPrompt()` instead of using static `SYSTEM_PROMPT`

### Modified: `lib/constants.ts`

- Add new types, constants, defaults
- Replace static `SYSTEM_PROMPT` with `buildSystemPrompt()` function
- Add prompt hint strings for each parameter value

## Responsive Breakpoints

- **< 640px (mobile)**: Hero stacks vertically and centers. Labels abbreviate. Cursor tilt disabled.
- **≥ 640px (desktop)**: Hero is side-by-side. Full labels. Cursor tilt active.

## File Structure (new/modified)

```
components/
  WireframeRoom.tsx          # NEW — R3F 3D wireframe room
  SettingsBar.tsx             # MODIFIED — add 3 new parameter controls
app/
  page.tsx                   # MODIFIED — new state, hero layout, narrower container
  api/generate/route.ts      # MODIFIED — accept & validate new params
lib/
  constants.ts               # MODIFIED — new types, buildSystemPrompt()
package.json                 # MODIFIED — add three, @react-three/fiber, @react-three/drei
```

## Out of Scope

- Light mode styling fixes (existing issue, separate task)
- Script preview/3D preview feature
- Chat-based refinement loop (v2 feature)
- Custom prompt append field

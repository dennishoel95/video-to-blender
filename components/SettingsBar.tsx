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

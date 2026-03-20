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

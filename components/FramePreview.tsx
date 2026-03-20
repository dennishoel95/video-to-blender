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

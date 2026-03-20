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

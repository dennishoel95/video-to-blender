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

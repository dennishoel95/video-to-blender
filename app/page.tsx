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
          <p className="text-zinc-500 dark:text-zinc-500 text-sm mt-1">
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

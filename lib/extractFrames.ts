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

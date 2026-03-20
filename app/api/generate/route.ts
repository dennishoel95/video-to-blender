import Anthropic from "@anthropic-ai/sdk";
import {
  MODEL,
  MAX_TOKENS,
  buildSystemPrompt,
  buildUserPrompt,
  ROOM_SCALES,
  DETAIL_LEVELS,
  BLENDER_VERSIONS,
  DEFAULT_ROOM_SCALE,
  DEFAULT_DETAIL_LEVEL,
  DEFAULT_BLENDER_VERSION,
  type RoomScale,
  type DetailLevel,
  type BlenderVersion,
} from "@/lib/constants";

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      frames: string[];
      roomScale?: unknown;
      detailLevel?: unknown;
      blenderVersion?: unknown;
    };

    const { frames } = body;

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return new Response("No frames provided", { status: 400 });
    }

    // Server-side payload size check (~20MB limit)
    const totalSize = frames.reduce((sum, f) => sum + f.length, 0);
    if (totalSize > 20 * 1024 * 1024) {
      return new Response("Payload too large. Reduce frame count or resolution.", { status: 413 });
    }

    // Validate new params with fallback to defaults
    const roomScale: RoomScale =
      typeof body.roomScale === "string" && (ROOM_SCALES as readonly string[]).includes(body.roomScale)
        ? (body.roomScale as RoomScale)
        : DEFAULT_ROOM_SCALE;

    const detailLevel: DetailLevel =
      typeof body.detailLevel === "string" && (DETAIL_LEVELS as readonly string[]).includes(body.detailLevel)
        ? (body.detailLevel as DetailLevel)
        : DEFAULT_DETAIL_LEVEL;

    const blenderVersion: BlenderVersion =
      typeof body.blenderVersion === "number" &&
      Number.isInteger(body.blenderVersion) &&
      (BLENDER_VERSIONS as readonly number[]).includes(body.blenderVersion)
        ? (body.blenderVersion as BlenderVersion)
        : DEFAULT_BLENDER_VERSION;

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
      { type: "text", text: buildUserPrompt(frames.length, detailLevel) },
    ];

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(roomScale, detailLevel, blenderVersion),
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

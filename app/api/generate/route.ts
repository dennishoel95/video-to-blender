import Anthropic from "@anthropic-ai/sdk";
import { MODEL, MAX_TOKENS, SYSTEM_PROMPT, USER_PROMPT_TEMPLATE } from "@/lib/constants";

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const { frames } = (await req.json()) as { frames: string[] };

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return new Response("No frames provided", { status: 400 });
    }

    // Server-side payload size check (~20MB limit)
    const totalSize = frames.reduce((sum, f) => sum + f.length, 0);
    if (totalSize > 20 * 1024 * 1024) {
      return new Response("Payload too large. Reduce frame count or resolution.", { status: 413 });
    }

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
      { type: "text", text: USER_PROMPT_TEMPLATE(frames.length) },
    ];

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
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

import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { encodeCodeMeta } from "@/lib/code-meta";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

type BackendChatPayload = {
  datasetId?: string;
  dataset_id?: string;
  message?: { role: string; parts?: Array<{ type: string; text?: string }> };
  messages?: Array<{
    role: string;
    content?: string;
    parts?: Array<{ type: string; text?: string }>;
  }>;
};

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const body = (await req.json()) as BackendChatPayload;
  const datasetId =
    body.dataset_id ??
    body.datasetId ??
    url.searchParams.get("dataset_id") ??
    "";

  if (!datasetId) {
    return new Response("dataset_id is required", { status: 400 });
  }

  const normalizedMessages =
    body.messages?.map((message) => ({
      role: message.role,
      content:
        message.content ??
        (message.parts ?? [])
          .filter((part) => part.type === "text")
          .map((part) => part.text ?? "")
          .join(""),
    })) ??
    (body.message
      ? [
          {
            role: body.message.role,
            content: (body.message.parts ?? [])
              .filter((part) => part.type === "text")
              .map((part) => part.text ?? "")
              .join(""),
          },
        ]
      : []);

  const upstream = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataset_id: datasetId,
      messages: normalizedMessages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errorBody = await upstream.text();
    return new Response(errorBody || "Backend chat request failed", {
      status: upstream.status || 500,
    });
  }

  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  let buffer = "";

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const textId = crypto.randomUUID();
      writer.write({ type: "text-start", id: textId });

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          writer.write({ type: "text-end", id: textId });
          return;
        }

        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          let eventName = "message";
          let dataLine = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            }
            if (line.startsWith("data:")) {
              dataLine += line.slice(5).trim();
            }
          }

          if (eventName === "final" && dataLine) {
            try {
              const parsed = JSON.parse(dataLine) as {
                answer?: string;
                sql?: string;
                python?: string;
              };
              const text = encodeCodeMeta(parsed.answer ?? "", {
                sql: parsed.sql ?? "",
                python: parsed.python ?? "",
              });
              writer.write({
                type: "text-delta",
                id: textId,
                delta: text,
              });
            } catch {
              writer.write({
                type: "text-delta",
                id: textId,
                delta: dataLine,
              });
            }
          }

          if (eventName === "done") {
            writer.write({ type: "text-end", id: textId });
            return;
          }

          boundary = buffer.indexOf("\n\n");
        }
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}

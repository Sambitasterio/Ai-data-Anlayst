"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function ChatWindow() {
  const [datasetId, setDatasetId] = useState("");
  const [datasetIdInput, setDatasetIdInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const {
    messages,
    sendMessage,
    regenerate,
    status,
    stop,
    error,
  } = useChat({
    id: datasetId ? `chat-${datasetId}` : "chat-unset",
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({
        id,
        messages: outgoingMessages,
        trigger,
        messageId,
      }) {
        return {
          body: {
            id,
            trigger,
            messageId,
            dataset_id: datasetId,
            messages: outgoingMessages,
          },
        };
      },
    }),
  });

  const [input, setInput] = useState("");

  const isLoading = status === "submitted" || status === "streaming";
  const canSend = useMemo(
    () => Boolean(datasetId) && input.trim().length > 0 && !isLoading,
    [datasetId, input, isLoading]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="mx-auto flex h-[80vh] w-full max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input
          value={datasetIdInput}
          onChange={(e) => setDatasetIdInput(e.target.value)}
          placeholder="Paste dataset_id from /upload response"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setDatasetId(datasetIdInput.trim())}
        >
          Set Dataset
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Active dataset: {datasetId || "not set"}
      </div>

      <ScrollArea className="flex-1 rounded-lg border p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              )}
            >
              <ReactMarkdown>
                {message.parts.reduce((acc, part) => {
                  if (part.type === "text") {
                    return acc + part.text;
                  }
                  return acc;
                }, "")}
              </ReactMarkdown>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {error ? (
        <p className="text-sm text-destructive">Error: {error.message}</p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSend) {
            return;
          }
          sendMessage({ text: input });
          setInput("");
        }}
        className="flex items-center gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your dataset..."
          disabled={!datasetId}
        />
        <Button type="submit" disabled={!canSend}>
          Send
        </Button>
      </form>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={stop} disabled={!isLoading}>
          Stop
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => regenerate()}
          disabled={messages.length === 0 || isLoading}
        >
          Regenerate
        </Button>
      </div>
    </div>
  );
}

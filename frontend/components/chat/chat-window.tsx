"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";

import { ChartCard } from "@/components/dashboard/chart-card";
import { DatasetDropzone } from "@/components/upload/dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getDatasetPreview, listDatasets, type DatasetInfo } from "@/lib/api";
import { extractChartSpecFromText } from "@/lib/plotly-loader";
import { cn } from "@/lib/utils";

export function ChatWindow() {
  const [datasetId, setDatasetId] = useState("");
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [datasetMeta, setDatasetMeta] = useState<DatasetInfo | null>(null);
  const [datasetSummary, setDatasetSummary] = useState<string>("");
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

  useEffect(() => {
    const loadDatasets = async () => {
      try {
        const items = await listDatasets();
        setDatasets(items);
        if (!datasetId && items.length > 0) {
          setDatasetId(items[0].id);
          setDatasetMeta(items[0]);
        }
      } catch {
        setDatasets([]);
      }
    };

    void loadDatasets();
  }, []);

  const handleDatasetChange = async (newDatasetId: string) => {
    setDatasetId(newDatasetId);
    const selected = datasets.find((item) => item.id === newDatasetId) ?? null;
    setDatasetMeta(selected);

    if (!newDatasetId) {
      setDatasetSummary("");
      return;
    }

    try {
      const preview = await getDatasetPreview(newDatasetId);
      setDatasetSummary(`${preview.rows.length} preview rows loaded`);
    } catch {
      setDatasetSummary("");
    }
  };

  return (
    <div className="mx-auto flex h-[80vh] w-full max-w-4xl flex-col gap-4">
      <div className="space-y-3 rounded-lg border p-3">
        <DatasetDropzone
          onUploaded={(dataset, preview) => {
            setDatasets((prev) => [dataset, ...prev.filter((d) => d.id !== dataset.id)]);
            setDatasetId(dataset.id);
            setDatasetMeta(dataset);
            setDatasetSummary(`${preview.rows.length} preview rows loaded`);
          }}
        />

        <div className="flex items-center gap-2">
          <select
            className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
            value={datasetId}
            onChange={(e) => void handleDatasetChange(e.target.value)}
          >
            <option value="">Select dataset</option>
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.file_name} ({dataset.id.slice(0, 8)}...)
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => setInput("How many rows are in this dataset?")}>
            Sample Q
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Active dataset: {datasetMeta?.file_name || "not set"}
        {datasetSummary ? ` · ${datasetSummary}` : ""}
      </div>

      <ScrollArea className="flex-1 rounded-lg border p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            (() => {
              const textContent = message.parts.reduce((acc, part) => {
                if (part.type === "text") {
                  return acc + part.text;
                }
                return acc;
              }, "");
              const chartSpec =
                message.role === "assistant"
                  ? extractChartSpecFromText(textContent)
                  : null;

              if (chartSpec) {
                return (
                  <div key={message.id} className="space-y-2">
                    <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                      Rendered chart from assistant response.
                    </div>
                    <ChartCard spec={chartSpec} title="Assistant Chart" />
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    message.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  <ReactMarkdown>{textContent}</ReactMarkdown>
                </div>
              );
            })()
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

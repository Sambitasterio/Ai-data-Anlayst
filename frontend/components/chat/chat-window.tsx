"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";

import { CodePreview } from "@/components/chat/code-preview";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DatasetDropzone } from "@/components/upload/dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  createConversation,
  deleteConversation,
  getConversation,
  getDatasetPreview,
  listConversations,
  listDatasets,
  renameConversation,
  type ConversationMessage,
  type ConversationSummary,
  type DatasetInfo,
} from "@/lib/api";
import { decodeCodeMeta } from "@/lib/code-meta";
import { extractChartSpecFromText } from "@/lib/plotly-loader";
import { cn } from "@/lib/utils";

export function ChatWindow() {
  const [datasetId, setDatasetId] = useState("");
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [datasetMeta, setDatasetMeta] = useState<DatasetInfo | null>(null);
  const [datasetSummary, setDatasetSummary] = useState<string>("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const {
    messages,
    sendMessage,
    setMessages,
    regenerate,
    status,
    stop,
    error,
  } = useChat({
    id: conversationId || "chat-draft",
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
            conversation_id: conversationId || undefined,
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

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const items = await listConversations();
        setConversations(items);
      } catch {
        setConversations([]);
      }
    };

    void loadConversations();
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

  const mapConversationToMessages = (conversationMessages: ConversationMessage[]) =>
    conversationMessages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: [{ type: "text" as const, text: message.content }],
    }));

  const handleSelectConversation = async (selectedConversationId: string) => {
    setConversationId(selectedConversationId);
    try {
      const detail = await getConversation(selectedConversationId);
      setMessages(mapConversationToMessages(detail.messages));
      if (detail.dataset_id) {
        await handleDatasetChange(detail.dataset_id);
      }
    } catch {
      setMessages([]);
    }
  };

  const handleNewChat = () => {
    setConversationId("");
    setMessages([]);
    setInput("");
  };

  const handleRenameConversation = async (id: string) => {
    const existing = conversations.find((item) => item.id === id);
    const nextTitle = window.prompt("Rename conversation", existing?.title ?? "");
    if (!nextTitle || !nextTitle.trim()) {
      return;
    }
    try {
      const updated = await renameConversation(id, nextTitle.trim());
      setConversations((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch {
      // Ignore rename errors in UI; user can retry.
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((item) => item.id !== id));
      if (conversationId === id) {
        handleNewChat();
      }
    } catch {
      // Ignore delete errors in UI; user can retry.
    }
  };

  const handleSend = async () => {
    if (!canSend) {
      return;
    }

    let currentConversationId = conversationId;
    if (!currentConversationId) {
      try {
        const created = await createConversation({
          title: input.trim().slice(0, 60) || "New chat",
          dataset_id: datasetId || undefined,
        });
        currentConversationId = created.id;
        setConversationId(created.id);
        setConversations((prev) => [created, ...prev]);
      } catch {
        return;
      }
    }

    await sendMessage({ text: input });
    setInput("");

    try {
      const refreshed = await listConversations();
      setConversations(refreshed);
    } catch {
      // Keep existing list if refresh fails.
    }
  };

  return (
    <div className="mx-auto flex h-[80vh] w-full max-w-6xl gap-4">
      <aside className="w-72 shrink-0 rounded-lg border p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">History</h2>
          <Button type="button" size="sm" variant="outline" onClick={handleNewChat}>
            New chat
          </Button>
        </div>
        <ScrollArea className="h-[calc(80vh-7rem)]">
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "rounded-md border p-2",
                  conversationId === conversation.id ? "border-primary bg-muted/40" : ""
                )}
              >
                <button
                  type="button"
                  className="w-full text-left text-sm"
                  onClick={() => void handleSelectConversation(conversation.id)}
                >
                  <div className="truncate font-medium">{conversation.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(conversation.updated_at).toLocaleString()}
                  </div>
                </button>
                <div className="mt-2 flex gap-1">
                  <Button type="button" size="xs" variant="ghost" onClick={() => void handleRenameConversation(conversation.id)}>
                    Rename
                  </Button>
                  <Button type="button" size="xs" variant="ghost" onClick={() => void handleDeleteConversation(conversation.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
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
                const decoded = decodeCodeMeta(textContent);
                const chartSpec =
                  message.role === "assistant"
                    ? extractChartSpecFromText(decoded.content)
                    : null;

                if (chartSpec) {
                  return (
                    <div key={message.id} className="space-y-2">
                      <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                        Rendered chart from assistant response.
                      </div>
                      <ChartCard spec={chartSpec} title="Assistant Chart" />
                      <CodePreview sql={decoded.meta.sql} python={decoded.meta.python} />
                    </div>
                  );
                }

                return (
                  <div key={message.id} className="space-y-2">
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        message.role === "user"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      <ReactMarkdown>{decoded.content}</ReactMarkdown>
                    </div>
                    {message.role === "assistant" ? (
                      <CodePreview sql={decoded.meta.sql} python={decoded.meta.python} />
                    ) : null}
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
            void handleSend();
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
    </div>
  );
}

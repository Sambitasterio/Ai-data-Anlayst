"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { Command, LayoutDashboard, MessageSquareDashed, PanelLeft } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { CodePreview } from "@/components/chat/code-preview";
import {
  DashboardGrid,
  type DashboardLayoutItem,
  type DashboardItem,
} from "@/components/dashboard/dashboard-grid";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DatasetDropzone } from "@/components/upload/dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  connectSqlDatabase,
  createShareLink,
  deleteConversation,
  disconnectSqlDatabase,
  getSqlStatus,
  getConversation,
  getDatasetPreview,
  listConversations,
  listDatasets,
  renameConversation,
  revokeShareLink,
  updateConversationDashboard,
  type ConversationMessage,
  type ConversationSummary,
  type DatasetInfo,
  type SQLConnectionStatus,
} from "@/lib/api";
import { getBackendAuthToken, setBackendAuthToken } from "@/lib/auth-token";
import { decodeCodeMeta } from "@/lib/code-meta";
import { extractChartSpecFromText } from "@/lib/plotly-loader";
import { cn } from "@/lib/utils";

export function ChatWindow() {
  const { data: session, status: sessionStatus } = useSession();
  const [datasetId, setDatasetId] = useState("");
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [datasetMeta, setDatasetMeta] = useState<DatasetInfo | null>(null);
  const [datasetSummary, setDatasetSummary] = useState<string>("");
  const [sqlStatus, setSqlStatus] = useState<SQLConnectionStatus | null>(null);
  const [isSqlConnecting, setIsSqlConnecting] = useState(false);
  const [sqlForm, setSqlForm] = useState({
    db_type: "postgres" as "postgres" | "mysql" | "sqlite",
    host: "",
    port: "5432",
    username: "",
    password: "",
    database: "",
    sqlite_path: "",
    name: "",
  });
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string>("");
  const [dashboardItems, setDashboardItems] = useState<DashboardItem[]>([]);
  const [dashboardLayout, setDashboardLayout] = useState<DashboardLayoutItem[]>([]);
  const [isDatasetsLoading, setIsDatasetsLoading] = useState(true);
  const [isConversationsLoading, setIsConversationsLoading] = useState(true);
  const [isHistoryOpenMobile, setIsHistoryOpenMobile] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const conversationIdRef = useRef<string>("");
  const datasetIdRef = useRef<string>("");
  const dashboardItemsRef = useRef<DashboardItem[]>([]);
  const dashboardLayoutRef = useRef<DashboardLayoutItem[]>([]);
  const removedDashboardItemIdsRef = useRef<Set<string>>(new Set());
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
        const authToken = getBackendAuthToken();
        return {
          body: {
            id,
            trigger,
            messageId,
            dataset_id: datasetIdRef.current,
            conversation_id: conversationIdRef.current || undefined,
            messages: outgoingMessages,
          },
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
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
    const token = session?.backendAccessToken;
    setBackendAuthToken(token);
    return () => setBackendAuthToken(undefined);
  }, [session?.backendAccessToken]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    datasetIdRef.current = datasetId;
  }, [datasetId]);

  useEffect(() => {
    dashboardItemsRef.current = dashboardItems;
  }, [dashboardItems]);

  useEffect(() => {
    dashboardLayoutRef.current = dashboardLayout;
  }, [dashboardLayout]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if (event.key === "Escape") {
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const loadDatasets = async () => {
      setIsDatasetsLoading(true);
      try {
        const items = await listDatasets();
        setDatasets(items);
        if (!datasetId && items.length > 0) {
          setDatasetId(items[0].id);
          setDatasetMeta(items[0]);
        }
      } catch {
        setDatasets([]);
        toast.error("Failed to load datasets.");
      } finally {
        setIsDatasetsLoading(false);
      }
    };

    void loadDatasets();
  }, []);

  useEffect(() => {
    const loadConversations = async () => {
      setIsConversationsLoading(true);
      try {
        const items = await listConversations();
        setConversations(items);
      } catch {
        setConversations([]);
        toast.error("Failed to load conversation history.");
      } finally {
        setIsConversationsLoading(false);
      }
    };

    void loadConversations();
  }, []);

  useEffect(() => {
    const loadSqlStatus = async () => {
      try {
        const status = await getSqlStatus();
        setSqlStatus(status);
      } catch {
        setSqlStatus(null);
      }
    };
    void loadSqlStatus();
  }, []);

  const handleDatasetChange = async (newDatasetId: string) => {
    setDatasetId(newDatasetId);
    if (newDatasetId.startsWith("sql:")) {
      setDatasetMeta(null);
      setDatasetSummary("Connected SQL source");
      return;
    }
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
      toast.error("Failed to load dataset preview.");
    }
  };

  const handleConnectSql = async () => {
    try {
      setIsSqlConnecting(true);
      const status = await connectSqlDatabase({
        db_type: sqlForm.db_type,
        host: sqlForm.db_type === "sqlite" ? undefined : sqlForm.host || undefined,
        port:
          sqlForm.db_type === "sqlite"
            ? undefined
            : sqlForm.port
              ? Number(sqlForm.port)
              : undefined,
        username: sqlForm.db_type === "sqlite" ? undefined : sqlForm.username || undefined,
        password: sqlForm.db_type === "sqlite" ? undefined : sqlForm.password || undefined,
        database: sqlForm.db_type === "sqlite" ? undefined : sqlForm.database || undefined,
        sqlite_path: sqlForm.db_type === "sqlite" ? sqlForm.sqlite_path || undefined : undefined,
        name: sqlForm.name || undefined,
      });
      setSqlStatus(status);
      if (status.connection) {
        setDatasetId(`sql:${status.connection.id}`);
        setDatasetSummary("Connected SQL source");
      }
      toast.success("SQL database connected.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect SQL database.");
    } finally {
      setIsSqlConnecting(false);
    }
  };

  const handleDisconnectSql = async () => {
    try {
      await disconnectSqlDatabase();
      setSqlStatus({ connection: null, schema: [] });
      if (datasetId.startsWith("sql:")) {
        setDatasetId("");
        setDatasetSummary("");
      }
      toast.success("SQL database disconnected.");
    } catch {
      toast.error("Failed to disconnect SQL database.");
    }
  };

  const mapConversationToMessages = (conversationMessages: ConversationMessage[]) =>
    conversationMessages.map((message) => ({
      id: message.id,
      role: message.role,
      parts: [{ type: "text" as const, text: message.content }],
    }));

  const parseDashboardState = (conversation: ConversationSummary) => {
    const nextItems = (conversation.dashboard_items ?? [])
      .map((item) => {
        const id = typeof item.id === "string" ? item.id : "";
        const title = typeof item.title === "string" ? item.title : "Pinned chart";
        const spec = item.spec;
        if (!id || !spec || typeof spec !== "object") {
          return null;
        }
        return { id, title, spec } as DashboardItem;
      })
      .filter((item): item is DashboardItem => item !== null);

    const nextLayout = (conversation.dashboard_layout ?? [])
      .map((layout) => {
        const i = typeof layout.i === "string" ? layout.i : "";
        const x = Number(layout.x);
        const y = Number(layout.y);
        const w = Number(layout.w);
        const h = Number(layout.h);
        if (!i || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
          return null;
        }
        return { i, x, y, w, h };
      })
      .filter((item): item is DashboardLayoutItem => item !== null);

    dashboardItemsRef.current = nextItems;
    dashboardLayoutRef.current = nextLayout;
    setDashboardItems(nextItems);
    setDashboardLayout(nextLayout);
    removedDashboardItemIdsRef.current.clear();
  };

  const handleSelectConversation = async (selectedConversationId: string) => {
    setConversationId(selectedConversationId);
    try {
      const detail = await getConversation(selectedConversationId);
      setMessages(mapConversationToMessages(detail.messages));
      parseDashboardState(detail);
      if (detail.dataset_id) {
        await handleDatasetChange(detail.dataset_id);
      }
      setIsHistoryOpenMobile(false);
    } catch {
      setMessages([]);
      setDashboardItems([]);
      setDashboardLayout([]);
      toast.error("Could not open conversation.");
    }
  };

  const handleNewChat = () => {
    setConversationId("");
    setMessages([]);
    setInput("");
    dashboardItemsRef.current = [];
    dashboardLayoutRef.current = [];
    setDashboardItems([]);
    setDashboardLayout([]);
    removedDashboardItemIdsRef.current.clear();
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
      toast.success("Conversation renamed.");
    } catch {
      toast.error("Rename failed. Try again.");
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((item) => item.id !== id));
      if (conversationId === id) {
        handleNewChat();
      }
      toast.success("Conversation deleted.");
    } catch {
      toast.error("Delete failed. Try again.");
    }
  };

  const handleSend = async () => {
    if (!canSend) {
      return;
    }

    const wasDraftConversation = !conversationId;

    await sendMessage({ text: input });
    setInput("");

    try {
      const refreshed = await listConversations();
      setConversations(refreshed);
      if (wasDraftConversation && refreshed.length > 0) {
        const newestConversation = refreshed[0];
        conversationIdRef.current = newestConversation.id;
        await handleSelectConversation(newestConversation.id);
      }
    } catch {
      toast.error("Message sent, but history refresh failed.");
    }
  };

  const saveDashboard = async (
    nextLayout: DashboardLayoutItem[],
    nextItems: DashboardItem[]
  ) => {
    if (!conversationId) {
      return;
    }
    try {
      const updated = await updateConversationDashboard(conversationId, {
        dashboard_layout: nextLayout as Array<Record<string, unknown>>,
        dashboard_items: nextItems as Array<Record<string, unknown>>,
      });
      setConversations((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      toast.error("Could not save dashboard layout.");
    }
  };

  const handlePinChart = (spec: ReturnType<typeof extractChartSpecFromText>) => {
    if (!spec) {
      return;
    }
    if (!conversationId) {
      window.alert("Start a conversation first, then pin the chart.");
      return;
    }
    const itemId = crypto.randomUUID();
    const nextItem: DashboardItem = {
      id: itemId,
      title: typeof spec.layout?.title === "string" ? spec.layout.title : "Pinned chart",
      spec,
    };
    const nextItems = [...dashboardItems, nextItem];
    const nextLayout = [
      ...dashboardLayout,
      { i: itemId, x: (dashboardItems.length * 4) % 12, y: Infinity, w: 6, h: 10 },
    ];
    removedDashboardItemIdsRef.current.delete(itemId);
    dashboardItemsRef.current = nextItems;
    dashboardLayoutRef.current = nextLayout;
    setDashboardItems(nextItems);
    setDashboardLayout(nextLayout);
    void saveDashboard(nextLayout, nextItems);
  };

  const handleDashboardLayoutChange = (nextLayout: DashboardLayoutItem[]) => {
    const blockedIds = removedDashboardItemIdsRef.current;
    const existingItemIds = new Set(dashboardItemsRef.current.map((item) => item.id));
    const filteredLayout = nextLayout.filter(
      (item) => !blockedIds.has(item.i) && existingItemIds.has(item.i)
    );
    const nextIds = new Set(filteredLayout.map((item) => item.i));
    const syncedItems = dashboardItemsRef.current.filter((item) => nextIds.has(item.id));
    dashboardItemsRef.current = syncedItems;
    dashboardLayoutRef.current = filteredLayout;
    setDashboardLayout(filteredLayout);
    setDashboardItems(syncedItems);
    void saveDashboard(filteredLayout, syncedItems);
  };

  const handleRemovePinnedItem = (itemId: string) => {
    removedDashboardItemIdsRef.current.add(itemId);
    const nextItems = dashboardItemsRef.current.filter((item) => item.id !== itemId);
    const nextLayout = dashboardLayoutRef.current.filter((item) => item.i !== itemId);
    dashboardItemsRef.current = nextItems;
    dashboardLayoutRef.current = nextLayout;
    setDashboardItems(nextItems);
    setDashboardLayout(nextLayout);
    void saveDashboard(nextLayout, nextItems);
  };

  const handleShareDashboard = async (permission: "view" | "edit") => {
    if (!conversationId) {
      toast.error("Open or start a conversation first.");
      return;
    }
    if (!session?.backendAccessToken) {
      toast.error("Sign in to create a share link.");
      return;
    }
    try {
      const { token } = await createShareLink(conversationId, permission);
      const url = `${window.location.origin}/share/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success(`Public ${permission} link copied to clipboard.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create share link.");
    }
  };

  const handleRevokeShare = async () => {
    if (!conversationId || !session?.backendAccessToken) {
      return;
    }
    try {
      await revokeShareLink(conversationId);
      toast.success("Share link revoked.");
    } catch {
      toast.error("Could not revoke share link.");
    }
  };

  const commandActions = [
    {
      label: "New chat",
      hint: "Reset current draft",
      run: () => {
        handleNewChat();
        setIsCommandPaletteOpen(false);
      },
    },
    {
      label: "Sample question",
      hint: "How many rows are in this dataset?",
      run: () => {
        setInput("How many rows are in this dataset?");
        setIsCommandPaletteOpen(false);
      },
    },
    {
      label: "Open history (mobile)",
      hint: "Show chat sidebar",
      run: () => {
        setIsHistoryOpenMobile(true);
        setIsCommandPaletteOpen(false);
      },
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 lg:h-[80vh] lg:flex-row">
      <AnimatePresence>
        {isCommandPaletteOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCommandPaletteOpen(false)}
          >
            <motion.div
              className="w-full max-w-lg rounded-xl border bg-card p-3 shadow-xl"
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-sm font-medium">Command Palette</p>
                <span className="text-xs text-muted-foreground">Ctrl/Cmd + K</span>
              </div>
              <div className="space-y-1">
                {commandActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={action.run}
                  >
                    <span>{action.label}</span>
                    <span className="text-xs text-muted-foreground">{action.hint}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <aside
        className={cn(
          "w-full shrink-0 rounded-lg border p-3 lg:block lg:w-72",
          isHistoryOpenMobile ? "block" : "hidden",
          "lg:h-auto"
        )}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">History</h2>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleNewChat}>
              New chat
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="lg:hidden"
              onClick={() => setIsHistoryOpenMobile(false)}
            >
              Close
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[45vh] lg:h-[calc(80vh-7rem)]">
          <div className="space-y-2">
            {isConversationsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-md border bg-muted/30" />
                ))}
              </div>
            ) : null}
            {!isConversationsLoading && conversations.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                <MessageSquareDashed className="mx-auto mb-2 h-5 w-5 opacity-70" />
                No conversations yet.
                <br />
                Ask your first question to start one.
              </div>
            ) : null}
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
        <div className="flex items-center justify-between lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsHistoryOpenMobile((prev) => !prev)}
          >
            <PanelLeft className="mr-2 h-4 w-4" />
            History
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsCommandPaletteOpen(true)}
          >
            <Command className="mr-2 h-4 w-4" />
            Commands
          </Button>
        </div>

        <div className="hidden items-center justify-between gap-2 lg:flex">
          <div className="truncate text-sm text-muted-foreground">
            {session?.user?.email ? (
              <>
                <span className="hidden xl:inline">{session.user.email}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-2 h-8"
                  onClick={() => void signOut({ callbackUrl: "/chat" })}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <Link href="/login" className="text-primary underline">
                Sign in
              </Link>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsCommandPaletteOpen(true)}>
            <Command className="mr-2 h-4 w-4" />
            Command Palette
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <DatasetDropzone
            onUploaded={(dataset, preview) => {
              setDatasets((prev) => [dataset, ...prev.filter((d) => d.id !== dataset.id)]);
              setDatasetId(dataset.id);
              setDatasetMeta(dataset);
              setDatasetSummary(`${preview.rows.length} preview rows loaded`);
            }}
          />

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">SQL Connector</p>
              {sqlStatus?.connection ? (
                <span className="text-xs text-emerald-600">
                  Connected: {sqlStatus.connection.name}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Not connected</span>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <select
                className="h-9 rounded-md border bg-background px-2 text-sm"
                value={sqlForm.db_type}
                onChange={(event) =>
                  setSqlForm((prev) => ({
                    ...prev,
                    db_type: event.target.value as "postgres" | "mysql" | "sqlite",
                    port: event.target.value === "mysql" ? "3306" : "5432",
                  }))
                }
              >
                <option value="postgres">Postgres</option>
                <option value="mysql">MySQL</option>
                <option value="sqlite">SQLite</option>
              </select>
              {sqlForm.db_type === "sqlite" ? (
                <Input
                  placeholder="SQLite file path"
                  value={sqlForm.sqlite_path}
                  onChange={(event) =>
                    setSqlForm((prev) => ({ ...prev, sqlite_path: event.target.value }))
                  }
                  className="md:col-span-3"
                />
              ) : (
                <>
                  <Input
                    placeholder="Host"
                    value={sqlForm.host}
                    onChange={(event) =>
                      setSqlForm((prev) => ({ ...prev, host: event.target.value }))
                    }
                  />
                  <Input
                    placeholder="Port"
                    value={sqlForm.port}
                    onChange={(event) =>
                      setSqlForm((prev) => ({ ...prev, port: event.target.value }))
                    }
                  />
                  <Input
                    placeholder="Database"
                    value={sqlForm.database}
                    onChange={(event) =>
                      setSqlForm((prev) => ({ ...prev, database: event.target.value }))
                    }
                  />
                </>
              )}
            </div>
            {sqlForm.db_type !== "sqlite" ? (
              <div className="grid gap-2 md:grid-cols-3">
                <Input
                  placeholder="Username"
                  value={sqlForm.username}
                  onChange={(event) =>
                    setSqlForm((prev) => ({ ...prev, username: event.target.value }))
                  }
                />
                <Input
                  placeholder="Password"
                  type="password"
                  value={sqlForm.password}
                  onChange={(event) =>
                    setSqlForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                />
                <Input
                  placeholder="Connection name (optional)"
                  value={sqlForm.name}
                  onChange={(event) =>
                    setSqlForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleConnectSql} disabled={isSqlConnecting}>
                {isSqlConnecting ? "Connecting..." : "Connect SQL"}
              </Button>
              <Button type="button" variant="ghost" onClick={handleDisconnectSql}>
                Disconnect
              </Button>
            </div>
            {sqlStatus?.schema?.length ? (
              <div className="max-h-28 overflow-auto rounded border bg-muted/20 p-2 text-xs text-muted-foreground">
                {sqlStatus.schema.slice(0, 8).map((table) => (
                  <div key={table.table}>
                    <span className="font-medium text-foreground">{table.table}</span>:{" "}
                    {table.columns.slice(0, 8).map((column) => column.name).join(", ")}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <select
              className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
              value={datasetId}
              onChange={(e) => void handleDatasetChange(e.target.value)}
              disabled={isDatasetsLoading}
            >
              <option value="">Select dataset</option>
              {sqlStatus?.connection ? (
                <option value={`sql:${sqlStatus.connection.id}`}>
                  SQL: {sqlStatus.connection.name} ({sqlStatus.connection.db_type})
                </option>
              ) : null}
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
          {isDatasetsLoading ? (
            <div className="h-8 animate-pulse rounded bg-muted/30" />
          ) : null}
          {!isDatasetsLoading && datasets.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <LayoutDashboard className="mb-1 h-4 w-4" />
              No dataset uploaded yet. Drop a CSV/Excel file above to start.
            </div>
          ) : null}
        </div>

        <div className="text-sm text-muted-foreground">
          Active dataset:{" "}
          {datasetId.startsWith("sql:")
            ? sqlStatus?.connection?.name || "SQL source"
            : datasetMeta?.file_name || "not set"}
          {datasetSummary ? ` · ${datasetSummary}` : ""}
        </div>

        {!session && sessionStatus !== "loading" ? (
          <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            <Link className="font-medium text-primary underline" href="/login">
              Sign in
            </Link>{" "}
            to save chats to your account and share dashboards.{" "}
            <Link className="underline" href="/register">
              Register
            </Link>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-medium">Dashboard</h3>
            {conversationId && session ? (
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleShareDashboard("view")}
                >
                  Copy view link
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleShareDashboard("edit")}
                >
                  Copy edit link
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => void handleRevokeShare()}>
                  Revoke share
                </Button>
              </div>
            ) : null}
          </div>
          <DashboardGrid
            items={dashboardItems}
            layout={dashboardLayout}
            onLayoutChange={handleDashboardLayoutChange}
            onRemoveItem={handleRemovePinnedItem}
          />
        </div>

        <ScrollArea className="flex-1 rounded-lg border p-4">
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((message) =>
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
                    <motion.div
                      key={message.id}
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {message.role === "assistant" && decoded.meta.warning ? (
                        <div className="max-w-[85%] rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                          {decoded.meta.warning}
                        </div>
                      ) : null}
                      <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                        Rendered chart from assistant response.
                      </div>
                      <ChartCard
                        spec={chartSpec}
                        title="Assistant Chart"
                        onPin={() => handlePinChart(chartSpec)}
                      />
                      <CodePreview sql={decoded.meta.sql} python={decoded.meta.python} />
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={message.id}
                    className="space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {message.role === "assistant" && decoded.meta.warning ? (
                      <div className="max-w-[85%] rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                        {decoded.meta.warning}
                      </div>
                    ) : null}
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
                  </motion.div>
                );
              })()
              )}
            </AnimatePresence>
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-16 w-2/3 animate-pulse rounded-lg bg-muted/30" />
                <div className="h-16 w-1/2 animate-pulse rounded-lg bg-muted/30" />
              </div>
            ) : null}
            {!isLoading && messages.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                <MessageSquareDashed className="mx-auto mb-2 h-5 w-5 opacity-70" />
                Start by asking a question about your uploaded dataset.
              </div>
            ) : null}
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
          className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center"
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

import { authHeaders } from "./auth-token";

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000";

function withAuth(headers?: Record<string, string>): Record<string, string> {
  return { ...authHeaders(), ...headers };
}

export type DatasetColumn = {
  name: string;
  dtype: string;
};

export type DatasetInfo = {
  id: string;
  file_name: string;
  stored_file_name: string;
  view_name: string;
  columns: DatasetColumn[];
};

export type DatasetPreview = {
  dataset_id: string;
  rows: Record<string, unknown>[];
};

export type ConversationSummary = {
  id: string;
  title: string;
  dataset_id: string | null;
  created_at: string;
  updated_at: string;
  dashboard_layout: Array<Record<string, unknown>>;
  dashboard_items: Array<Record<string, unknown>>;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type ConversationDetail = ConversationSummary & {
  messages: ConversationMessage[];
};

export type SQLColumnSchema = {
  name: string;
  type: string;
};

export type SQLTableSchema = {
  table: string;
  columns: SQLColumnSchema[];
};

export type SQLConnectionSummary = {
  id: string;
  name: string;
  db_type: string;
  is_active: boolean;
};

export type SQLConnectionStatus = {
  connection: SQLConnectionSummary | null;
  schema: SQLTableSchema[];
};

export type SharedDashboardPayload = {
  conversation_id: string;
  title: string;
  permission: string;
  dashboard_layout: Array<Record<string, unknown>>;
  dashboard_items: Array<Record<string, unknown>>;
};

export type ShareLinkResponse = {
  token: string;
  permission: string;
};

export async function registerAccount(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ access_token: string; user: { id: string; email: string; name: string | null } }> {
  const response = await fetch(`${BACKEND_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Registration failed.");
  }
  return (await response.json()) as {
    access_token: string;
    user: { id: string; email: string; name: string | null };
  };
}

export async function listDatasets(): Promise<DatasetInfo[]> {
  const response = await fetch(`${BACKEND_URL}/datasets`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to fetch datasets.");
  }
  return (await response.json()) as DatasetInfo[];
}

export async function getDatasetPreview(datasetId: string): Promise<DatasetPreview> {
  const response = await fetch(`${BACKEND_URL}/datasets/${datasetId}/preview`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Failed to fetch dataset preview.");
  }
  return (await response.json()) as DatasetPreview;
}

export async function uploadDataset(file: File): Promise<DatasetInfo> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BACKEND_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Upload failed.");
  }

  return (await response.json()) as DatasetInfo;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const response = await fetch(`${BACKEND_URL}/conversations`, {
    cache: "no-store",
    headers: withAuth(),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch conversations.");
  }
  return (await response.json()) as ConversationSummary[];
}

export async function getConversation(conversationId: string): Promise<ConversationDetail> {
  const response = await fetch(`${BACKEND_URL}/conversations/${conversationId}`, {
    cache: "no-store",
    headers: withAuth(),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch conversation.");
  }
  return (await response.json()) as ConversationDetail;
}

export async function createConversation(input: {
  title?: string;
  dataset_id?: string;
}): Promise<ConversationSummary> {
  const response = await fetch(`${BACKEND_URL}/conversations`, {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to create conversation.");
  }
  return (await response.json()) as ConversationSummary;
}

export async function renameConversation(
  conversationId: string,
  title: string
): Promise<ConversationSummary> {
  const response = await fetch(`${BACKEND_URL}/conversations/${conversationId}`, {
    method: "PATCH",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    throw new Error("Failed to rename conversation.");
  }
  return (await response.json()) as ConversationSummary;
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/conversations/${conversationId}`, {
    method: "DELETE",
    headers: withAuth(),
  });
  if (!response.ok) {
    throw new Error("Failed to delete conversation.");
  }
}

export async function updateConversationDashboard(
  conversationId: string,
  input: {
    dashboard_layout: Array<Record<string, unknown>>;
    dashboard_items: Array<Record<string, unknown>>;
  }
): Promise<ConversationSummary> {
  const response = await fetch(`${BACKEND_URL}/conversations/${conversationId}/dashboard`, {
    method: "PATCH",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error("Failed to save dashboard.");
  }
  return (await response.json()) as ConversationSummary;
}

export async function createShareLink(
  conversationId: string,
  permission: "view" | "edit"
): Promise<ShareLinkResponse> {
  const response = await fetch(`${BACKEND_URL}/conversations/${conversationId}/share`, {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify({ permission }),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to create share link.");
  }
  return (await response.json()) as ShareLinkResponse;
}

export async function revokeShareLink(conversationId: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/conversations/${conversationId}/share`, {
    method: "DELETE",
    headers: withAuth(),
  });
  if (!response.ok) {
    throw new Error("Failed to revoke share link.");
  }
}

export async function fetchSharedDashboard(token: string): Promise<SharedDashboardPayload> {
  const response = await fetch(`${BACKEND_URL}/shared/${token}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load shared dashboard.");
  }
  return (await response.json()) as SharedDashboardPayload;
}

export async function updateSharedDashboard(
  token: string,
  input: {
    dashboard_layout: Array<Record<string, unknown>>;
    dashboard_items: Array<Record<string, unknown>>;
  }
): Promise<SharedDashboardPayload> {
  const response = await fetch(`${BACKEND_URL}/shared/${token}/dashboard`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to update shared dashboard.");
  }
  return (await response.json()) as SharedDashboardPayload;
}

export async function connectSqlDatabase(input: {
  db_type: "postgres" | "mysql" | "sqlite";
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  sqlite_path?: string;
  name?: string;
}): Promise<SQLConnectionStatus> {
  const response = await fetch(`${BACKEND_URL}/sql/connect`, {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to connect SQL database.");
  }
  return (await response.json()) as SQLConnectionStatus;
}

export async function getSqlStatus(): Promise<SQLConnectionStatus> {
  const response = await fetch(`${BACKEND_URL}/sql/status`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to fetch SQL connection status.");
  }
  return (await response.json()) as SQLConnectionStatus;
}

export async function disconnectSqlDatabase(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/sql/disconnect`, {
    method: "POST",
    headers: withAuth(),
  });
  if (!response.ok) {
    throw new Error("Failed to disconnect SQL database.");
  }
}

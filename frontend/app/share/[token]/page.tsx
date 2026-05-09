"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  DashboardGrid,
  type DashboardItem,
  type DashboardLayoutItem,
} from "@/components/dashboard/dashboard-grid";
import { buttonVariants } from "@/components/ui/button";
import {
  fetchSharedDashboard,
  updateSharedDashboard,
  type SharedDashboardPayload,
} from "@/lib/api";
import { cn } from "@/lib/utils";

function parseDashboardItems(payload: SharedDashboardPayload): {
  items: DashboardItem[];
  layout: DashboardLayoutItem[];
} {
  const items = (payload.dashboard_items ?? [])
    .map((item) => {
      const id = typeof item.id === "string" ? item.id : "";
      const title = typeof item.title === "string" ? item.title : "Chart";
      const spec = item.spec;
      if (!id || !spec || typeof spec !== "object") {
        return null;
      }
      return { id, title, spec } as DashboardItem;
    })
    .filter((item): item is DashboardItem => item !== null);

  const layout = (payload.dashboard_layout ?? [])
    .map((entry) => {
      const i = typeof entry.i === "string" ? entry.i : "";
      const x = Number(entry.x);
      const y = Number(entry.y);
      const w = Number(entry.w);
      const h = Number(entry.h);
      if (!i || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
        return null;
      }
      return { i, x, y, w, h };
    })
    .filter((item): item is DashboardLayoutItem => item !== null);

  return { items, layout };
}

export default function SharedDashboardPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const [payload, setPayload] = useState<SharedDashboardPayload | null>(null);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [layout, setLayout] = useState<DashboardLayoutItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchSharedDashboard(token);
      setPayload(data);
      const parsed = parseDashboardItems(data);
      setItems(parsed.items);
      setLayout(parsed.layout);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const onLayoutChange = useCallback(
    async (nextLayout: DashboardLayoutItem[]) => {
      if (!token || payload?.permission !== "edit") {
        return;
      }
      setLayout(nextLayout);
      try {
        const updated = await updateSharedDashboard(token, {
          dashboard_layout: nextLayout as Array<Record<string, unknown>>,
          dashboard_items: items as Array<Record<string, unknown>>,
        });
        setPayload(updated);
        const parsed = parseDashboardItems(updated);
        setItems(parsed.items);
        setLayout(parsed.layout);
      } catch {
        void load();
      }
    },
    [token, payload?.permission, items, load]
  );

  const onRemoveItem = useCallback(
    async (itemId: string) => {
      if (payload?.permission !== "edit") {
        return;
      }
      const nextItems = items.filter((item) => item.id !== itemId);
      const nextLayout = layout.filter((item) => item.i !== itemId);
      setItems(nextItems);
      setLayout(nextLayout);
      try {
        const updated = await updateSharedDashboard(token, {
          dashboard_layout: nextLayout as Array<Record<string, unknown>>,
          dashboard_items: nextItems as Array<Record<string, unknown>>,
        });
        setPayload(updated);
      } catch {
        void load();
      }
    },
    [payload?.permission, items, layout, token, load]
  );

  if (loading) {
    return (
      <main className="min-h-screen p-6">
        <p className="text-sm text-muted-foreground">Loading shared dashboard…</p>
      </main>
    );
  }

  if (error || !payload) {
    return (
      <main className="min-h-screen p-6">
        <p className="text-destructive">{error || "Not found."}</p>
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "mt-4 inline-block")}>
          Home
        </Link>
      </main>
    );
  }

  const readOnly = payload.permission === "view";

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">{payload.title}</h1>
            <p className="text-sm text-muted-foreground">
              Shared dashboard · {readOnly ? "view only" : "can edit layout"}
            </p>
          </div>
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            Home
          </Link>
        </div>
        <DashboardGrid
          items={items}
          layout={layout}
          onLayoutChange={readOnly ? () => {} : onLayoutChange}
          onRemoveItem={readOnly ? () => {} : onRemoveItem}
          readOnly={readOnly}
        />
      </div>
    </main>
  );
}

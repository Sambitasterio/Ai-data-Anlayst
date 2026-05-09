"use client";

import { useMemo } from "react";
import { Rnd } from "react-rnd";

import { ChartCard } from "@/components/dashboard/chart-card";
import type { PlotlyChartSpec } from "@/lib/plotly-loader";

export type DashboardItem = {
  id: string;
  title: string;
  spec: PlotlyChartSpec;
};

export type DashboardLayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type DashboardGridProps = {
  items: DashboardItem[];
  layout: DashboardLayoutItem[];
  onLayoutChange: (layout: DashboardLayoutItem[]) => void;
  onRemoveItem: (itemId: string) => void;
};

export function DashboardGrid({
  items,
  layout,
  onLayoutChange,
  onRemoveItem,
}: DashboardGridProps) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Pin charts from assistant responses to build your dashboard.
      </div>
    );
  }

  const layoutById = useMemo(
    () => new Map(layout.map((item) => [item.i, item])),
    [layout]
  );

  const withDefaults = items.map((item, index) => {
    const existing = layoutById.get(item.id);
    return (
      existing ?? {
        i: item.id,
        x: 24 + (index % 2) * 440,
        y: 24 + Math.floor(index / 2) * 340,
        w: 420,
        h: 300,
      }
    );
  });

  const publishLayout = (next: DashboardLayoutItem[]) => {
    onLayoutChange(next);
  };

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="relative min-h-[680px] rounded-md bg-background/40">
        {items.map((item) => {
          const itemLayout =
            withDefaults.find((entry) => entry.i === item.id) ?? withDefaults[0];
          return (
            <Rnd
              key={item.id}
              bounds="parent"
              size={{ width: itemLayout.w, height: itemLayout.h }}
              position={{ x: itemLayout.x, y: itemLayout.y }}
              minWidth={320}
              minHeight={220}
              dragHandleClassName="drag-handle"
              onDragStop={(_, data) => {
                publishLayout(
                  withDefaults.map((entry) =>
                    entry.i === item.id ? { ...entry, x: data.x, y: data.y } : entry
                  )
                );
              }}
              onResizeStop={(_, __, ref, ___, position) => {
                publishLayout(
                  withDefaults.map((entry) =>
                    entry.i === item.id
                      ? {
                          ...entry,
                          x: position.x,
                          y: position.y,
                          w: ref.offsetWidth,
                          h: ref.offsetHeight,
                        }
                      : entry
                  )
                );
              }}
            >
              <div className="h-full rounded-lg border bg-background p-2 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <p className="drag-handle cursor-move text-xs font-medium text-muted-foreground">
                    Drag
                  </p>
                  <button
                    type="button"
                    className="no-drag h-6 rounded px-2 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    onClick={() => onRemoveItem(item.id)}
                  >
                    Remove
                  </button>
                </div>
                <ChartCard spec={item.spec} title={item.title} />
              </div>
            </Rnd>
          );
        })}
      </div>
    </div>
  );
}

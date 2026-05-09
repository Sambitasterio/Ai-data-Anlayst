"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import type { PlotlyChartSpec } from "@/lib/plotly-loader";
import { cn } from "@/lib/utils";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type ChartCardProps = {
  spec: PlotlyChartSpec;
  title?: string;
  onPin?: () => void;
};

export function ChartCard({ spec, title = "Chart", onPin }: ChartCardProps) {
  const [isLarge, setIsLarge] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [graphDiv, setGraphDiv] = useState<unknown>(null);

  const mergedLayout = useMemo(
    () => ({
      autosize: true,
      ...spec.layout,
      title: (spec.layout?.title as string) ?? title,
    }),
    [spec.layout, title]
  );

  const cardClass = cn(
    "rounded-lg border bg-card p-3",
    isFullscreen ? "fixed inset-6 z-50 bg-background shadow-2xl" : ""
  );

  const chartHeight = isFullscreen ? 560 : isLarge ? 420 : 280;

  const exportAsPng = async () => {
    if (!graphDiv) {
      return;
    }
    const plotlyModule = await import("plotly.js-dist-min");
    const plotly = (plotlyModule.default ?? plotlyModule) as {
      downloadImage: (
        graph: unknown,
        options: {
          format?: string;
          filename?: string;
          width?: number;
          height?: number;
        }
      ) => Promise<string>;
    };
    await plotly.downloadImage(graphDiv as never, {
      format: "png",
      filename: "ai-data-analyst-chart",
      width: 1200,
      height: 700,
    });
  };

  return (
    <div className={cardClass}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <div className="flex gap-2">
          {onPin ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="no-drag"
              onClick={onPin}
            >
              Pin to Dashboard
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="no-drag"
            onClick={() => setIsLarge((prev) => !prev)}
          >
            {isLarge ? "Compact" : "Resize"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="no-drag"
            onClick={() => setIsFullscreen((prev) => !prev)}
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="no-drag"
            onClick={exportAsPng}
          >
            Export PNG
          </Button>
        </div>
      </div>

      <Plot
        data={spec.data as never}
        layout={mergedLayout as never}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: "100%", height: `${chartHeight}px` }}
        onInitialized={(_, gd) => setGraphDiv(gd)}
        onUpdate={(_, gd) => setGraphDiv(gd)}
      />
    </div>
  );
}

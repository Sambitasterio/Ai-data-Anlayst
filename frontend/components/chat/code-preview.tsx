"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type CodePreviewProps = {
  sql: string;
  python: string;
};

type ActiveTab = "sql" | "python";

export function CodePreview({ sql, python }: CodePreviewProps) {
  const hasSql = sql.trim().length > 0;
  const hasPython = python.trim().length > 0;
  const hasAnyCode = hasSql || hasPython;
  const [activeTab, setActiveTab] = useState<ActiveTab>(hasSql ? "sql" : "python");
  const [highlightedHtml, setHighlightedHtml] = useState("");
  const [copied, setCopied] = useState(false);

  const activeCode = useMemo(
    () => (activeTab === "sql" ? sql : python),
    [activeTab, sql, python]
  );

  useEffect(() => {
    if (!hasAnyCode) {
      setHighlightedHtml("");
      return;
    }

    const run = async () => {
      const response = await fetch("/api/highlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: activeCode,
          language: activeTab,
        }),
      });
      const data = (await response.json()) as { html?: string };
      setHighlightedHtml(data.html ?? "");
    };

    void run();
  }, [activeCode, activeTab, hasAnyCode]);

  if (!hasAnyCode) {
    return null;
  }

  return (
    <details className="rounded-lg border bg-muted/40 p-2">
      <summary className="cursor-pointer text-sm font-medium">Show code</summary>
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={activeTab === "sql" ? "default" : "outline"}
            onClick={() => setActiveTab("sql")}
            disabled={!hasSql}
          >
            SQL
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === "python" ? "default" : "outline"}
            onClick={() => setActiveTab("python")}
            disabled={!hasPython}
          >
            Python
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(activeCode);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            disabled={!activeCode}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        {highlightedHtml ? (
          <div
            className="overflow-x-auto rounded border text-sm"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre className="overflow-x-auto rounded border p-3 text-xs">{activeCode}</pre>
        )}
      </div>
    </details>
  );
}

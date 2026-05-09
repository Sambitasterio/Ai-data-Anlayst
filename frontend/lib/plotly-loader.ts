export type PlotlyChartSpec = {
  data: Record<string, unknown>[];
  layout?: Record<string, unknown>;
};

function normalizeSpecObject(value: unknown): PlotlyChartSpec | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.data)) {
    return null;
  }
  return {
    data: candidate.data as Record<string, unknown>[],
    layout:
      candidate.layout && typeof candidate.layout === "object"
        ? (candidate.layout as Record<string, unknown>)
        : {},
  };
}

export function extractChartSpecFromText(text: string): PlotlyChartSpec | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return normalizeSpecObject(JSON.parse(trimmed));
  } catch {
    // best-effort fallback for python-like dict string output
    try {
      const normalized = trimmed
        .replaceAll("'", '"')
        .replaceAll("True", "true")
        .replaceAll("False", "false")
        .replaceAll("None", "null");
      return normalizeSpecObject(JSON.parse(normalized));
    } catch {
      return null;
    }
  }
}

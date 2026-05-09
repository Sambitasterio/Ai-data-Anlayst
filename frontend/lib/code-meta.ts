export type CodeMeta = {
  sql: string;
  python: string;
  warning?: string;
};

const META_PREFIX = "\n[[CODE_META]]";

export function encodeCodeMeta(text: string, meta: CodeMeta): string {
  return `${text}${META_PREFIX}${JSON.stringify(meta)}`;
}

export function decodeCodeMeta(text: string): { content: string; meta: CodeMeta } {
  const markerIndex = text.lastIndexOf(META_PREFIX);
  if (markerIndex === -1) {
    return {
      content: text,
      meta: { sql: "", python: "", warning: undefined },
    };
  }

  const content = text.slice(0, markerIndex);
  const metaRaw = text.slice(markerIndex + META_PREFIX.length);
  try {
    const parsed = JSON.parse(metaRaw) as Partial<CodeMeta>;
    return {
      content,
      meta: {
        sql: parsed.sql ?? "",
        python: parsed.python ?? "",
        warning: parsed.warning,
      },
    };
  } catch {
    return {
      content: text,
      meta: { sql: "", python: "", warning: undefined },
    };
  }
}

import { codeToHtml } from "shiki";

type HighlightRequest = {
  code: string;
  language: "sql" | "python";
};

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as Partial<HighlightRequest>;
  const code = body.code ?? "";
  const language = body.language ?? "sql";

  if (!code.trim()) {
    return Response.json({ html: "" });
  }

  const html = await codeToHtml(code, {
    lang: language,
    theme: "github-dark",
  });

  return Response.json({ html });
}

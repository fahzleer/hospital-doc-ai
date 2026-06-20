import { type ClassifyResult, classifyResultSchema } from "@app/types";
import { type } from "arktype";

const BASE_URL = Bun.env.OPENAI_BASE_URL ?? "https://api.opentyphoon.ai/v1";
const API_KEY = Bun.env.OPENAI_API_KEY ?? "";
const MODEL = Bun.env.OPENAI_MODEL ?? "typhoon-v2.5-30b-a3b-instruct";
const TIMEOUT_MS = Number(Bun.env.LLM_TIMEOUT_MS ?? "15000");

const SYSTEM_PROMPT = `You are a document classification assistant for a hospital ERP system.
Classify the user's text into exactly one document type:
- work_order: maintenance, repair, broken equipment, facility issues
- contract: vendor contracts, service agreements, procurement contracts
- issue_note: material requisitions, supply withdrawals, inventory requests

Respond ONLY with this exact JSON format, no other text:
{"entityType":"<work_order|contract|issue_note>","confidence":<0.0-1.0>}`;

const KEYWORD_MAP: Array<[ClassifyResult["entityType"], string[]]> = [
  ["work_order", ["repair", "maintenance", "fix", "broken", "fault"]],
  ["contract", ["contract", "vendor", "agreement", "procurement"]],
  ["issue_note", ["issue", "requisition", "supply", "withdraw", "request"]],
];

function keywordFallback(text: string): ClassifyResult | null {
  const lower = text.toLowerCase();
  for (const [entityType, keywords] of KEYWORD_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return { entityType };
    }
  }
  return null;
}

async function callLLM(text: string): Promise<ClassifyResult> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 60,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty content");

  const raw = JSON.parse(content);
  const validated = classifyResultSchema(raw);

  if (validated instanceof type.errors) {
    throw new Error(`LLM output invalid: ${validated.summary}`);
  }

  return validated;
}

export async function classifyDocument(text: string): Promise<ClassifyResult> {
  try {
    return await callLLM(text);
  } catch (err) {
    console.warn(
      "[classify] LLM failed, trying keyword fallback:",
      err instanceof Error ? err.message : err,
    );
  }

  const fallback = keywordFallback(text);
  if (fallback) return fallback;

  throw new Error("cannot_classify");
}

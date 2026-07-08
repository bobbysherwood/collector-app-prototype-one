import OpenAI from "openai";
import type { PortfolioInsightSnapshot } from "@/lib/portfolio-insight-snapshot";
import {
  buildPortfolioInsightsUserMessage,
  PORTFOLIO_INSIGHTS_SYSTEM_PROMPT,
} from "@/lib/portfolio-insights-prompt";
import type { PortfolioInsight, PortfolioInsightType } from "@/types/portfolio-insights";

const INSIGHT_TYPES = new Set<PortfolioInsightType>([
  "performance",
  "risk",
  "opportunity",
  "action",
]);

const MODEL = "gpt-4o-mini";

export interface GeneratedPortfolioInsights {
  insights: PortfolioInsight[];
  summary: string | null;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

function emptyPortfolioInsights(
  snapshot: PortfolioInsightSnapshot
): GeneratedPortfolioInsights {
  return {
    insights: [
      {
        type: "action",
        title: "Add cards to unlock insights",
        body: "Your portfolio has no held cards yet. Add assets and valuations to receive personalized AI observations about performance, risk, and next steps.",
      },
    ],
    summary: "Add holdings to generate portfolio insights.",
    model: "deterministic",
    inputTokens: null,
    outputTokens: null,
  };
}

function parseInsightsResponse(
  content: string,
  snapshot: PortfolioInsightSnapshot
): GeneratedPortfolioInsights {
  const parsed = JSON.parse(content) as {
    insights?: Array<{
      type?: string;
      title?: string;
      body?: string;
    }>;
    summary?: string;
  };

  const insights = (parsed.insights ?? [])
    .filter(
      (insight): insight is PortfolioInsight =>
        typeof insight.type === "string" &&
        INSIGHT_TYPES.has(insight.type as PortfolioInsightType) &&
        typeof insight.title === "string" &&
        typeof insight.body === "string" &&
        insight.title.trim().length > 0 &&
        insight.body.trim().length > 0
    )
    .map((insight) => ({
      type: insight.type,
      title: insight.title.trim(),
      body: insight.body.trim(),
    }))
    .slice(0, 6);

  if (insights.length === 0) {
    throw new Error("OpenAI returned no valid insights.");
  }

  return {
    insights,
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : null,
    model: MODEL,
    inputTokens: null,
    outputTokens: null,
  };
}

export async function generatePortfolioInsightsWithOpenAI(
  snapshot: PortfolioInsightSnapshot
): Promise<GeneratedPortfolioInsights> {
  if (snapshot.summary.heldLotCount === 0) {
    return emptyPortfolioInsights(snapshot);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: PORTFOLIO_INSIGHTS_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildPortfolioInsightsUserMessage(
          JSON.stringify(snapshot, null, 2)
        ),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  const result = parseInsightsResponse(content, snapshot);
  return {
    ...result,
    inputTokens: response.usage?.prompt_tokens ?? null,
    outputTokens: response.usage?.completion_tokens ?? null,
  };
}

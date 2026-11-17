import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
};

const compactText = (value: unknown, maxLength: number) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  const shortened = text.slice(0, maxLength);
  const lastSpace = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, lastSpace > maxLength * 0.8 ? lastSpace : maxLength).trim()}…`;
};

async function askGroq(
  systemPrompt: string,
  userPrompt: string,
  schemaName: string,
  schema: Record<string, unknown>,
) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${requiredEnv("GROQ_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-20b",
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: schemaName,
              strict: true,
              schema,
            },
          },
        }),
      },
    );

    const result = await response.json();
    if (response.ok) {
      return JSON.parse(result.choices[0].message.content);
    }

    const message = result?.error?.message || "The Groq request failed.";
    if (response.status !== 429 || attempt === maxAttempts) {
      throw new Error(message);
    }

    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader && Number.isFinite(Number(retryAfterHeader))
      ? Number(retryAfterHeader)
      : null;
    const retryFromMessage = message.match(/try again in\s+([\d.]+)\s*s/i);
    const delayMs = retryAfterSeconds !== null
      ? retryAfterSeconds * 1000
      : retryFromMessage
      ? Number(retryFromMessage[1]) * 1000
      : Math.min(1000 * 2 ** (attempt - 1), 5000);

    // Keep one attempt bounded; if Groq asks for a longer wait, leave this
    // creator uncategorized so a later sync can retry it.
    if (delayMs > 15000) throw new Error(message);
    const jitterMs = Math.floor(Math.random() * 400);
    await new Promise(resolve => setTimeout(resolve, delayMs + jitterMs));
  }
  throw new Error("The Groq request could not be completed.");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const authorization = request.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "You must be signed in." }, 401);
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");

    const userClient = createClient(
      supabaseUrl,
      requiredEnv("SUPABASE_ANON_KEY"),
      {
        global: {
          headers: { Authorization: authorization },
        },
      },
    );

    const { data: userData, error: userError } =
      await userClient.auth.getUser(authorization.slice(7));

    if (userError || !userData.user) {
      return json({ error: "Your session is invalid." }, 401);
    }

    const admin = createClient(
      supabaseUrl,
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const body = await request.json();
    if (body.action === "categorize") {
      const expectedSecret = requiredEnv("CREATOR_AI_INTERNAL_SECRET");
      if (request.headers.get("x-creator-ai-internal") !== expectedSecret) {
        return json({ error: "Categorization is only available through creator imports and syncs." }, 403);
      }
    }
    const creatorId = String(body.creatorId || "");

    if (!/^\d+$/.test(creatorId)) {
      return json({ error: "A valid creator is required." }, 400);
    }

    if (body.action === "categorize") {
      const [
        { data: creator, error: creatorError },
        { data: types, error: typesError },
      ] = await Promise.all([
        admin
          .from("content_creators")
          .select("first_name, last_name, creator_description")
          .eq("creator_id", creatorId)
          .single(),
        admin
          .from("channel_types")
          .select("type_id, type_name, type_description")
          .order("type_id"),
      ]);

      if (creatorError) throw creatorError;
      if (typesError) throw typesError;
      if (!types?.length) throw new Error("No categories were found.");

      const allowedCategories = types.map((type) => ({
        id: String(type.type_id),
        name: compactText(type.type_name, 80),
        description: compactText(type.type_description, 180),
      }));

      const result = await askGroq(
        `Classify a YouTube creator into exactly one allowed category.
Only use a category ID from the supplied list.
Use Uncategorized when the available information is insufficient.
Give a concise reason of 12 words or fewer.`,
        JSON.stringify({
          creator: {
            name: compactText([creator.first_name, creator.last_name].filter(Boolean).join(" "), 120),
            description: compactText(creator.creator_description, 800),
          },
          allowedCategories,
        }),
        "creator_category",
        {
          type: "object",
          properties: {
            categoryId: {
              type: "string",
              enum: allowedCategories.map((category) => category.id),
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },
            reason: {
              type: "string",
            },
          },
          required: ["categoryId", "confidence", "reason"],
          additionalProperties: false,
        },
      );

      const selectedType = types.find(
        (type) => String(type.type_id) === result.categoryId,
      );

      if (!selectedType) {
        throw new Error("Groq returned an unknown category.");
      }

      const { error: updateError } = await admin
        .from("content_creators")
        .update({
          type_id: selectedType.type_id,
          ai_category_confidence: result.confidence,
          ai_category_reason: result.reason,
        })
        .eq("creator_id", creatorId);

      if (updateError) throw updateError;

      return json({
        category: selectedType.type_name,
        confidence: result.confidence,
        reason: result.reason,
      });
    }

    if (body.action === "summarize_reviews") {
      const { data: reviews, error: reviewsError } = await admin
        .from("reviews")
        .select(
          "overall_rating, profanity, substance_use, age_level, review_text, bias_text, created_at",
        )
        .eq("creator_id", creatorId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (reviewsError) throw reviewsError;

      if (!reviews?.length) {
        return json({ error: "This creator has no reviews." }, 400);
      }

      const result = await askGroq(
        `Summarize community reviews neutrally and accurately.
Do not add facts that are absent from the reviews.
Mention both common praise and common concerns when present.
Write two or three concise sentences.
Do not identify individual reviewers.`,
        JSON.stringify({ reviews }),
        "review_summary",
        {
          type: "object",
          properties: {
            summary: {
              type: "string",
            },
          },
          required: ["summary"],
          additionalProperties: false,
        },
      );

      const { error: updateError } = await admin
        .from("content_creators")
        .update({
          ai_review_summary: result.summary,
          ai_summary_review_count: reviews.length,
          ai_summary_updated_at: new Date().toISOString(),
        })
        .eq("creator_id", creatorId);

      if (updateError) throw updateError;

      return json({
        summary: result.summary,
        reviewCount: reviews.length,
      });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("creator-ai failed:", error);

    return json(
      {
        error: error instanceof Error
          ? error.message
          : "The AI request failed.",
      },
      500,
    );
  }
});

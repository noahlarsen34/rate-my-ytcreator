import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-creator-ai-internal",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
};

const wait = (milliseconds: number) =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

Deno.serve(async request => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return json({ error: "You must be signed in." }, 401);
    }

    const internalSecret = requiredEnv("CREATOR_AI_INTERNAL_SECRET");
    if (request.headers.get("x-creator-ai-internal") !== internalSecret) {
      return json({ error: "This batch action is restricted." }, 403);
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(
      authorization.slice(7),
    );
    if (userError || !userData.user) {
      return json({ error: "Your session is invalid." }, 401);
    }

    const admin = createClient(
      supabaseUrl,
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: types, error: typeError } = await admin
      .from("channel_types")
      .select("type_id, type_name")
      .order("type_id");
    if (typeError) throw typeError;
    const uncategorized = (types || []).find((type: { type_name: string }) =>
      String(type.type_name || "").trim().toLowerCase() === "uncategorized"
    );
    if (!uncategorized) {
      return json({ error: "The Uncategorized channel type was not found." }, 400);
    }

    // Confidence is written for every completed AI decision, including when
    // the AI decides the available information is insufficient. This lets a
    // later batch skip completed decisions and continue through the queue.
    const { data: creators, error: creatorError } = await admin
      .from("content_creators")
      .select("creator_id")
      .eq("type_id", uncategorized.type_id)
      .is("ai_category_confidence", null)
      .order("creator_id", { ascending: true })
      .limit(10);
    if (creatorError) throw creatorError;

    const creatorIds = (creators || []).map((creator: { creator_id: number }) =>
      String(creator.creator_id)
    );
    if (!creatorIds.length) {
      return json({
        processed: 0,
        categorized: 0,
        leftUncategorized: 0,
        failed: 0,
        remaining: 0,
        message: "No unattempted Uncategorized creators were found.",
      });
    }

    let categorized = 0;
    let leftUncategorized = 0;
    let failed = 0;
    const results: Array<Record<string, unknown>> = [];
    const baseUrl = supabaseUrl.replace(/\/$/, "");
    const batchStartedAt = Date.now();
    const maxBatchRuntimeMs = 120_000;
    // creator-ai may wait for Groq's 429 retry window twice before returning.
    const maxCreatorAttemptWindowMs = 31_000;

    for (let index = 0; index < creatorIds.length; index += 1) {
      if (Date.now() - batchStartedAt + maxCreatorAttemptWindowMs > maxBatchRuntimeMs) {
        break;
      }
      const creatorId = creatorIds[index];
      try {
        const response = await fetch(`${baseUrl}/functions/v1/creator-ai`, {
          method: "POST",
          headers: {
            Authorization: authorization,
            apikey: anonKey,
            "x-creator-ai-internal": internalSecret,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "categorize", creatorId }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result?.error) {
          throw new Error(result?.error || `creator-ai returned ${response.status}.`);
        }

        if (String(result.category || "").trim().toLowerCase() === "uncategorized") {
          leftUncategorized += 1;
          results.push({ creatorId, status: "left_uncategorized" });
        } else {
          categorized += 1;
          results.push({ creatorId, status: "categorized", category: result.category });
        }
      } catch (error) {
        failed += 1;
        console.error(`Batch categorization failed for creator ${creatorId}:`, error);
        results.push({
          creatorId,
          status: "failed",
          error: error instanceof Error ? error.message : "Categorization failed.",
        });
      }

      if (index < creatorIds.length - 1) await wait(10_000);
    }

    const { count: remaining, error: remainingError } = await admin
      .from("content_creators")
      .select("creator_id", { count: "exact", head: true })
      .eq("type_id", uncategorized.type_id)
      .is("ai_category_confidence", null);
    if (remainingError) throw remainingError;

    return json({
      processed: results.length,
      deferred: creatorIds.length - results.length,
      categorized,
      leftUncategorized,
      failed,
      remaining: remaining || 0,
      results,
    });
  } catch (error) {
    console.error("categorize-uncategorized-batch failed:", error);
    return json({
      error: error instanceof Error ? error.message : "The batch failed.",
    }, 500);
  }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENGINE_URL = "https://jack-jill-engine-api-production.up.railway.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ENGINE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ENGINE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { slug, data, stream } = await req.json();

    if (!slug || !data) {
      return new Response(JSON.stringify({ error: "Missing slug or data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    let engineRes: Response;
    try {
      engineRes = await fetch(`${ENGINE_URL}/run/${slug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({ data }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeout);
      const msg = e instanceof Error && e.name === "AbortError"
        ? "Request to engine timed out"
        : String(e);
      return new Response(JSON.stringify({ error: msg }), {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!engineRes.ok) {
      clearTimeout(timeout);
      const errText = await engineRes.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: engineRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream mode: pass the SSE stream through to keep the connection alive
    if (stream) {
      clearTimeout(timeout);
      return new Response(engineRes.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Non-stream: buffer and extract the token event (original behavior)
    const reader = engineRes.body!.getReader();
    const decoder = new TextDecoder();
    let tokenContent: string | null = null;
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === "token") {
            tokenContent = event.content;
          }
          if (event.type === "error") {
            clearTimeout(timeout);
            return new Response(JSON.stringify({ error: event.content }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }

    clearTimeout(timeout);

    if (tokenContent === null) {
      return new Response(JSON.stringify({ error: "No token event received from engine" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ content: tokenContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

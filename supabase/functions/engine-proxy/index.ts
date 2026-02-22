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

    const { slug, data } = await req.json();

    if (!slug || !data) {
      return new Response(JSON.stringify({ error: "Missing slug or data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call the Railway engine with SSE
    const engineRes = await fetch(`${ENGINE_URL}/run/${slug}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ data }),
    });

    if (!engineRes.ok) {
      const errText = await engineRes.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: engineRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse SSE stream and extract the token event
    const reader = engineRes.body!.getReader();
    const decoder = new TextDecoder();
    let tokenContent: string | null = null;
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === "token") {
            tokenContent = event.content;
          }
          if (event.type === "error") {
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

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Shared secret sent by the Airtable automation as the x-webhook-secret header.
// Set it with: Supabase Dashboard → Edge Functions → Secrets → AIRTABLE_WEBHOOK_SECRET.
// Fails closed: with the secret unset, every request is refused.
async function hasValidSecret(req: Request): Promise<boolean> {
  const expected = Deno.env.get("AIRTABLE_WEBHOOK_SECRET");
  const got = req.headers.get("x-webhook-secret");
  if (!expected || !got) return false;
  // Compare SHA-256 digests in constant time so neither length nor content leaks.
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(got)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!(await hasValidSecret(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await supabase.from("form_submissions").insert({
    form_name: body.form_name,
    program: body.program ?? null,
    submission_type: body.submission_type ?? null,
    airtable_record_id: body.record_id ?? null,
    payload: body,
  });

  if (error) {
    console.error("Insert error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});

// Supabase Edge Function – Telegram Notifier
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  // Allow only POST
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!BOT_TOKEN || !CHAT_ID) {
    return new Response(
      JSON.stringify({ error: "Missing TELEGRAM secrets" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let messageText = "🔔 Someone sent you a message. Open the chat.";

  // Optional JSON payload from frontend
  try {
    const body = await req.json();
    if (body?.text) {
      messageText = body.text;
    }
  } catch {
    // ignore body parse errors
  }

  const telegramResponse = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: messageText,
      }),
    }
  );

  const telegramResult = await telegramResponse.json();

  return new Response(
    JSON.stringify({
      success: true,
      telegram: telegramResult,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});

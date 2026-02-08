import { serve } from "https://deno.land/std/http/server.ts";

serve(async () => {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!token || !chatId) {
    return new Response("Missing secrets", { status: 500 });
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🔔 Someone sent you a message. Open the chat to reply."
    })
  });

  return new Response("OK");
});

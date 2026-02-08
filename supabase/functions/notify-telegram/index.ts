import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const { content } = await req.json();

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  const text = `🔔 New message received.\n\nOpen the chat to reply.`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  return new Response("OK");
});

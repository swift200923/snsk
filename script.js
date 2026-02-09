/* ===== CONFIG ===== */
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWJhcmJqbXJ5am9xZmV4dXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NjQyNjUsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";

const SECRET_PASS = "dada";
const WIPE_TRIGGER = "808801";
/* ================== */

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* LOCAL SENDER ID */
let senderId = localStorage.getItem("sender_id");
if (!senderId) {
  senderId = crypto.randomUUID();
  localStorage.setItem("sender_id", senderId);
}

/* ELEMENTS */
const authOverlay = document.getElementById("auth-overlay");
const chatContainer = document.getElementById("chat-container");
const passInput = document.getElementById("pass-input");
const messagesBox = document.getElementById("messages");
const msgInput = document.getElementById("msg-input");

let channel;

/* LOGIN */
document.getElementById("login-btn").onclick = async () => {
  if (passInput.value !== SECRET_PASS) {
    alert("Wrong password");
    return;
  }

  authOverlay.style.display = "none";
  chatContainer.style.display = "flex";

  await loadMessages();
  initRealtime();
};

/* REALTIME */
function initRealtime() {
  if (channel) return;

  channel = supabaseClient
    .channel("messages-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      payload => {
        const msg = payload.new;

        if (msg.kind === "wipe") {
          messagesBox.innerHTML = "";
          return;
        }

        renderMessage(msg);
        scrollBottom();
      }
    )
    .subscribe();
}

/* LOAD */
async function loadMessages() {
  const { data } = await supabaseClient
    .from("messages")
    .select("*")
    .order("created_at");

  messagesBox.innerHTML = "";
  data.filter(m => m.kind === "user").forEach(renderMessage);
}

/* RENDER */
function renderMessage(msg) {
  const div = document.createElement("div");
  div.className = "msg " + (msg.sender_id === senderId ? "mine" : "theirs");

  if (msg.type === "audio") {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = msg.content;
    div.appendChild(audio);
  } else {
    div.textContent = msg.content;
  }

  messagesBox.appendChild(div);
}

/* SEND TEXT */
document.getElementById("send-btn").onclick = async () => {
  const text = msgInput.value.trim();
  if (!text) return;

  if (text === WIPE_TRIGGER) {
    await supabaseClient.from("messages").insert({ kind: "wipe" });
    await supabaseClient.from("messages").delete().neq("id", 0);
    messagesBox.innerHTML = "";
    msgInput.value = "";
    return;
  }

  await supabaseClient.from("messages").insert({
    kind: "user",
    type: "text",
    content: text,
    sender_id: senderId
  });

  fetch(`${SUPABASE_URL}/functions/v1/notify-telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({})
  });

  msgInput.value = "";
};

/* 🎙 VOICE NOTES */
let recorder;
let chunks = [];

document.getElementById("record-btn").onclick = async () => {
  if (!recorder) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = e => chunks.push(e.data);

    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      chunks = [];

      const name = `${Date.now()}-${senderId}.webm`;
      await supabaseClient.storage.from("voice-notes").upload(name, blob);
      const { data } = supabaseClient.storage.from("voice-notes").getPublicUrl(name);

      await supabaseClient.from("messages").insert({
        kind: "user",
        type: "audio",
        content: data.publicUrl,
        sender_id: senderId
      });
    };

    recorder.start();
    record-btn.textContent = "⏹";
  } else {
    recorder.stop();
    recorder = null;
    record-btn.textContent = "🎙";
  }
};

/* SCROLL */
function scrollBottom() {
  requestAnimationFrame(() => {
    messagesBox.scrollTop = messagesBox.scrollHeight;
  });
}

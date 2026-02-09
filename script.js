document.addEventListener("DOMContentLoaded", () => {

/* ===== CONFIG ===== */
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";

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
const loginBtn = document.getElementById("login-btn");
const sendBtn = document.getElementById("send-btn");

let channel = null;
let loggedIn = false;

/* ================= LOGIN ================= */
loginBtn.addEventListener("click", async () => {
  const entered = passInput.value.trim().toLowerCase();

  if (entered !== SECRET_PASS.toLowerCase()) {
    alert("Wrong password");
    return;
  }

  loggedIn = true;
  authOverlay.style.display = "none";
  chatContainer.style.display = "flex";

  await loadMessages();
  initRealtime();
});

/* ================= REALTIME ================= */
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

/* ================= LOAD ================= */
async function loadMessages() {
  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .order("created_at");

  if (error) {
    console.error("Load error:", error);
    return;
  }

  messagesBox.innerHTML = "";
  // Filter for user messages specifically as per your original logic
  data.filter(m => m.kind === "user").forEach(renderMessage);
  scrollBottom();
}

/* ================= RENDER ================= */
function renderMessage(msg) {
  const div = document.createElement("div");
  div.className = "msg " + (msg.sender_id === senderId ? "mine" : "theirs");
  div.textContent = msg.content;
  messagesBox.appendChild(div);
}

/* ================= SEND ================= */
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  // Handle Wipe Trigger
  if (text === WIPE_TRIGGER) {
    await supabaseClient.from("messages").insert({ kind: "wipe" });
    await supabaseClient.from("messages").delete().neq("id", 0);
    messagesBox.innerHTML = "";
    msgInput.value = "";
    return;
  }

  // Clear input immediately for better UX
  msgInput.value = "";

  const { error } = await supabaseClient.from("messages").insert({
    kind: "user",
    type: "text",
    content: text,
    sender_id: senderId
  });

  if (error) {
    console.error("Insert error:", error);
    return;
  }

  // Notification call (wrapped in try/catch to prevent breaking the flow)
  try {
    fetch(`${SUPABASE_URL}/functions/v1/notify-telegram`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({})
    });
  } catch (e) {
    console.warn("Notification function failed or not found.");
  }
}

/* EVENT LISTENERS FOR SENDING */
sendBtn.addEventListener("click", (e) => {
  e.preventDefault();
  sendMessage();
});

msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

/* ================= LOCK SESSION ================= */
function lockSession() {
  if (!loggedIn) return;

  loggedIn = false;

  if (channel) {
    supabaseClient.removeChannel(channel);
    channel = null;
  }

  messagesBox.innerHTML = "";
  chatContainer.style.display = "none";
  authOverlay.style.display = "flex";
  passInput.value = "";
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) lockSession();
});

window.addEventListener("pagehide", () => {
  lockSession();
});

/* ================= SCROLL ================= */
function scrollBottom() {
  requestAnimationFrame(() => {
    messagesBox.scrollTop = messagesBox.scrollHeight;
  });
}

});

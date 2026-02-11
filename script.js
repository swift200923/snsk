/* ===== CONFIG ===== */
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";

const SECRET_PASS = "dada";
/* ================== */

const supabase = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* sender id */
let senderId = localStorage.getItem("sender_id");
if (!senderId) {
  senderId = crypto.randomUUID();
  localStorage.setItem("sender_id", senderId);
}

/* ELEMENTS (SAFE LOOKUP) */
const authOverlay = document.getElementById("auth-overlay");
const chatContainer = document.getElementById("chat-container");
const passInput = document.getElementById("pass-input");
const loginBtn = document.getElementById("login-btn");
const messagesBox = document.getElementById("messages");
const msgInput = document.getElementById("msg-input");
const sendBtn = document.getElementById("send-btn");

if (!loginBtn || !passInput) {
  alert("Login elements missing. Hard refresh the page.");
  throw new Error("Login elements not found");
}

let channel = null;

/* ================= LOGIN ================= */
loginBtn.addEventListener("click", async () => {
  const entered = passInput.value.trim();

  console.log("Entered password:", entered);

  if (entered !== SECRET_PASS) {
    alert("Wrong password");
    return;
  }

  // LOGIN SUCCESS
  authOverlay.style.display = "none";
  chatContainer.style.display = "flex";

  await loadMessages();
  initRealtime();
});

/* ================= REALTIME ================= */
function initRealtime() {
  if (channel) return;

  channel = supabase
    .channel("messages-room")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      payload => {
        renderMessage(payload.new);
        scrollBottom();
      }
    )
    .subscribe();
}

/* ================= LOAD ================= */
async function loadMessages() {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("created_at");

  if (error) {
    console.error("Load error:", error);
    return;
  }

  messagesBox.innerHTML = "";
  data.forEach(renderMessage);
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
sendBtn.addEventListener("click", async () => {
  const text = msgInput.value.trim();
  if (!text) return;

  const { error } = await supabase.from("messages").insert({
    content: text,
    sender_id: senderId
  });

  if (error) {
    console.error("Insert error:", error);
    alert("Message failed");
    return;
  }

  // Telegram notify
  fetch(`${SUPABASE_URL}/functions/v1/dynamic-handler`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({
      text: "🔔 New chat message received"
    })
  });

  msgInput.value = "";
});

/* ================= LOCK ON TAB HIDE ================= */
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;

  messagesBox.innerHTML = "";
  chatContainer.style.display = "none";
  authOverlay.style.display = "flex";
  passInput.value = "";

  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
});

/* ================= SCROLL ================= */
function scrollBottom() {
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

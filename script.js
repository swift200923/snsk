const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";
const SECRET_PASS = "dada";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* sender id */
let senderId = localStorage.getItem("sender_id");
if (!senderId) {
  senderId = crypto.randomUUID();
  localStorage.setItem("sender_id", senderId);
}

/* elements */
const authOverlay = document.getElementById("auth-overlay");
const chatContainer = document.getElementById("chat-container");
const passInput = document.getElementById("pass-input");
const loginBtn = document.getElementById("login-btn");
const messagesBox = document.getElementById("messages");
const msgInput = document.getElementById("msg-input");
const sendBtn = document.getElementById("send-btn");
let channel = null;

/* LOGIN */
loginBtn.onclick = async () => {
  if (passInput.value.trim() !== SECRET_PASS) {
    alert("Wrong password");
    return;
  }
  authOverlay.style.display = "none";
  chatContainer.style.display = "flex";
  loadMessages();
  initRealtime();
};

/* REALTIME */
function initRealtime() {
  if (channel) return;
  channel = client
    .channel("messages-room")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      payload => {
        renderMessage(payload.new);
      }
    )
    .subscribe();
}

/* LOAD */
async function loadMessages() {
  const { data } = await client
    .from("messages")
    .select("*")
    .order("created_at");
  messagesBox.innerHTML = "";
  data.forEach(renderMessage);
}

/* RENDER */
function renderMessage(msg) {
  const div = document.createElement("div");
  div.className = "msg " + (msg.sender_id === senderId ? "mine" : "theirs");
  div.textContent = msg.content;
  messagesBox.appendChild(div);
}

/* SEND */
sendBtn.onclick = async () => {
  const text = msgInput.value.trim();
  if (!text) return;
  await client.from("messages").insert({
    content: text,
    sender_id: senderId
  });
  
  /* Telegram Notification */
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
};

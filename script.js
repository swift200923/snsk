/* ===== CONFIG ===== */
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";
const SECRET_PASS = "dada"; 

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* local identity for left/right alignment */
let senderId = localStorage.getItem("sender_id");
if (!senderId) {
  senderId = crypto.randomUUID();
  localStorage.setItem("sender_id", senderId);
}

/* UI ELEMENTS */
const authOverlay = document.getElementById("auth-overlay");
const chatContainer = document.getElementById("chat-container");
const passInput = document.getElementById("pass-input");
const messagesBox = document.getElementById("messages");
const msgInput = document.getElementById("msg-input");
const loginBtn = document.getElementById("login-btn");
const sendBtn = document.getElementById("send-btn");

let channel = null;

/* LOGIN */
loginBtn.onclick = async () => {
  const entered = passInput.value.trim().toLowerCase();
  if (entered !== SECRET_PASS.toLowerCase()) {
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
  channel = client
    .channel("messages-room")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, 
    payload => {
      renderMessage(payload.new);
    })
    .subscribe();
}

/* LOAD */
async function loadMessages() {
  const { data } = await client.from("messages").select("*").order("created_at");
  messagesBox.innerHTML = "";
  if (data) data.forEach(renderMessage);
  scrollBottom();
}

/* RENDER */
function renderMessage(msg) {
  const div = document.createElement("div");
  // mine = right side, theirs = left side
  div.className = "msg " + (msg.sender_id === senderId ? "mine" : "theirs");
  div.textContent = msg.content;
  messagesBox.appendChild(div);
  scrollBottom();
}

/* SEND MESSAGE */
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  // 1. Insert into Database first
  const { error } = await client.from("messages").insert({ 
    content: text, 
    sender_id: senderId 
  });

  if (error) {
    console.error("Database Error:", error);
    alert("Failed to send to DB: " + error.message);
    return;
  }

  // 2. Clear input immediately
  msgInput.value = "";

  // 3. Trigger Telegram (optional, won't stop the chat if it fails)
  fetch(`${SUPABASE_URL}/functions/v1/dynamic-handler`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ text: "🔔 New message in Chat Console" })
  }).catch(e => console.log("Telegram notification failed. Check Edge Function logs."));
}

sendBtn.onclick = sendMessage;

/* DESKTOP ENTER KEY */
msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

function scrollBottom() {
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

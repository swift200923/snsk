/* ===== CONFIG ===== */
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";
const SECRET_PASS = "dada"; 

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* sender id for left/right alignment */
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

/* LOGIN LOGIC */
loginBtn.onclick = async () => {
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
};

/* REALTIME SYNC */
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

/* LOAD HISTORY */
async function loadMessages() {
  const { data } = await client.from("messages").select("*").order("created_at");
  messagesBox.innerHTML = "";
  if (data) data.forEach(renderMessage);
  scrollBottom();
}

/* RENDER MESSAGE */
function renderMessage(msg) {
  const div = document.createElement("div");
  // Aligns your messages to the right, others to the left
  div.className = "msg " + (msg.sender_id === senderId ? "mine" : "theirs");
  div.textContent = msg.content;
  messagesBox.appendChild(div);
  scrollBottom();
}

/* SEND MESSAGE */
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  const { error } = await client.from("messages").insert({ 
    content: text, 
    sender_id: senderId 
  });

  if (!error) {
    msgInput.value = "";
    
    // Trigger Telegram Notification
    fetch(`${SUPABASE_URL}/functions/v1/dynamic-handler`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ text: "🔔 New message in Chat Console" })
    });
  }
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

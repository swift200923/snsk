// 1. CONFIG - Verify these match your Supabase Dashboard EXACTLY
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWJhcmJqbXJ5am9xZmV4dXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NjQyNjUsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";
const SECRET_PASS = "dada"; 

// 2. INITIALIZATION
// We use the global 'supabase' object provided by the CDN link in your index.html
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Local ID for chat alignment
let senderId = localStorage.getItem("sender_id") || crypto.randomUUID();
localStorage.setItem("sender_id", senderId);

const authOverlay = document.getElementById("auth-overlay");
const chatContainer = document.getElementById("chat-container");
const passInput = document.getElementById("pass-input");
const messagesBox = document.getElementById("messages");
const msgInput = document.getElementById("msg-input");
const loginBtn = document.getElementById("login-btn");
const sendBtn = document.getElementById("send-btn");

let channel = null;

/* LOGIN LOGIC */
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

/* REALTIME SYNC */
function initRealtime() {
  if (channel) return;
  channel = client
    .channel("public-room")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, 
    payload => {
      renderMessage(payload.new);
    })
    .subscribe();
}

/* LOAD HISTORY */
async function loadMessages() {
  const { data, error } = await client.from("messages").select("*").order("created_at");
  if (error) {
    console.error("API Key Error or DB Error:", error.message);
    alert("Supabase Error: " + error.message);
    return;
  }
  messagesBox.innerHTML = "";
  if (data) data.forEach(renderMessage);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

/* RENDER MESSAGE */
function renderMessage(msg) {
  const div = document.createElement("div");
  div.className = "msg " + (msg.sender_id === senderId ? "mine" : "theirs");
  div.textContent = msg.content;
  messagesBox.appendChild(div);
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

/* SEND MESSAGE */
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  const { error } = await client.from("messages").insert({ 
    content: text, 
    sender_id: senderId 
  });

  if (error) {
    alert("Send Error: " + error.message);
  } else {
    msgInput.value = "";
    // Telegram trigger
    fetch(`${SUPABASE_URL}/functions/v1/dynamic-handler`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ text: "🔔 New message received!" })
    }).catch(e => console.log("Telegram silent."));
  }
}

sendBtn.onclick = sendMessage;
msgInput.onkeydown = (e) => { if (e.key === "Enter") sendMessage(); };

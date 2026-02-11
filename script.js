/* ===== CONFIG ===== */
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";
const SECRET_PASS = "dada"; 
const WIPE_TRIGGER = "808801"; // The Panic Code

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Local Identity for Left/Right Chat Bubbles */
let senderId = localStorage.getItem("sender_id") || crypto.randomUUID();
localStorage.setItem("sender_id", senderId);

/* UI Elements */
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
    .channel("public-room")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, 
    payload => {
      const msg = payload.new;
      
      // 🔥 THE FIX: If a wipe signal arrives, clear the UI instantly on ALL devices
      if (msg.content === WIPE_TRIGGER) {
        messagesBox.innerHTML = "";
      } else {
        renderMessage(msg);
        scrollBottom();
      }
    })
    .subscribe();
}

/* LOAD HISTORY */
async function loadMessages() {
  const { data, error } = await client.from("messages").select("*").order("created_at");
  if (error) return;

  messagesBox.innerHTML = "";
  if (data) {
    // If the latest message is a wipe, don't show history
    const isWiped = data.some(m => m.content === WIPE_TRIGGER);
    if (!isWiped) {
        data.forEach(renderMessage);
    }
  }
  scrollBottom();
}

/* RENDER MESSAGE */
function renderMessage(msg) {
  const div = document.createElement("div");
  div.className = "msg " + (msg.sender_id === senderId ? "mine" : "theirs");
  div.textContent = msg.content;
  messagesBox.appendChild(div);
}

/* SEND MESSAGE FUNCTION */
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text) return;

  // 🔥 THE FIX: If I type the wipe code, broadcast it THEN delete from DB
  if (text === WIPE_TRIGGER) {
    // 1. Send the "signal" so the other person's screen clears instantly
    await client.from("messages").insert({ content: WIPE_TRIGGER, sender_id: senderId });
    // 2. Actually wipe the database rows
    await client.from("messages").delete().neq("id", 0);
    messagesBox.innerHTML = "";
    msgInput.value = "";
    return;
  }

  const { error } = await client.from("messages").insert({ 
    content: text, 
    sender_id: senderId 
  });

  if (!error) {
    msgInput.value = "";
    // Telegram trigger (remains unchanged)
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

/* DESKTOP ENTER KEY */
msgInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

/* SCROLL */
function scrollBottom() {
  requestAnimationFrame(() => {
    messagesBox.scrollTop = messagesBox.scrollHeight;
  });
}

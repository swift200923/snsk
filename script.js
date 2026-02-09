document.addEventListener("DOMContentLoaded", () => {

const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";

const SECRET_PASS = "dada";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

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
let loggedIn = false;

/* LOGIN */
loginBtn.onclick = async () => {
  if (passInput.value.trim() !== SECRET_PASS) {
    alert("Wrong password");
    return;
  }

  loggedIn = true;
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
        renderMessage(payload.new);
        scrollBottom();
      }
    )
    .subscribe();
}

/* LOAD */
async function loadMessages() {
  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .order("created_at");

  if (error) {
    console.error(error);
    return;
  }

  messagesBox.innerHTML = "";
  data.forEach(renderMessage);
  scrollBottom();
}

/* RENDER */
function renderMessage(msg) {
  const div = document.createElement("div");
  div.className = "msg " + (msg.sender_id === senderId ? "mine" : "theirs");
  div.textContent = msg.content;
  messagesBox.appendChild(div);
}

/* SEND (BUTTON ONLY) */
sendBtn.onclick = async () => {
  const text = msgInput.value.trim();
  if (!text) return;

  const { error } = await supabaseClient.from("messages").insert({
    content: text,
    sender_id: senderId
  });

  if (error) {
    console.error(error);
    return;
  }

  msgInput.value = "";
};

/* LOCK ONLY WHEN TAB REALLY HIDES */
document.addEventListener("visibilitychange", () => {
  if (!loggedIn) return;
  if (!document.hidden) return;

  loggedIn = false;
  messagesBox.innerHTML = "";
  chatContainer.style.display = "none";
  authOverlay.style.display = "flex";
  passInput.value = "";

  if (channel) {
    supabaseClient.removeChannel(channel);
    channel = null;
  }
});

/* scroll */
function scrollBottom() {
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

});

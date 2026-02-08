/* ===== CONFIG ===== */
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWJhcmJqbXJ5am9xZmV4dXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NjQyNjUsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";

const SECRET_PASS = "chamar";
const WIPE_TRIGGER = "808801";
/* ================== */

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ELEMENTS */
const authOverlay = document.getElementById("auth-overlay");
const chatContainer = document.getElementById("chat-container");
const passInput = document.getElementById("pass-input");
const messagesBox = document.getElementById("messages");
const msgInput = document.getElementById("msg-input");

let channel = null;
let isLoggedIn = false;

/* LOGIN */
document.getElementById("login-btn").onclick = () => {
  if (passInput.value !== SECRET_PASS) {
    alert("Wrong password");
    return;
  }

  isLoggedIn = true;
  authOverlay.style.display = "none";
  chatContainer.style.display = "flex";

  initRealtime();
  loadMessages();
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
        if (payload.new.type === "wipe") {
          hardReset();
          return;
        }

        addMessage(payload.new);
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
  data
    .filter(m => m.type === "message")
    .forEach(addMessage);

  scrollBottom();
}

/* ADD */
function addMessage(msg) {
  const div = document.createElement("div");
  div.className = "msg";
  div.textContent = msg.content;
  messagesBox.appendChild(div);
}

/* SEND */
document.getElementById("send-btn").onclick = async () => {
  const text = msgInput.value.trim();
  if (!text) return;

  // GLOBAL WIPE COMMAND
  if (text === WIPE_TRIGGER) {
    await supabaseClient.from("messages").insert({
      type: "wipe",
      content: ""
    });
    msgInput.value = "";
    return;
  }

  await supabaseClient.from("messages").insert({
    content: text
  });

  msgInput.value = "";
};

/* HARD RESET (LOCAL + DB) */
async function hardReset() {
  messagesBox.innerHTML = "";

  await supabaseClient
    .from("messages")
    .delete()
    .neq("type", "wipe");

  resetSession();
}

/* RESET SESSION */
function resetSession() {
  if (!isLoggedIn) return;

  isLoggedIn = false;

  if (channel) {
    supabaseClient.removeChannel(channel);
    channel = null;
  }

  chatContainer.style.display = "none";
  authOverlay.style.display = "flex";
  passInput.value = "";
}

/* TAB / APP BACKGROUND */
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    supabaseClient.from("messages").insert({ type: "wipe" });
  }
});

/* SCROLL */
function scrollBottom() {
  requestAnimationFrame(() => {
    messagesBox.scrollTop = messagesBox.scrollHeight;
  });
}

/* ===== CONFIG ===== */
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWJhcmJqbXJ5am9xZmV4dXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NjQyNjUsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";

const SECRET_PASS = "chamar";
const WIPE_TRIGGER = "808801";
/* ================== */

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/* ELEMENTS */
const authOverlay = document.getElementById("auth-overlay");
const chatContainer = document.getElementById("chat-container");
const passInput = document.getElementById("pass-input");
const messagesBox = document.getElementById("messages");
const msgInput = document.getElementById("msg-input");

let channel = null;
let isLoggedIn = false;
let firstMessageSent = false;

/* LOGIN */
document.getElementById("login-btn").onclick = async () => {
  if (passInput.value !== SECRET_PASS) {
    alert("Wrong password");
    return;
  }

  isLoggedIn = true;
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

        // 🔥 GLOBAL WIPE COMMAND
        if (msg.kind === "wipe") {
          messagesBox.innerHTML = "";
          return;
        }

        // system message (shown locally only)
        if (msg.kind === "system") return;

        addMessage(msg);
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

  const userMessages = data.filter(m => m.kind === "user");
  userMessages.forEach(addMessage);

  firstMessageSent = userMessages.length > 0;
  scrollBottom();
}

/* ADD MESSAGE */
function addMessage(msg) {
  const div = document.createElement("div");
  div.className = "msg";
  div.textContent = msg.content;
  messagesBox.appendChild(div);
}

/* SHOW ONE-TIME SYSTEM MESSAGE */
function showWaitMessageOnce() {
  const div = document.createElement("div");
  div.className = "msg";
  div.style.opacity = "0.6";
  div.textContent = "wait for the Chamar";

  messagesBox.appendChild(div);
  scrollBottom();

  setTimeout(() => {
    div.remove();
  }, 3000);
}

/* SEND */
document.getElementById("send-btn").onclick = async () => {
  const text = msgInput.value.trim();
  if (!text) return;

  // 🔥 GLOBAL WIPE (SYNCED)
  if (text === WIPE_TRIGGER) {
    await supabaseClient.from("messages").insert({
      kind: "wipe",
      content: ""
    });

    await supabaseClient.from("messages").delete().neq("id", 0);

    messagesBox.innerHTML = "";
    msgInput.value = "";
    return;
  }

  // 🔔 SHOW SYSTEM MESSAGE ONLY ON FIRST MESSAGE EVER
  if (!firstMessageSent) {
    showWaitMessageOnce();
    firstMessageSent = true;
  }

  // Insert normal message
  await supabaseClient.from("messages").insert({
    kind: "user",
    content: text
  });

  // 🔔 TELEGRAM NOTIFICATION (UNCHANGED)
  fetch(`${SUPABASE_URL}/functions/v1/notify-telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({})
  });

  msgInput.value = "";
};

/* RESET SESSION (LOCAL ONLY) */
function resetSession() {
  if (!isLoggedIn) return;

  isLoggedIn = false;

  if (channel) {
    supabaseClient.removeChannel(channel);
    channel = null;
  }

  messagesBox.innerHTML = "";
  chatContainer.style.display = "none";
  authOverlay.style.display = "flex";
  passInput.value = "";
}

/* AUTO RESET ON LEAVE (NO GLOBAL DELETE HERE) */
document.addEventListener("visibilitychange", () => {
  if (document.hidden) resetSession();
});

window.addEventListener("beforeunload", () => {
  resetSession();
});

/* SCROLL */
function scrollBottom() {
  requestAnimationFrame(() => {
    messagesBox.scrollTop = messagesBox.scrollHeight;
  });
}

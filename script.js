/* ===== CONFIG ===== */
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWJhcmJqbXJ5am9xZmV4dXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NjQyNjUsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";

const SECRET_PASS = "chamar";
const DELETE_TRIGGER = "808801";
/* ================== */

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    realtime: {
      params: { eventsPerSecond: 50 }
    }
  }
);

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

/* INIT REALTIME */
function initRealtime() {
  if (channel) return;

  channel = supabaseClient
    .channel("messages-realtime")
    // INSERT
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      payload => {
        addMessage(payload.new);
        scrollBottom();
      }
    )
    // DELETE (🔥 THIS IS THE FIX)
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "messages" },
      () => {
        messagesBox.innerHTML = "";
      }
    )
    .subscribe(status => {
      console.log("Realtime status:", status);
    });
}

/* LOAD HISTORY */
async function loadMessages() {
  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return console.error(error);

  messagesBox.innerHTML = "";
  data.forEach(addMessage);
  scrollBottom();
}

/* ADD MESSAGE */
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

  // SECRET DELETE
  if (text === DELETE_TRIGGER) {
    await wipeConversation();
    msgInput.value = "";
    return;
  }

  const { error } = await supabaseClient
    .from("messages")
    .insert({ content: text });

  if (error) {
    console.error(error);
    alert("Message failed");
  }

  msgInput.value = "";
};

/* WIPE (DB DELETE) */
async function wipeConversation() {
  try {
    await supabaseClient
      .from("messages")
      .delete()
      .neq("id", 0);
  } catch (e) {
    console.error("Delete failed");
  }
}

/* RESET SESSION */
async function resetSession() {
  if (!isLoggedIn) return;

  await wipeConversation();

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
    resetSession();
  }
});

/* CLOSE / REFRESH */
window.addEventListener("beforeunload", () => {
  resetSession();
});

/* SCROLL */
function scrollBottom() {
  requestAnimationFrame(() => {
    messagesBox.scrollTop = messagesBox.scrollHeight;
  });
}

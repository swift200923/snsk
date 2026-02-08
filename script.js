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

let channel; // single persistent channel

/* LOGIN */
document.getElementById("login-btn").onclick = () => {
  if (passInput.value !== SECRET_PASS) {
    alert("Wrong password");
    return;
  }

  authOverlay.style.display = "none";
  chatContainer.style.display = "flex";

  initRealtime();   // subscribe first
  loadMessages();   // then load history
};

/* INIT REALTIME (ONLY ONCE) */
function initRealtime() {
  if (channel) return;

  channel = supabaseClient
    .channel("messages-realtime", {
      config: { broadcast: { self: true } }
    })
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      payload => {
        addMessage(payload.new);
        scrollBottom();
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

  if (error) {
    console.error(error);
    return;
  }

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

  /* 🔥 SECRET DELETE COMMAND */
  if (text === DELETE_TRIGGER) {
    const { error } = await supabaseClient
      .from("messages")
      .delete()
      .neq("id", 0);

    if (error) {
      console.error("Delete error:", error.message);
      alert("Delete failed");
    } else {
      messagesBox.innerHTML = "";
    }

    msgInput.value = "";
    return;
  }

  /* NORMAL MESSAGE */
  const { error } = await supabaseClient
    .from("messages")
    .insert({ content: text });

  if (error) {
    console.error("Insert error:", error.message);
    alert("Message failed");
    return;
  }

  msgInput.value = "";
};

/* SCROLL FIX */
function scrollBottom() {
  requestAnimationFrame(() => {
    messagesBox.scrollTop = messagesBox.scrollHeight;
  });
}

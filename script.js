/* ===== CONFIG ===== */
const SUPABASE_URL = "https://muheqytnxuhjokvjamgl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11aGVxeXRueHVoam9rdmphbWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NzY0NDEsImV4cCI6MjA3OTQ1MjQ0MX0.AzwDieQ_8SUCVqfJInydqQqT86_qBF5qUoSP56EMFUE";
const SECRET_PASS = "chamar";
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

/* LOGIN */
document.getElementById("login-btn").onclick = () => {
  if (passInput.value === SECRET_PASS) {
    authOverlay.style.display = "none";
    chatContainer.style.display = "flex";
    loadMessages();
    subscribeRealtime();
  } else {
    alert("Wrong password");
  }
};

/* LOAD MESSAGES */
async function loadMessages() {
  const { data, error } = await supabaseClient
    .from("messages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return console.error(error);

  messagesBox.innerHTML = "";
  data.forEach(addMessage);
  messagesBox.scrollTop = messagesBox.scrollHeight;
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
  if (!msgInput.value) return;

  await supabaseClient.from("messages").insert({
    content: msgInput.value
  });

  msgInput.value = "";
};

/* REALTIME */
function subscribeRealtime() {
  supabaseClient
    .channel("messages-room")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      payload => {
        addMessage(payload.new);
        messagesBox.scrollTop = messagesBox.scrollHeight;
      }
    )
    .subscribe();
}

/* ADMIN WIPE */
document.getElementById("wipe-btn").onclick = async () => {
  if (!confirm("Delete all messages?")) return;
  await supabaseClient.from("messages").delete().neq("id", 0);
  location.reload();
};

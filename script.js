/* ===== CONFIG ===== */
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";
const SECRET_PASS = "chamar"; // Change this to your desired password

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Local Identity for Left/Right Chat Bubbles */
let senderId = localStorage.getItem("sender_id");
if (!senderId) {
    senderId = crypto.randomUUID();
    localStorage.setItem("sender_id", senderId);
}

/* UI Elements */
const authOverlay = document.getElementById("auth-screen");
const chatContainer = document.getElementById("chat-ui");
const passInput = document.getElementById("pass-input");
const messagesBox = document.getElementById("messages");
const msgInput = document.getElementById("msg-input");

let channel = null;

/* LOGIN LOGIC */
async function handleLogin() {
    const entered = passInput.value.trim().toLowerCase();
    if (entered !== SECRET_PASS.toLowerCase()) {
        alert("Wrong password");
        return;
    }
    authOverlay.style.display = "none";
    chatContainer.style.display = "flex";
    await loadMessages();
    initRealtime();
}

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
    const { data, error } = await client.from("messages").select("*").order("created_at", { ascending: true });
    if (error) {
        console.error("Load Error:", error);
        return;
    }
    messagesBox.innerHTML = "";
    if (data) data.forEach(renderMessage);
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

/* RENDER MESSAGE */
function renderMessage(msg) {
    const div = document.createElement("div");
    // If it's my message, align it differently (Add .mine CSS to your style.css if you want)
    div.className = "msg " + (msg.sender_id === senderId ? "mine" : "theirs");
    div.textContent = msg.content;
    messagesBox.appendChild(div);
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

/* SEND MESSAGE FUNCTION */
async function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    const { error } = await client.from("messages").insert({ 
        content: text, 
        sender_id: senderId 
    });

    if (error) {
        console.error("Send Error:", error);
        alert("Failed to send: " + error.message);
    } else {
        msgInput.value = "";
        
        // Trigger Telegram Notification
        fetch(`${SUPABASE_URL}/functions/v1/dynamic-handler`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ text: "🔔 New message received!" })
        }).catch(err => console.log("Telegram notify failed, but message sent to DB."));
    }
}

/* ENTER KEY SUPPORT */
function checkEnter(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
}

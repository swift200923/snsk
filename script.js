/* ===== CONFIG ===== */
const SB_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWJhcmJqbXJ5am9xZmV4dXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NjQyNjUsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";
const PASSWORD = "dada"; 
const WIPE_TRIGGER = "808801";

// Initialize Supabase
const supabase = window.supabase.createClient(SB_URL, SB_KEY);

// Local ID for alignment (Mine vs Theirs)
let senderId = localStorage.getItem("sender_id") || crypto.randomUUID();
localStorage.setItem("sender_id", senderId);

const messagesBox = document.getElementById("messages");
const msgInput = document.getElementById("msg-input");
let channel = null;

/* 1. LOGIN LOGIC */
async function handleLogin() {
    const input = document.getElementById('pass-input').value.trim().toLowerCase();
    if (input === PASSWORD.toLowerCase()) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-ui').style.display = 'flex';
        await loadMessages();
        initRealtime();
    } else {
        alert("Wrong Password!");
    }
}

/* 2. REALTIME SYNC (Instant Wipe Included) */
function initRealtime() {
    if (channel) return;
    channel = supabase
        .channel("public-room")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, 
        payload => {
            const msg = payload.new;
            if (msg.content === WIPE_TRIGGER) {
                messagesBox.innerHTML = "";
            } else {
                renderMessage(msg);
            }
        })
        .subscribe();
}

/* 3. LOAD HISTORY */
async function loadMessages() {
    const { data, error } = await supabase.from("messages").select("*").order("created_at");
    if (error) return;
    messagesBox.innerHTML = "";
    if (data) {
        const isWiped = data.some(m => m.content === WIPE_TRIGGER);
        if (!isWiped) data.forEach(renderMessage);
    }
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

/* 4. RENDER */
function renderMessage(msg) {
    const div = document.createElement("div");
    div.className = "msg " + (msg.sender_id === senderId ? "mine" : "theirs");
    div.textContent = msg.content;
    messagesBox.appendChild(div);
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

/* 5. SEND MESSAGE (Fixed for Desktop & Mobile) */
async function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    if (text === WIPE_TRIGGER) {
        await supabase.from("messages").insert({ content: WIPE_TRIGGER, sender_id: senderId });
        await supabase.from("messages").delete().neq("id", 0);
        messagesBox.innerHTML = "";
        msgInput.value = "";
        return;
    }

    const { error } = await supabase.from("messages").insert({ 
        content: text, 
        sender_id: senderId 
    });

    if (error) {
        alert("Send Error: " + error.message);
    } else {
        msgInput.value = "";
        // Telegram Trigger
        fetch(`${SB_URL}/functions/v1/dynamic-handler`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                apikey: SB_KEY,
                Authorization: `Bearer ${SB_KEY}`
            },
            body: JSON.stringify({ text: "🔔 New message received!" })
        }).catch(e => console.log("Telegram silent."));
    }
}

function checkEnter(event) {
    if (event.key === "Enter") sendMessage();
}

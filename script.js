/* ===== CONFIG ===== */
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWJhcmJqbXJ5am9xZmV4dXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NjQyNjUsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";
const SECRET_PASS = "dada"; 
const WIPE_CODE = "808801"; 

// Initialize Client
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let myPeer;

// Wait for HTML to be ready
window.onload = () => {
    let senderId = localStorage.getItem("sender_id") || crypto.randomUUID();
    localStorage.setItem("sender_id", senderId);

    const authOverlay = document.getElementById("auth-overlay");
    const chatContainer = document.getElementById("chat-container");
    const passInput = document.getElementById("pass-input");
    const messagesBox = document.getElementById("messages");
    const msgInput = document.getElementById("msg-input");
    const loginBtn = document.getElementById("login-btn");
    const sendBtn = document.getElementById("send-btn");
    const callBtn = document.getElementById("call-btn");

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
        initPeer(); // Activate Calling after login
    };

    /* PEERJS (VOICE CALL) LOGIC */
    function initPeer() {
        myPeer = new Peer(senderId); // Use senderId as the unique ID for calling
        
        myPeer.on('open', (id) => console.log('Your Call ID is:', id));

        myPeer.on('call', async (call) => {
            if (confirm("Incoming Voice Call. Accept?")) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                call.answer(stream); // Send your audio back
                call.on('stream', (remoteStream) => {
                    document.getElementById('remote-audio').srcObject = remoteStream;
                });
            }
        });
    }

    async function startVoiceCall(targetPeerId) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const call = myPeer.call(targetPeerId, stream);
            call.on('stream', (remoteStream) => {
                document.getElementById('remote-audio').srcObject = remoteStream;
            });
        } catch (err) {
            console.error("Failed to get local stream", err);
        }
    }

    /* REALTIME SYNC */
    function initRealtime() {
        if (channel) return;
        channel = client
            .channel("public-room")
            .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, 
            payload => {
                const msg = payload.new;
                // 1. Instant Wipe
                if ((payload.eventType === "INSERT" && msg.content === WIPE_CODE) || payload.eventType === "DELETE") {
                    messagesBox.innerHTML = "";
                } 
                // 2. Incoming Call Signal (Hidden from UI)
                else if (payload.eventType === "INSERT" && msg.content === "SIGNAL_CALL_START" && msg.sender_id !== senderId) {
                    startVoiceCall(msg.sender_id);
                }
                // 3. Normal Message
                else if (payload.eventType === "INSERT") {
                    renderMessage(msg);
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
            const isWiped = data.some(m => m.content === WIPE_CODE);
            if (!isWiped) {
                // Don't show call signals in history
                data.filter(m => m.content !== "SIGNAL_CALL_START").forEach(renderMessage);
            }
        }
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

        if (text === WIPE_CODE) {
            await client.from("messages").insert({ content: WIPE_CODE, sender_id: senderId });
            await client.from("messages").delete().neq("id", 0);
            messagesBox.innerHTML = "";
            msgInput.value = "";
            return;
        }

        const { error } = await client.from("messages").insert({ 
            content: text, 
            sender_id: senderId 
        });

        if (error) {
            alert("Send Error: " + error.message);
        } else {
            msgInput.value = "";
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

    /* CALL BUTTON */
    callBtn.onclick = async () => {
        // Send hidden signal to other person to trigger the PeerJS call
        await client.from("messages").insert({ 
            content: "SIGNAL_CALL_START", 
            sender_id: senderId 
        });
        alert("Calling other side...");
    };

    sendBtn.onclick = sendMessage;
    msgInput.onkeydown = (e) => { if (e.key === "Enter") sendMessage(); };
};

/* ===== CONFIG ===== */
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWJhcmJqbXJ5am9xZmV4dXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NjQyNjUsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";
const SECRET_PASS = "dada"; 
const WIPE_CODE = "808801"; 

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let myPeer;
let localStream;
let currentCall;

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
    const endCallBtn = document.getElementById("end-call-btn");

    let channel = null;
    let loggedIn = false;

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
        initPeer(); 
    };

    function initPeer() {
        myPeer = new Peer(senderId);

        myPeer.on('call', async (call) => {
            if (confirm("Incoming Voice Call. Accept?")) {
                endCallBtn.style.display = "inline-block";
                callBtn.style.display = "none";
                
                // Optimized for phone/earpiece use
                localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
                call.answer(localStream);
                
                call.on('stream', (remoteStream) => {
                    const audio = document.getElementById('remote-audio');
                    audio.srcObject = remoteStream;
                    audio.play();
                });
                currentCall = call;
            }
        });
    }

    async function makeCall(targetId) {
        endCallBtn.style.display = "inline-block";
        callBtn.style.display = "none";
        
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const call = myPeer.call(targetId, localStream);
        
        call.on('stream', (remoteStream) => {
            const audio = document.getElementById('remote-audio');
            audio.srcObject = remoteStream;
            audio.play();
        });
        currentCall = call;
    }

    /* END CALL LOGIC */
    function endCall() {
        if (currentCall) currentCall.close();
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop()); // Completely kills the mic
        }
        document.getElementById('remote-audio').srcObject = null;
        endCallBtn.style.display = "none";
        callBtn.style.display = "inline-block";
        alert("Call Ended");
    }

    endCallBtn.onclick = endCall;

    function initRealtime() {
        if (channel) return;
        channel = client
            .channel("public-room")
            .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, 
            payload => {
                const msg = payload.new;
                if ((payload.eventType === "INSERT" && msg.content === WIPE_CODE) || payload.eventType === "DELETE") {
                    messagesBox.innerHTML = "";
                } 
                else if (payload.eventType === "INSERT" && msg.content === "SIGNAL_CALL_START" && msg.sender_id !== senderId) {
                    makeCall(msg.sender_id);
                }
                else if (payload.eventType === "INSERT" && msg.content !== "SIGNAL_CALL_START") {
                    renderMessage(msg);
                }
            })
            .subscribe();
    }

    callBtn.onclick = async () => {
        await client.from("messages").insert({ content: "SIGNAL_CALL_START", sender_id: senderId });
        alert("Ringing...");
    };

    async function loadMessages() {
        const { data } = await client.from("messages").select("*").order("created_at");
        if (data) {
            const isWiped = data.some(m => m.content === WIPE_CODE);
            if (!isWiped) {
                data.filter(m => m.content !== "SIGNAL_CALL_START").forEach(renderMessage);
            }
        }
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }

    function renderMessage(msg) {
        const div = document.createElement("div");
        div.className = "msg " + (msg.sender_id === senderId ? "mine" : "theirs");
        div.textContent = msg.content;
        messagesBox.appendChild(div);
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }

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

        const { error } = await client.from("messages").insert({ content: text, sender_id: senderId });
        if (!error) {
            msgInput.value = "";
            fetch(`${SUPABASE_URL}/functions/v1/dynamic-handler`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
                body: JSON.stringify({ text: "🔔 New message received!" })
            }).catch(e => {});
        }
    }

    sendBtn.onclick = sendMessage;
    msgInput.onkeydown = (e) => { if (e.key === "Enter") sendMessage(); };

    /* LOCK LOGIC */
    document.addEventListener("visibilitychange", () => {
        if (document.hidden && loggedIn) {
            endCall(); // Kills call if you hide the tab
            loggedIn = false;
            location.reload(); 
        }
    });
};

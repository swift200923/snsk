/* ===== CONFIG ===== */
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWJhcmJqbXJ5am9xZmV4dXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NjQyNjUsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";
const SECRET_PASS = "dada"; 
const WIPE_CODE = "808801"; 

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let myPeer, localStream, currentCall, senderId;

window.onload = () => {
    senderId = localStorage.getItem("sender_id") || crypto.randomUUID();
    localStorage.setItem("sender_id", senderId);

    const callModal = document.getElementById("call-modal");
    const ringtone = document.getElementById("ringtone");
    const messagesBox = document.getElementById("messages");
    const msgInput = document.getElementById("msg-input");
    const callBtn = document.getElementById("call-btn");
    const endCallBtn = document.getElementById("end-call-btn");

    document.getElementById("login-btn").onclick = async () => {
        if (document.getElementById("pass-input").value.trim().toLowerCase() === SECRET_PASS) {
            document.getElementById("auth-overlay").style.display = "none";
            document.getElementById("chat-container").style.display = "flex";
            await loadMessages();
            initRealtime();
            initPeer();
        } else { alert("Wrong password"); }
    };

    function initPeer() {
        myPeer = new Peer(senderId);
        
        myPeer.on('call', (call) => {
            currentCall = call;
            callModal.style.display = "flex"; 
            ringtone.play(); // Play ringtone on incoming
        });
    }

    // ACCEPT CALL
    document.getElementById("accept-call").onclick = async () => {
        callModal.style.display = "none";
        ringtone.pause();
        ringtone.currentTime = 0;
        endCallBtn.style.display = "inline-block";
        callBtn.style.display = "none";
        
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        currentCall.answer(localStream);
        
        currentCall.on('stream', (remoteStream) => {
            const audio = document.getElementById('remote-audio');
            audio.srcObject = remoteStream;
            audio.play();
        });
    };

    // REJECT CALL
    document.getElementById("reject-call").onclick = () => {
        callModal.style.display = "none";
        ringtone.pause();
        if (currentCall) currentCall.close();
    };

    // OUTGOING CALL SEQUENCE
    async function startCallSequence(targetId) {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const call = myPeer.call(targetId, localStream);
        
        call.on('stream', (remoteStream) => {
            endCallBtn.style.display = "inline-block";
            callBtn.style.display = "none";
            const audio = document.getElementById('remote-audio');
            audio.srcObject = remoteStream;
            audio.play();
        });
        currentCall = call;
    }

    function initRealtime() {
        client.channel("public-room").on("postgres_changes", { event: "*", schema: "public", table: "messages" }, payload => {
            const msg = payload.new;
            if (payload.eventType === "DELETE" || (msg && msg.content === WIPE_CODE)) {
                messagesBox.innerHTML = "";
            } else if (msg && msg.content === "SIGNAL_CALL_START" && msg.sender_id !== senderId) {
                // Incoming signal logic is handled by myPeer.on('call')
            } else if (msg && msg.content !== "SIGNAL_CALL_START") {
                renderMessage(msg);
            }
        }).subscribe();
    }

    // CLICK CALL BUTTON
    callBtn.onclick = async () => {
        // Find the last person who messaged
        const { data } = await client.from("messages")
            .select("sender_id")
            .neq("sender_id", senderId)
            .order("created_at", { ascending: false })
            .limit(1);
        
        if (data && data.length > 0) {
            const target = data[0].sender_id;
            await client.from("messages").insert({ content: "SIGNAL_CALL_START", sender_id: senderId });
            startCallSequence(target);
            alert("Calling...");
        } else {
            alert("No one to call yet! Send a message first.");
        }
    };

    endCallBtn.onclick = () => {
        if (currentCall) currentCall.close();
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        document.getElementById('remote-audio').srcObject = null;
        endCallBtn.style.display = "none";
        callBtn.style.display = "inline-block";
        location.reload(); 
    };

    async function loadMessages() {
        const { data } = await client.from("messages").select("*").order("created_at");
        if (data) data.filter(m => m.content !== "SIGNAL_CALL_START").forEach(renderMessage);
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
            await client.from("messages").delete().neq("id", 0);
            messagesBox.innerHTML = "";
            msgInput.value = "";
            return;
        }
        await client.from("messages").insert({ content: text, sender_id: senderId });
        msgInput.value = "";
    }

    document.getElementById("send-btn").onclick = sendMessage;
    msgInput.onkeydown = (e) => { if (e.key === "Enter") sendMessage(); };
};

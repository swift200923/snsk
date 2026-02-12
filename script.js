/* ===== CONFIG ===== */
const SUPABASE_URL = "https://fqubarbjmryjoqfexuqz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdWJhcmJqbXJ5am9xZmV4dXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1NjQyNjUsImV4cCI6MjA4NjE0MDI2NX0.AnL_5uMC7gqIUGqexoiOM2mYFsxjZjVF21W-CUdTPBg";
const SECRET_PASS = "dada"; 
const WIPE_CODE = "808801"; 

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let myPeer, localStream, currentCall;

window.onload = () => {
    let senderId = localStorage.getItem("sender_id") || crypto.randomUUID();
    localStorage.setItem("sender_id", senderId);

    const callModal = document.getElementById("call-modal");
    const messagesBox = document.getElementById("messages");
    const msgInput = document.getElementById("msg-input");
    const callBtn = document.getElementById("call-btn");
    const endCallBtn = document.getElementById("end-call-btn");

    let channel = null;

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
            callModal.style.display = "flex"; // Show the Accept/Reject screen
        });
    }

    // ACCEPT CALL
    document.getElementById("accept-call").onclick = async () => {
        callModal.style.display = "none";
        endCallBtn.style.display = "inline-block";
        callBtn.style.display = "none";
        
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        currentCall.answer(localStream);
        
        currentCall.on('stream', (remoteStream) => {
            const audio = document.getElementById('remote-audio');
            audio.srcObject = remoteStream;
            audio.setSinkId ? audio.setSinkId('') : null; // Default to earpiece/system choice
            audio.play();
        });
    };

    // REJECT CALL
    document.getElementById("reject-call").onclick = () => {
        callModal.style.display = "none";
        if (currentCall) currentCall.close();
    };

    async function startCall(targetId) {
        alert("Calling...");
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
        if (channel) return;
        channel = client.channel("public-room").on("postgres_changes", { event: "*", schema: "public", table: "messages" }, payload => {
            const msg = payload.new;
            if (payload.eventType === "DELETE" || (msg && msg.content === WIPE_CODE)) {
                messagesBox.innerHTML = "";
            } else if (msg && msg.content === "SIGNAL_CALL_START" && msg.sender_id !== senderId) {
                // DON'T auto-start, the 'on(call)' handler above will trigger the modal
            } else if (msg && msg.content !== "SIGNAL_CALL_START") {
                renderMessage(msg);
            }
        }).subscribe();
    }

    callBtn.onclick = async () => {
        await client.from("messages").insert({ content: "SIGNAL_CALL_START", sender_id: senderId });
        // The sender needs to wait for the other side to be ready
        startCall(prompt("Enter the Peer ID of the person (or just wait for signals to connect)")); 
        // Note: In a 1-on-1 chat, you'd usually just call the other stored ID.
    };

    /* END CALL */
    endCallBtn.onclick = () => {
        if (currentCall) currentCall.close();
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        document.getElementById('remote-audio').srcObject = null;
        endCallBtn.style.display = "none";
        callBtn.style.display = "inline-block";
        location.reload(); // Cleanest way to reset PeerJS state
    };

    /* REST OF YOUR WORKING FUNCTIONS (Load, Render, Send) */
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

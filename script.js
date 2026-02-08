// CONFIG: Paste your actual details from Supabase Settings > API
const SB_URL = "https://muheqytnxuhjokvjamgl.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11aGVxeXRueHVoam9rdmphbWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NzY0NDEsImV4cCI6MjA3OTQ1MjQ0MX0.AzwDieQ_8SUCVqfJInydqQqT86_qBF5qUoSP56EMFUE";
const PASSWORD = "chamar"; 

// Initialize Supabase
const supabase = window.supabase.createClient(SB_URL, SB_KEY);

async function handleLogin() {
    const input = document.getElementById('pass-input').value.trim();
    if (input.toLowerCase() === PASSWORD.toLowerCase()) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('chat-ui').style.display = 'flex';
        loadMessages();
        listenRealtime();
    } else {
        alert("Incorrect Password!");
    }
}

function checkEnter(e) { if (e.key === 'Enter') sendMessage(); }

async function loadMessages() {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
    
    if (data) {
        document.getElementById('messages').innerHTML = '';
        data.forEach(msg => appendMessage(msg));
        scrollToBottom();
    }
}

function appendMessage(msg) {
    const div = document.createElement('div');
    div.className = 'msg';
    div.textContent = msg.content;
    document.getElementById('messages').appendChild(div);
}

async function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    const { error } = await supabase.from('messages').insert([{ content: text }]);
    if (error) alert("Error sending: " + error.message);
    scrollToBottom();
}

function listenRealtime() {
    supabase
        .channel('public:messages')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
            if (payload.eventType === 'INSERT') {
                appendMessage(payload.new);
                scrollToBottom();
            } else if (payload.eventType === 'DELETE') {
                location.reload(); // Refresh if messages are wiped
            }
        })
        .subscribe();
}

async function wipeChat() {
    if (confirm("Admin: Clear all chat history?")) {
        await supabase.from('messages').delete().neq('id', 0);
    }
}

function scrollToBottom() {
    const msgDiv = document.getElementById('messages');
    msgDiv.scrollTop = msgDiv.scrollHeight;
}

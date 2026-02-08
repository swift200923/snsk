// 1. HARDCODED CONFIG (Root folder check)

const SB_URL = "https://muheqytnxuhjokvjamgl.supabase.co";

const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11aGVxeXRueHVoam9rdmphbWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NzY0NDEsImV4cCI6MjA3OTQ1MjQ0MX0.AzwDieQ_8SUCVqfJInydqQqT86_qBF5qUoSP56EMFUE";

const PASSWORD = "chamar"; 



let supabase;



// 2. INITIALIZE IMMEDIATELY

try {

    if (typeof window.supabase === 'undefined') {

        alert("CRITICAL ERROR: Supabase library not loaded! Check your internet or index.html script tag.");

    } else {

        supabase = window.supabase.createClient(SB_URL, SB_KEY);

        console.log("Supabase initialized successfully");

    }

} catch (e) {

    alert("Init Error: " + e.message);

}



// 3. THE LOGIN FUNCTION

async function handleLogin() {

    console.log("Login button clicked");

    const inputField = document.getElementById('pass-input');

    

    if (!inputField) {

        alert("Error: Cannot find input field 'pass-input'");

        return;

    }



    const input = inputField.value.trim();

    

    if (input.toLowerCase() === PASSWORD.toLowerCase()) {

        alert("Password correct! Switching UI..."); // This will tell us if logic works

        document.getElementById('auth-screen').style.display = 'none';

        document.getElementById('chat-ui').style.display = 'flex';

        

        // Start backend functions

        loadMessages();

        listenRealtime();

    } else {

        alert("Wrong Password! You entered: " + input);

    }

}



// 4. LOAD MESSAGES

async function loadMessages() {

    try {

        const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });

        if (error) throw error;

        if (data) {

            const container = document.getElementById('messages');

            container.innerHTML = '';

            data.forEach(msg => {

                const div = document.createElement('div');

                div.className = 'msg';

                div.textContent = msg.content;

                container.appendChild(div);

            });

            container.scrollTop = container.scrollHeight;

        }

    } catch (err) {

        alert("Database Load Error: " + err.message);

    }

}



// ... (keep the rest of the functions same as before)

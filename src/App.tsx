import { useEffect, useState } from "react";
import "./App.css";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ChatSession = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

function App() {
const API_URL =
  import.meta.env.VITE_API_URL || "";
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Halo Papa 👋 Saya Erza AI. Ada yang bisa saya bantu?",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
const [sessions, setSessions] = useState<ChatSession[]>([]);
const [sidebarOpen, setSidebarOpen] = useState(false);
async function loadSessions() {
  try {
    const response = await fetch(
  `${API_URL}/api/sessions`
);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Gagal mengambil history");
    }

    setSessions(data.sessions || []);
  } catch (error) {
    console.error("LOAD SESSIONS ERROR:", error);
  }
}

useEffect(() => {
  loadSessions();
}, []);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userText = input.trim();

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: userText,
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
   body: JSON.stringify({
  message: userText,
  sessionId,
}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "API error");
      }

	if (data.sessionId) {
  setSessionId(data.sessionId);
}

     
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer,
        },
      ]);
    } catch (error) {
      console.error("CHAT ERROR:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan.";

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Error: ${errorMessage}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">

  <aside
  className={`chat-sidebar ${
    sidebarOpen ? "open" : ""
  }`}
>
    <div className="sidebar-header">
      <h2>Erza AI</h2>

      <button
        onClick={() => {
          setSessionId(null);

          setMessages([
            {
              role: "assistant",
              content:
                "Halo Papa 👋 Saya Erza AI. Ada yang bisa saya bantu?",
            },
          ]);
        }}
      >
        + Percakapan Baru
      </button>
    </div>

    <div className="session-list">
  {sessions.map((session) => (
    <div
      key={session.id}
      className={`session-row ${
        session.id === sessionId ? "active" : ""
      }`}
    >
      <button
        className="session-item"
        onClick={async () => {
          try {
            const response = await fetch(
             `${API_URL}/api/sessions/${session.id}/messages`
            );

            const data = await response.json();

            if (!response.ok) {
              throw new Error(
                data.error ||
                  "Gagal membuka percakapan"
              );
            }

            setSessionId(session.id);
	setSidebarOpen(false);

            setMessages(
              data.messages.map(
                (message: {
                  role: "user" | "assistant";
                  content: string;
                }) => ({
                  role: message.role,
                  content: message.content,
                })
              )
            );
          } catch (error) {
            console.error(
              "LOAD CHAT ERROR:",
              error
            );
          }
        }}
      >
        {session.title}
      </button>

      <button
        className="delete-session"
        title="Hapus percakapan"
        onClick={async (event) => {
          event.stopPropagation();

          const confirmed = window.confirm(
            "Papa yakin ingin menghapus percakapan ini?"
          );

          if (!confirmed) return;

          try {
            const response = await fetch(
              `${API_URL}/api/sessions/${session.id}`,
              {
                method: "DELETE",
              }
            );

            const data = await response.json();

            if (!response.ok) {
              throw new Error(
                data.error ||
                  "Gagal menghapus percakapan"
              );
            }

            setSessions((current) =>
              current.filter(
                (item) => item.id !== session.id
              )
            );

            if (session.id === sessionId) {
              setSessionId(null);
		setSidebarOpen(false);

              setMessages([
                {
                  role: "assistant",
                  content:
                    "Halo Papa 👋 Saya Erza AI. Ada yang bisa saya bantu?",
                },
              ]);
            }
          } catch (error) {
            console.error(
              "DELETE SESSION ERROR:",
              error
            );
          }
        }}
      >
        🗑️
      </button>
    </div>
  ))}
</div>

  </aside>
{sidebarOpen && (
  <div
    className="sidebar-overlay"
    onClick={() => setSidebarOpen(false)}
  />
)}

  <div className="chat-container">

<button
  className="mobile-menu-button"
  onClick={() => setSidebarOpen(true)}
  aria-label="Buka riwayat percakapan"
>
  ☰
</button>

        <header className="chat-header">
          <div className="avatar">E</div>

          <div>
            <h1>Erza AI</h1>
            <p>Groq AI Assistant â€¢ Online</p>
          </div>
        </header>

        <main className="chat-messages">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`message ${message.role}`}
            >
              {message.content}
            </div>
          ))}

          {loading && (
            <div className="message assistant">
              Erza sedang berpikir... 🤔
            </div>
          )}
        </main>

        <footer className="chat-input">
          <input
            type="text"
            value={input}
            placeholder="Tulis pesan untuk Erza..."
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                sendMessage();
              }
            }}
          />

          <button
            onClick={sendMessage}
            disabled={loading}
          >
            {loading ? "..." : "Kirim"}
          </button>
        </footer>

      </div>
    </div>
  );
}

export default App;
import { useEffect, useState, type ChangeEvent } from "react";
import {
  Bot,
  Menu,
  Plus,
  Send,
  Mic,
  Sparkles,
  User,
  X,
  MessageSquare,
  Trash2,
} from "lucide-react";

import { supabase } from "./lib/supabase";
import "./App.css";

type Message = {
  id: string;
  role: "erza" | "user";
  text: string;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

const INITIAL_MESSAGE: Message = {
  id: "initial",
  role: "erza",
  text: "Halo Papa 👋\nAda yang bisa Erza bantu hari ini?",
};

const GUEST_USER_ID_KEY = "erza-ai-guest-user-id";

function getGuestUserId() {
  const saved = localStorage.getItem(GUEST_USER_ID_KEY);

  if (saved) {
    return saved;
  }

  const id = crypto.randomUUID();
  localStorage.setItem(GUEST_USER_ID_KEY, id);
  return id;
}

const SUGGESTIONS = [
  {
    icon: "💰",
    label: "Hitung HPP",
    text: "Bantu saya menghitung HPP",
  },
  {
    icon: "💻",
    label: "Buat website",
    text: "Bantu saya membuat website",
  },
  {
    icon: "📢",
    label: "Buat promosi",
    text: "Bantu saya membuat promosi",
  },
  {
    icon: "📊",
    label: "Analisa usaha",
    text: "Bantu saya menganalisa usaha",
  },
];

function App() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    INITIAL_MESSAGE,
  ]);

  const [conversations, setConversations] = useState<
    Conversation[]
  >([]);

  const [conversationId, setConversationId] =
    useState<string | null>(null);

  const [userId] = useState<string>(() =>
    getGuestUserId(),
  );

  // ========================================
  // LOAD AWAL
  // ========================================

  useEffect(() => {
    initializeApp();
  }, []);

  // ========================================
  // INITIALIZE APP
  // ========================================

  async function initializeApp() {
    console.log("🚀 Memulai Erza AI...");

    const latestConversation =
      await loadConversations();

    // Jika ada percakapan, otomatis buka
    // percakapan paling baru.
    if (latestConversation) {
      console.log(
        "🔄 Membuka percakapan terakhir:",
        latestConversation.id,
      );

      await loadMessages(
        latestConversation.id,
      );
    } else {
      console.log(
        "ℹ️ Belum ada percakapan.",
      );
    }
  }

  // ========================================
  // LOAD RIWAYAT
  // ========================================

  async function loadConversations(): Promise<
    Conversation | null
  > {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select(
          "id, title, created_at, updated_at",
        )
        .order("updated_at", {
          ascending: false,
        });

      if (error) {
        console.error(
          "❌ LOAD CONVERSATIONS ERROR:",
          error,
        );

        return null;
      }

      const list = data ?? [];

      setConversations(list);

      // Conversation pertama adalah yang
      // paling baru karena sudah diurutkan.
      return list[0] ?? null;
    } catch (error) {
      console.error(
        "❌ LOAD CONVERSATIONS EXCEPTION:",
        error,
      );

      return null;
    }
  }

  // ========================================
  // CREATE CONVERSATION
  // ========================================

  async function createConversation(
    firstMessage: string,
  ): Promise<string | null> {
    try {
      const title =
        firstMessage.trim().slice(0, 60) ||
        "Percakapan Baru";

      console.log(
        "📝 Membuat percakapan:",
        title,
      );

      const { data, error } = await supabase
        .from("conversations")
        .insert({
          title,
        })
        .select(
          "id, title, created_at, updated_at",
        )
        .single();

      if (error) {
        console.error(
          "❌ CREATE CONVERSATION ERROR:",
          error,
        );

        throw new Error(
          `Supabase gagal membuat percakapan: ${error.message}`,
        );
      }

      if (!data?.id) {
        throw new Error(
          "Supabase membuat percakapan tetapi ID tidak ditemukan.",
        );
      }

      console.log(
        "✅ Conversation dibuat:",
        data.id,
      );

      setConversations((current) => [
        data,
        ...current.filter(
          (item) => item.id !== data.id,
        ),
      ]);

      setConversationId(data.id);

      return data.id;
    } catch (error) {
      console.error(
        "❌ CREATE CONVERSATION EXCEPTION:",
        error,
      );

      throw error;
    }
  }

  // ========================================
  // SAVE MESSAGE
  // ========================================

  async function saveMessage(
    activeConversationId: string,
    role: "user" | "erza",
    text: string,
  ) {
    console.log(
      `💾 Menyimpan ${role} message...`,
    );

    const { error } = await supabase
      .from("messages")
      .insert({
        conversation_id:
          activeConversationId,
        role,
        content: text,
      });

    if (error) {
      console.error(
        `❌ SAVE ${role.toUpperCase()} MESSAGE ERROR:`,
        error,
      );

      throw new Error(
        `Gagal menyimpan pesan ${role}: ${error.message}`,
      );
    }

    console.log(
      `✅ ${role} message tersimpan.`,
    );

    const { error: updateError } =
      await supabase
        .from("conversations")
        .update({
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          activeConversationId,
        );

    if (updateError) {
      console.warn(
        "⚠️ Gagal update waktu conversation:",
        updateError,
      );
    }
  }

  // ========================================
  // LOAD MESSAGE
  // ========================================

  async function loadMessages(
    activeConversationId: string,
  ) {
    try {
      console.log(
        "📖 Membuka conversation:",
        activeConversationId,
      );

      const { data, error } =
        await supabase
          .from("messages")
          .select(
            "id, role, content, created_at",
          )
          .eq(
            "conversation_id",
            activeConversationId,
          )
          .order("created_at", {
            ascending: true,
          });

      if (error) {
        console.error(
          "❌ LOAD MESSAGES ERROR:",
          error,
        );

        return;
      }

      const loadedMessages: Message[] =
        (data ?? []).map((item) => ({
          id: item.id,
          role:
            item.role === "user"
              ? "user"
              : "erza",
          text: item.content,
        }));

      setMessages(
        loadedMessages.length > 0
          ? loadedMessages
          : [INITIAL_MESSAGE],
      );

      setConversationId(
        activeConversationId,
      );

      setHistoryOpen(false);
      setMenuOpen(false);

      console.log(
        "✅ Messages berhasil dimuat:",
        loadedMessages.length,
      );
    } catch (error) {
      console.error(
        "❌ LOAD MESSAGES EXCEPTION:",
        error,
      );
    }
  }

  // ========================================
  // CHAT KE GROQ
  // ========================================

  async function askErza(
    text: string,
    history: Message[],
    attachmentData?: {
      name: string;
      type: string;
      data: string;
    } | null,
  ) {
    const apiUrl =
      import.meta.env.VITE_API_URL ||
      window.location.origin;

    console.log(
      "⚡ Menghubungi Erza backend:",
      apiUrl,
    );

    const response = await fetch(
      `${apiUrl}/api/chat`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          message: text,
          userId,

          history: history
            .filter(
              (item) =>
                item.id !== "initial",
            )
            .map((item) => ({
              role: item.role,
              text: item.text,
            })),

          attachment: attachmentData || null,
        }),
      },
    );

    let data: any = null;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        `Backend mengembalikan response yang tidak valid (${response.status}).`,
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
          `Backend Erza gagal (${response.status}).`,
      );
    }

    if (
      typeof data?.answer !== "string" ||
      !data.answer.trim()
    ) {
      throw new Error(
        data?.error ||
          "Backend Erza tidak mengembalikan jawaban.",
      );
    }

    return data.answer.trim();
  }

  // ========================================
  // ATTACHMENT
  // ========================================

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);

    if (
      file.type.startsWith("image/") &&
      file.size > 12 * 1024 * 1024
    ) {
      alert(
        "Foto terlalu besar. Maksimal 12 MB.",
      );
      return;
    }

    setAttachment(file);
    setAttachmentMenuOpen(false);

    if (file.type.startsWith("image/")) {
      setAttachmentPreview(URL.createObjectURL(file));
    } else {
      setAttachmentPreview(null);
    }

    event.target.value = "";
  }

  function removeAttachment() {
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    setAttachment(null);
    setAttachmentPreview(null);
  }

  function formatFileSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ========================================
  // KIRIM PESAN
  // ========================================

  async function compressImage(
    file: File,
  ): Promise<File> {
    if (!file.type.startsWith("image/")) {
      return file;
    }

    // Foto kecil sudah cukup ringan.
    if (file.size <= 1.5 * 1024 * 1024) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const maxWidth = 1600;
        const scale = Math.min(
          1,
          maxWidth / image.width,
          maxWidth / image.height,
        );

        const width = Math.max(
          1,
          Math.round(image.width * scale),
        );

        const height = Math.max(
          1,
          Math.round(image.height * scale),
        );

        const canvas =
          document.createElement("canvas");

        canvas.width = width;
        canvas.height = height;

        const context =
          canvas.getContext("2d");

        if (!context) {
          reject(
            new Error(
              "Browser tidak dapat memproses gambar.",
            ),
          );
          return;
        }

        context.drawImage(
          image,
          0,
          0,
          width,
          height,
        );

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(
                new Error(
                  "Gagal mengompres foto.",
                ),
              );
              return;
            }

            const compressedFile =
              new File(
                [blob],
                file.name.replace(
                  /\.[^/.]+$/,
                  ".jpg",
                ),
                {
                  type: "image/jpeg",
                  lastModified:
                    Date.now(),
                },
              );

            resolve(compressedFile);
          },
          "image/jpeg",
          0.78,
        );
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(
          new Error(
            "Foto tidak dapat diproses.",
          ),
        );
      };

      image.src = objectUrl;
    });
  }

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;

        if (typeof result !== "string") {
          reject(new Error("File tidak dapat dibaca."));
          return;
        }

        const commaIndex = result.indexOf(",");

        if (commaIndex === -1) {
          reject(new Error("Format file tidak valid."));
          return;
        }

        resolve(result.slice(commaIndex + 1));
      };

      reader.onerror = () => {
        reject(new Error("Gagal membaca file."));
      };

      reader.readAsDataURL(file);
    });
  }

  async function handleSend() {
    const text = message.trim();

    if ((!text && !attachment) || loading) {
      return;
    }

    setLoading(true);
    setMessage("");

    const attachmentLabel = attachment
      ? `📎 ${attachment.name} (${formatFileSize(attachment.size)})`
      : "";

    const displayText =
      text && attachmentLabel
        ? `${text}\n\n${attachmentLabel}`
        : text || attachmentLabel;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: displayText,
    };

    const historyForAI = [...messages];

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    try {
      // ====================================
      // BUAT / PAKAI CONVERSATION
      // ====================================

      let activeConversationId =
        conversationId;

      if (!activeConversationId) {
        activeConversationId =
          await createConversation(displayText);
      }

      if (!activeConversationId) {
        throw new Error(
          "Conversation ID tidak tersedia.",
        );
      }

      // ====================================
      // SIMPAN PESAN PAPA
      // ====================================

      await saveMessage(
        activeConversationId,
        "user",
        displayText,
      );

      // ====================================
      // TANYA GROQ
      // ====================================

      let attachmentPayload: {
        name: string;
        type: string;
        data: string;
      } | null = null;

      if (attachment) {
        if (
          attachment.type.startsWith("image/") &&
          attachment.size > 12 * 1024 * 1024
        ) {
          throw new Error(
            "Foto terlalu besar. Maksimal 12 MB sebelum kompresi.",
          );
        }

        const fileForUpload =
          await compressImage(attachment);

        console.log(
          "📷 Ukuran foto:",
          formatFileSize(attachment.size),
          "→",
          formatFileSize(fileForUpload.size),
        );

        if (
          fileForUpload.size >
          2.5 * 1024 * 1024
        ) {
          throw new Error(
            "Foto masih terlalu besar setelah kompresi. Pilih foto yang lebih kecil.",
          );
        }

        const base64 =
          await fileToBase64(
            fileForUpload,
          );

        attachmentPayload = {
          name: fileForUpload.name,
          type: fileForUpload.type,
          data: base64,
        };
      }

      const answer = await askErza(
        text,
        historyForAI,
        attachmentPayload,
      );

      // ====================================
      // JAWABAN ERZA
      // ====================================

      const erzaMessage: Message = {
        id: `erza-${Date.now()}`,
        role: "erza",
        text: answer,
      };

      setMessages((current) => [
        ...current,
        erzaMessage,
      ]);

      // ====================================
      // SIMPAN JAWABAN ERZA
      // ====================================

      await saveMessage(
        activeConversationId,
        "erza",
        answer,
      );

      // ====================================
      // REFRESH RIWAYAT
      // ====================================

      await loadConversations();

      removeAttachment();

      console.log(
        "🎉 Chat selesai dengan sukses.",
      );
    } catch (error) {
      console.error(
        "❌ DETAIL CHAT ERROR:",
        error,
      );

      const errorText =
        error instanceof Error
          ? error.message
          : String(error);

      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "erza",
        text:
          "Maaf Papa, Erza menemukan masalah:\n\n" +
          errorText,
      };

      setMessages((current) => [
        ...current,
        errorMessage,
      ]);
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // NEW CONVERSATION
  // ========================================

  function newConversation() {
    setConversationId(null);

    setMessages([
      {
        id: `new-${Date.now()}`,
        role: "erza",
        text:
          "Halo Papa 👋\nPercakapan baru siap digunakan.",
      },
    ]);

    setMessage("");

    setHistoryOpen(false);
    setMenuOpen(false);
  }

  // ========================================
  // DELETE CONVERSATION
  // ========================================

  async function deleteConversation(
    id: string,
  ) {
    const confirmed = window.confirm(
      "Hapus percakapan ini?",
    );

    if (!confirmed) {
      return;
    }

    try {
      const { error } =
        await supabase
          .from("conversations")
          .delete()
          .eq("id", id);

      if (error) {
        console.error(
          "❌ DELETE ERROR:",
          error,
        );

        alert(
          `Gagal menghapus:\n${error.message}`,
        );

        return;
      }

      const remaining =
        conversations.filter(
          (item) => item.id !== id,
        );

      setConversations(remaining);

      // Jika yang dihapus adalah chat
      // yang sedang dibuka
      if (conversationId === id) {
        if (remaining.length > 0) {
          await loadMessages(
            remaining[0].id,
          );
        } else {
          newConversation();
        }
      }

      console.log(
        "🗑️ Conversation dihapus:",
        id,
      );
    } catch (error) {
      console.error(
        "❌ DELETE EXCEPTION:",
        error,
      );
    }
  }

  // ========================================
  // SUGGESTION
  // ========================================

  function chooseSuggestion(
    text: string,
  ) {
    setMessage(text);
  }

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="app-shell">
      {/* HEADER */}

      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-icon">
              <Sparkles
                size={18}
                strokeWidth={2.3}
              />
            </div>

            <div className="brand-text">
              <strong>
                Erza AI
              </strong>

              <span>
                Asisten AI Papa
              </span>
            </div>
          </div>

          <button
            className="menu-button"
            onClick={() =>
              setMenuOpen(
                (value) => !value,
              )
            }
            aria-label="Menu"
          >
            {menuOpen ? (
              <X size={20} />
            ) : (
              <Menu size={20} />
            )}
          </button>
        </div>

        {/* MENU */}

        {menuOpen && (
          <div className="mobile-menu">
            <button
              onClick={
                newConversation
              }
            >
              <Plus size={16} />
              Percakapan Baru
            </button>

            <button
              onClick={() => {
                setHistoryOpen(true);
                setMenuOpen(false);
              }}
            >
              <MessageSquare
                size={16}
              />
              Riwayat Percakapan
            </button>

            <button>
              ⚙️ Pengaturan
            </button>
          </div>
        )}
      </header>

      {/* HISTORY */}

      {historyOpen && (
        <div className="history-overlay">
          <div className="history-panel">
            <div className="history-header">
              <div>
                <strong>
                  Riwayat Percakapan
                </strong>

                <span>
                  Percakapan Papa
                </span>
              </div>

              <button
                onClick={() =>
                  setHistoryOpen(false)
                }
                aria-label="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            <button
              className="new-chat-button"
              onClick={
                newConversation
              }
            >
              <Plus size={17} />
              Percakapan Baru
            </button>

            <div className="history-list">
              {conversations.length ===
              0 ? (
                <div className="empty-history">
                  <MessageSquare
                    size={28}
                  />

                  <p>
                    Belum ada riwayat
                    percakapan.
                  </p>
                </div>
              ) : (
                conversations.map(
                  (conversation) => (
                    <div
                      className={`history-item ${
                        conversation.id ===
                        conversationId
                          ? "active"
                          : ""
                      }`}
                      key={
                        conversation.id
                      }
                    >
                      <button
                        className="history-main"
                        onClick={() =>
                          loadMessages(
                            conversation.id,
                          )
                        }
                      >
                        <MessageSquare
                          size={17}
                        />

                        <span>
                          {
                            conversation.title
                          }
                        </span>
                      </button>

                      <button
                        className="history-delete"
                        onClick={() =>
                          deleteConversation(
                            conversation.id,
                          )
                        }
                        aria-label="Hapus percakapan"
                      >
                        <Trash2
                          size={15}
                        />
                      </button>
                    </div>
                  ),
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN */}

      <main className="chat-container">
        {/* WELCOME */}

        {messages.length === 1 &&
          !loading && (
            <section className="hero-welcome">
              <div className="erza-orb">
                <Bot
                  size={34}
                  strokeWidth={1.8}
                />

                <span className="orb-glow" />
              </div>

              <div className="welcome-text">
                <div className="eyebrow">
                  <Sparkles size={12} />
                  ERZA AI
                </div>

                <h1>
                  Halo Papa{" "}
                  <span>👋</span>
                </h1>

                <p>
                  Erza siap membantu
                  Papa
                  <br />
                  menyelesaikan
                  berbagai kebutuhan.
                </p>
              </div>
            </section>
          )}

        {/* MESSAGES */}

        <section className="messages">
          {messages.map(
            (item, index) => (
              <div
                key={item.id}
                className={`message-row ${item.role}`}
                style={{
                  animationDelay: `${
                    index * 40
                  }ms`,
                }}
              >
                {item.role ===
                  "erza" && (
                  <div className="small-avatar erza-small">
                    <Bot size={15} />
                  </div>
                )}

                <div className="message-bubble">
                  {item.text
                    .split("\n")
                    .map(
                      (
                        line,
                        lineIndex,
                      ) => (
                        <span
                          key={
                            lineIndex
                          }
                        >
                          {line}

                          {lineIndex <
                            item.text
                              .split(
                                "\n",
                              )
                              .length -
                              1 && (
                            <br />
                          )}
                        </span>
                      ),
                    )}
                </div>

                {item.role ===
                  "user" && (
                  <div className="small-avatar user-small">
                    <User size={15} />
                  </div>
                )}
              </div>
            ),
          )}

          {/* LOADING */}

          {loading && (
            <div className="message-row erza">
              <div className="small-avatar erza-small">
                <Bot size={15} />
              </div>

              <div className="message-bubble typing-bubble">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}
        </section>

        {/* SUGGESTIONS */}

        {messages.length === 1 &&
          !loading && (
            <section className="suggestion-section">
              <div className="section-label">
                <span />
                Coba tanyakan kepada
                Erza
                <span />
              </div>

              <div className="suggestion-grid">
                {SUGGESTIONS.map(
                  (item) => (
                    <button
                      key={
                        item.label
                      }
                      className="suggestion-card"
                      onClick={() =>
                        chooseSuggestion(
                          item.text,
                        )
                      }
                    >
                      <span className="suggestion-icon">
                        {
                          item.icon
                        }
                      </span>

                      <span className="suggestion-content">
                        <strong>
                          {
                            item.label
                          }
                        </strong>

                        <small>
                          Tanyakan kepada
                          Erza
                        </small>
                      </span>
                    </button>
                  ),
                )}
              </div>
            </section>
          )}

        <div className="ai-status">
          <span className="status-dot" />

          {loading
            ? "Erza sedang berpikir..."
            : "Erza siap membantu Papa"}
        </div>
      </main>

      {/* COMPOSER */}

      <div className="composer-area">
        {attachment && (
          <div className="attachment-preview">
            <div className="attachment-preview-main">
              {attachmentPreview ? (
                <img src={attachmentPreview} alt={attachment.name} />
              ) : (
                <div className="attachment-file-icon">
                  <MessageSquare size={18} />
                </div>
              )}
              <div className="attachment-info">
                <strong>{attachment.name}</strong>
                <span>{formatFileSize(attachment.size)}</span>
              </div>
            </div>
            <button
              className="attachment-remove"
              onClick={removeAttachment}
              aria-label="Hapus lampiran"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="composer">
          <button
            className={`composer-plus ${attachmentMenuOpen ? "active" : ""}`}
            aria-label="Tambah"
            onClick={() => setAttachmentMenuOpen((value) => !value)}
          >
            {attachmentMenuOpen ? <X size={19} /> : <Plus size={20} />}
          </button>

          {attachmentMenuOpen && (
            <div className="attachment-menu">
              <label className="attachment-option">
                <span className="attachment-option-icon">📷</span>
                <span><strong>Foto</strong><small>JPG, PNG, WEBP</small></span>
                <input type="file" accept="image/*" onChange={handleFileSelect} />
              </label>
              <label className="attachment-option">
                <span className="attachment-option-icon">📄</span>
                <span><strong>Dokumen</strong><small>PDF, DOC, TXT</small></span>
                <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleFileSelect} />
              </label>
              <label className="attachment-option">
                <span className="attachment-option-icon">📎</span>
                <span><strong>File</strong><small>File lainnya</small></span>
                <input type="file" onChange={handleFileSelect} />
              </label>
            </div>
          )}

          <input
            value={message}
            disabled={loading}
            onChange={(event) =>
              setMessage(
                event.target.value,
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                  "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              loading
                ? "Erza sedang berpikir..."
                : "Tulis pesan untuk Erza..."
            }
          />

          <button
            className="mic-button"
            aria-label="Voice"
            disabled={loading}
          >
            <Mic size={19} />
          </button>

          <button
            className={`send-button ${
              message.trim() &&
              !loading
                ? "active"
                : ""
            }`}
            onClick={
              handleSend
            }
            disabled={
              (!message.trim() && !attachment) ||
              loading
            }
            aria-label="Kirim"
          >
            <Send size={18} />
          </button>
        </div>

        <p className="composer-note">
          Erza AI dapat membantu
          dengan bisnis, coding,
          analisis, ide, dan berbagai
          kebutuhan Papa.
        </p>
      </div>
    </div>
  );
}

export default App;

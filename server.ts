import express from "express";
import cors from "cors";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const app = express();

app.use(cors());

app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// ========================================
// CHAT
// ========================================

app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    console.log("CHAT MASUK:", message);

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Message is required",
      });
    }

const text = message.trim();

let currentSessionId = sessionId;

if (!currentSessionId) {
  const { data: newSession, error: sessionError } =
    await supabase
      .from("chat_sessions")
      .insert({
        title:
          text.length > 50
            ? text.slice(0, 50) + "..."
            : text,
      })
      .select()
      .single();

  if (sessionError) {
    console.error("SESSION CREATE ERROR:", sessionError);

    return res.status(500).json({
      error: "Erza gagal membuat percakapan.",
    });
  }

  currentSessionId = newSession.id;
}

const { error: userMessageError } = await supabase
  .from("chat_messages")
  .insert({
    session_id: currentSessionId,
    role: "user",
    content: text,
  });

if (userMessageError) {
  console.error(
    "USER MESSAGE SAVE ERROR:",
    userMessageError
  );
}

const lowerText = text.toLowerCase();

// ========================================
// OTOMATIS SIMPAN MEMORY
// ========================================

const memoryTriggers = [
  "ingat bahwa",
  "ingat kalau",
  "ingat ya",
  "tolong ingat",
  "simpan bahwa",
  "catat bahwa",
  "catat ya",
];

const forgetTriggers = [
  "lupakan bahwa",
  "lupakan kalau",
  "lupakan ya",
  "tolong lupakan",
  "hapus memory",
  "hapus ingatan",
];

const isForgetRequest = forgetTriggers.some((trigger) =>
  lowerText.includes(trigger)
);

if (isForgetRequest) {
  const trigger = forgetTriggers.find((item) =>
    lowerText.includes(item)
  );

  let memoryText = text;

  if (trigger) {
    const index = lowerText.indexOf(trigger);

    memoryText = text
      .slice(index + trigger.length)
      .trim();
  }

  if (!memoryText) {
    return res.json({
      answer:
        "Memory mana yang ingin Papa lupakan?",
    });
  }

  const { data: matchingMemories, error: findError } =
    await supabase
      .from("memories")
      .select("id, memory")
      .ilike("memory", `%${memoryText}%`);

  if (findError) {
    console.error("MEMORY FIND ERROR:", findError);

    return res.status(500).json({
      error: "Erza gagal mencari memory.",
    });
  }

  if (!matchingMemories || matchingMemories.length === 0) {
    return res.json({
      answer:
        "Erza tidak menemukan memory tersebut, Papa.",
    });
  }

  const ids = matchingMemories.map((item) => item.id);

  const { error: deleteError } = await supabase
    .from("memories")
    .delete()
    .in("id", ids);

  if (deleteError) {
    console.error("MEMORY DELETE ERROR:", deleteError);

    return res.status(500).json({
      error: "Erza gagal menghapus memory.",
    });
  }

  console.log(
    "MEMORY DIHAPUS:",
    matchingMemories.map((item) => item.memory)
  );

  return res.json({
    answer:
      `Siap Papa, ${matchingMemories.length} memory sudah Erza lupakan. 🧠`,
  });
}

const isMemoryRequest = memoryTriggers.some((trigger) =>
  lowerText.includes(trigger)
);

if (isMemoryRequest) {
  const trigger = memoryTriggers.find((item) =>
    lowerText.includes(item)
  );

  let memoryText = text;

  if (trigger) {
    const index = lowerText.indexOf(trigger);

    memoryText = text
      .slice(index + trigger.length)
      .trim();
  }

  if (!memoryText) {
    return res.json({
      answer:
        "Apa yang ingin Papa Erza ingat?",
    });
  }

  // Cek apakah memory sudah ada
  const { data: existingMemories, error: checkError } =
    await supabase
      .from("memories")
      .select("id, memory")
      .ilike("memory", memoryText);

  if (checkError) {
    console.error("MEMORY CHECK ERROR:", checkError);

    return res.status(500).json({
      error: "Erza gagal memeriksa memory.",
    });
  }

  if (existingMemories && existingMemories.length > 0) {
    return res.json({
      answer:
        "Itu sudah ada di memory Erza, Papa. 🧠",
    });
  }

  const { error: saveError } = await supabase
    .from("memories")
    .insert({
      memory: memoryText,
    });

  if (saveError) {
    console.error("MEMORY SAVE ERROR:", saveError);

    return res.status(500).json({
      error:
        "Erza gagal menyimpan memory ke Supabase.",
    });
  }

  console.log(
    "MEMORY BERHASIL DISIMPAN:",
    memoryText
  );

  return res.json({
    answer:
      "Siap Papa, sudah Erza simpan di memory. 🧠",
  });
}

    // ========================================
    // AMBIL MEMORY
    // ========================================

    const { data: memories, error: memoryError } =
      await supabase
        .from("memories")
        .select("memory")
        .order("created_at", {
          ascending: false,
        })
        .limit(20);

    if (memoryError) {
      console.error("MEMORY READ ERROR:", memoryError);
    }

    const memoryContext =
      memories && memories.length > 0
        ? memories
            .map((item) => `- ${item.memory}`)
            .join("\n")
        : "Belum ada memory tersimpan.";

    // ========================================
    // PERTANYAAN TENTANG MEMORY
    // ========================================

    const memoryQuestionTriggers = [
      "apa yang kamu ingat",
      "apa yang kau ingat",
      "apa saja yang kamu ingat",
      "ingatanku",
      "memory saya",
      "memory papa",
      "apa yang kamu simpan",
    ];

    const isMemoryQuestion =
      memoryQuestionTriggers.some((trigger) =>
        lowerText.includes(trigger)
      );

    if (isMemoryQuestion) {
      if (!memories || memories.length === 0) {
        return res.json({
          answer:
            "Saat ini Erza belum memiliki memory tersimpan, Papa.",
        });
      }

      const answer =
        "Tentu Papa. Ini yang Erza ingat:\n\n" +
        memories
          .map(
            (item, index) =>
              `${index + 1}. ${item.memory}`
          )
          .join("\n");

      return res.json({
        answer,
      });
    }

    // ========================================
    // GROQ
    // ========================================

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",

      messages: [
        {
          role: "system",
          content: `
Kamu adalah Erza AI, asisten pribadi Papa.

IDENTITAS:
- Nama kamu adalah Erza.
- Panggil pengguna dengan sebutan "Papa".
- Kamu adalah AI Assistant yang ramah, cerdas, sabar, dan membantu.

GAYA:
- Gunakan bahasa Indonesia jika Papa menggunakan bahasa Indonesia.
- Gunakan bahasa yang natural dan santai.
- Jangan terlalu formal kecuali diminta.
- Jawab dengan jelas dan praktis.
- Jika Papa belajar coding, jelaskan langkah demi langkah.
- Jika Papa mengalami error, bantu mencari penyebabnya dengan tenang.

FOKUS:
- Pertanyaan umum.
- Teknologi dan coding.
- Belajar.
- Ide dan brainstorming.
- Penulisan.
- Analisis masalah.
- Percakapan sehari-hari.

MEMORY PAPA:
Berikut informasi yang sebelumnya disimpan Papa:

${memoryContext}

Gunakan memory tersebut jika relevan dengan pertanyaan Papa.
Jangan mengatakan bahwa kamu mengetahui sesuatu dari memory jika tidak relevan.
Jangan mengarang memory yang tidak ada.

Jika informasi tidak ada di memory, katakan dengan jujur bahwa kamu belum mengetahui atau mengingat informasi tersebut.
`,
        },

        {
          role: "user",
          content: text,
        },
      ],
    });

    const answer =
      completion.choices[0]?.message?.content ||
      "Maaf Papa, Erza belum mendapatkan jawaban.";

    console.log("GROQ MENJAWAB");

const { error: assistantMessageError } =
  await supabase
    .from("chat_messages")
    .insert({
      session_id: currentSessionId,
      role: "assistant",
      content: answer,
    });

if (assistantMessageError) {
  console.error(
    "ASSISTANT MESSAGE SAVE ERROR:",
    assistantMessageError
  );
}

await supabase
  .from("chat_sessions")
  .update({
    updated_at: new Date().toISOString(),
  })
  .eq("id", currentSessionId);

return res.json({
  answer,
  sessionId: currentSessionId,
});

  } catch (error) {
    console.error("GROQ ERROR:", error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan pada Erza AI.",
    });
  }
});

// ========================================
// SIMPAN MEMORY MANUAL
// ========================================

app.post("/api/memory", async (req, res) => {
  try {
    const { memory } = req.body;

    if (!memory || !memory.trim()) {
      return res.status(400).json({
        error: "Memory tidak boleh kosong",
      });
    }

    const { data, error } = await supabase
      .from("memories")
      .insert({
        memory: memory.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error("MEMORY SAVE ERROR:", error);

      return res.status(500).json({
        error: error.message,
      });
    }

    console.log("MEMORY BERHASIL DISIMPAN:", data);

    return res.status(200).json({
      success: true,
      memory: data,
    });
  } catch (error) {
    console.error("MEMORY ERROR:", error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Memory error",
    });
  }
});

// ========================================
// BACA SEMUA MEMORY
// ========================================

app.get("/api/memories", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("memories")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("MEMORY READ ERROR:", error);

      return res.status(500).json({
        error: error.message,
      });
    }

    return res.json({
      memories: data,
    });
  } catch (error) {
    console.error("MEMORY READ ERROR:", error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Memory read error",
    });
  }
});

// ========================================
// CHAT SESSIONS
// ========================================

app.get("/api/sessions", async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("updated_at", {
        ascending: false,
      });

    if (error) {
      console.error("SESSION READ ERROR:", error);

      return res.status(500).json({
        error: error.message,
      });
    }

    return res.json({
      sessions: data,
    });
  } catch (error) {
    console.error("SESSION READ ERROR:", error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Session read error",
    });
  }
});
// ========================================
// SERVER
// ========================================

const PORT = Number(process.env.PORT) || 3001;

export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Erza AI API berjalan di port ${PORT}`
    );
  });
}
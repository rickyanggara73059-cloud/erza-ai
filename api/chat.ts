import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { message, previousInteractionId } = req.body;

    const interaction = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: message,
      previous_interaction_id: previousInteractionId || undefined,
    });

    return res.status(200).json({
      answer: interaction.output_text,
      interactionId: interaction.id,
    });
  } catch (error) {
    console.error("GEMINI API ERROR:", error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Gemini API error",
    });
  }
}
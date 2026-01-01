
import { GoogleGenAI, Type } from "@google/genai";
import { VisionResponse } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the schema for dart scoring. 
// Added 'message' property to ensure consistency with the VisionResponse interface.
const scoringSchema = {
  type: Type.OBJECT,
  properties: {
    detected: { type: Type.BOOLEAN },
    message: { type: Type.STRING, description: "A brief summary of the detection result." },
    darts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          zone: { type: Type.STRING, description: "Settore e anello (es. 'T20', 'D16', 'S1', 'BULL')." },
          score: { type: Type.NUMBER },
          coordinates: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: "X della punta (0-1000)." },
              y: { type: Type.NUMBER, description: "Y della punta (0-1000)." }
            },
            required: ["x", "y"]
          }
        },
        required: ["zone", "score", "coordinates"]
      }
    },
    totalScore: { type: Type.NUMBER },
    confidence: { type: Type.NUMBER, description: "0.0 a 1.0" }
  },
  required: ["detected", "message", "darts", "totalScore"]
};

export const analyzeCalibration = async (base64Image: string): Promise<VisionResponse> => {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
          { text: "Il bersaglio è centrato? I numeri 1-20 sono leggibili? Rispondi in JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detected: { type: Type.BOOLEAN },
            sectorsIdentified: { type: Type.BOOLEAN },
            message: { type: Type.STRING }
          },
          required: ["detected", "sectorsIdentified", "message"]
        }
      }
    });
    return JSON.parse(response.text || '{}') as VisionResponse;
  } catch (error) {
    return { detected: false, message: "Errore calibrazione", sectorsIdentified: false };
  }
};

export const analyzeScore = async (base64Image: string): Promise<VisionResponse> => {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Passaggio al modello Pro per massima precisione
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
          { text: `Analisi Geometrica Bersaglio:
          1. Orienta il bersaglio (20 in alto, 3 in basso, 6 a destra, 11 a sinistra).
          2. Individua ogni freccetta. Segui l'asta fino al punto esatto in cui la PUNTA tocca il bersaglio.
          3. Distingui con estrema cura tra:
             - Anello dei Tripli (stretto, circa a metà raggio)
             - Anello dei Doppi (stretto, sul bordo esterno)
             - Bullseye (centro rosso, 50 pt) e Outer Bull (anello verde, 25 pt)
          4. Se la punta tocca il filo metallico (spider), assegna il punteggio del settore in cui la punta è maggiormente inserita.
          Restituisci JSON con coordinate X,Y (0-1000) della punta.` }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 16000 }, // Budget elevato per analisi spaziale profonda
        responseMimeType: "application/json",
        responseSchema: scoringSchema,
        systemInstruction: "Sei un arbitro professionista di freccette. La tua missione è la precisione millimetrica. Non inventare freccette se non sono chiaramente conficcate. Ignora le freccette che sono cadute o non toccano il bersaglio."
      }
    });
    return JSON.parse(response.text || '{}') as VisionResponse;
  } catch (error) {
    console.error("Errore analisi Pro:", error);
    // Fixed: Added missing 'message' property to satisfy the VisionResponse interface.
    return { detected: false, message: "Errore durante l'analisi del punteggio", totalScore: 0, darts: [] };
  }
};

import { GoogleGenAI, Type } from "@google/genai";
import { VisionResponse } from '../types';
import { preprocessDartImage } from '../utils/imageProcessing';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const scoringSchema = {
  type: Type.OBJECT,
  properties: {
    detected: { type: Type.BOOLEAN, description: "True se il bersaglio è visibile." },
    message: { type: Type.STRING, description: "Feedback testuale." },
    darts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          zone: { type: Type.STRING, description: "Zona colpita (es. T20, D15, Bull)." },
          score: { type: Type.NUMBER, description: "Punteggio numerico." },
          coordinates: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: "Coordinata X (0-1000)." },
              y: { type: Type.NUMBER, description: "Coordinata Y (0-1000)." }
            },
            required: ["x", "y"]
          }
        },
        required: ["zone", "score", "coordinates"]
      }
    },
    totalScore: { type: Type.NUMBER, description: "Somma dei punti delle freccette rilevate." }
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
          { text: "È presente un bersaglio da freccette? I settori (1-20, double, triple) sono chiaramente identificabili? Rispondi in JSON: {detected: boolean, sectorsIdentified: boolean, message: string}" }
        ]
      },
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return JSON.parse(response.text || '{}') as VisionResponse;
  } catch (error) {
    return { detected: false, message: "Err", sectorsIdentified: false };
  }
};

export const analyzeScore = async (base64Image: string): Promise<VisionResponse> => {
  try {
    // 1. Pipeline di pre-processing avanzata: otteniamo versione a colori e mappa dei bordi
    const { enhanced, edges } = await preprocessDartImage(base64Image);
    const cleanEnhanced = enhanced.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    const cleanEdges = edges.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    // 2. Chiamata a Gemini 3 Flash con multi-modal input
    // L'immagine 'edges' aiuta il modello a isolare le aste sottili delle freccette
    // L'immagine 'enhanced' aiuta a distinguere i colori dei settori (rosso/verde)
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanEnhanced } },
          { inlineData: { mimeType: "image/jpeg", data: cleanEdges } },
          { text: "Analizza le due immagini: la prima è a colori contrastati, la seconda è una mappa dei bordi. Identifica le freccette conficcate, calcola la zona e le coordinate relative (0-1000). Rispondi esclusivamente in formato JSON." }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: scoringSchema
      }
    });

    return JSON.parse(response.text || '{}') as VisionResponse;
  } catch (error) {
    console.error("Scoring Error:", error);
    return { detected: false, message: "Error", totalScore: 0, darts: [] };
  }
};
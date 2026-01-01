import { GoogleGenAI, Type } from "@google/genai";
import { VisionResponse } from '../types';
import { preprocessDartImage } from '../utils/imageProcessing';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const scoringSchema = {
  type: Type.OBJECT,
  properties: {
    detected: { type: Type.BOOLEAN, description: "True se il bersaglio è visibile e correttamente inquadrato." },
    message: { type: Type.STRING, description: "Feedback sullo stato del rilevamento." },
    darts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          zone: { type: Type.STRING },
          score: { type: Type.NUMBER },
          coordinates: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER },
              y: { type: Type.NUMBER }
            },
            required: ["x", "y"]
          }
        },
        required: ["zone", "score", "coordinates"]
      }
    },
    totalScore: { type: Type.NUMBER },
    confidence: { type: Type.NUMBER }
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
          { text: "Bersaglio visibile? Rispondi JSON: {detected:bool, sectorsIdentified:bool, message:string}" }
        ]
      },
      config: {
        responseMimeType: "application/json",
        // Usiamo un budget di pensiero nullo per la calibrazione per massimizzare la velocità
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return JSON.parse(response.text || '{}') as VisionResponse;
  } catch (error) {
    return { detected: false, message: "Riprova...", sectorsIdentified: false };
  }
};

export const analyzeScore = async (base64Image: string): Promise<VisionResponse> => {
  try {
    const { enhanced, edges } = await preprocessDartImage(base64Image);
    const cleanEnhanced = enhanced.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    const cleanEdges = edges.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanEnhanced } },
          { inlineData: { mimeType: "image/jpeg", data: cleanEdges } },
          { text: "Analizza posizione punte freccette rispetto allo spider. Restituisci JSON con zone e coordinate." }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 24000 },
        maxOutputTokens: 30000,
        responseMimeType: "application/json",
        responseSchema: scoringSchema
      }
    });

    return JSON.parse(response.text || '{}') as VisionResponse;
  } catch (error) {
    console.error("Score Error:", error);
    return { detected: false, message: "Errore analisi.", totalScore: 0, darts: [] };
  }
};
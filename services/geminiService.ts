import { GoogleGenAI, Type } from "@google/genai";
import { VisionResponse } from '../types';
import { preprocessDartImage } from '../utils/imageProcessing';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const scoringSchema = {
  type: Type.OBJECT,
  properties: {
    detected: { type: Type.BOOLEAN },
    message: { type: Type.STRING },
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
    totalScore: { type: Type.NUMBER }
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
          { text: "Target present? JSON: {detected:bool, message:string}" }
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
    // 1. Pre-processing rapido (singola immagine)
    const { enhanced } = await preprocessDartImage(base64Image);
    const cleanEnhanced = enhanced.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    // 2. Chiamata a Gemini 3 Flash (High Speed)
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanEnhanced } },
          { text: "Arbitro: identifica zona e coordinate (0-1000) delle freccette. Rispondi solo JSON." }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 0 }, // ZERO LATENCY THINKING
        responseMimeType: "application/json",
        responseSchema: scoringSchema
      }
    });

    return JSON.parse(response.text || '{}') as VisionResponse;
  } catch (error) {
    return { detected: false, message: "Error", totalScore: 0, darts: [] };
  }
};

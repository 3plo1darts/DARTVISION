import { GoogleGenAI, Type, Schema } from "@google/genai";
import { VisionResponse } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const scoringSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    detected: { type: Type.BOOLEAN, description: "True se il bersaglio è visibile." },
    darts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          zone: { type: Type.STRING, description: "Esempio: 'T20', 'D15', 'S5', 'BULL', 'OUTER'." },
          score: { type: Type.NUMBER, description: "Valore numerico." },
          coordinates: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: "Coordinata X della PUNTA (0-1000)." },
              y: { type: Type.NUMBER, description: "Coordinata Y della PUNTA (0-1000)." }
            },
            required: ["x", "y"]
          }
        },
        required: ["zone", "score", "coordinates"]
      }
    },
    totalScore: { type: Type.NUMBER }
  },
  required: ["detected", "darts", "totalScore"]
};

const calibrationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    detected: { type: Type.BOOLEAN },
    sectorsIdentified: { type: Type.BOOLEAN },
    message: { type: Type.STRING }
  },
  required: ["detected", "sectorsIdentified", "message"]
};

export const analyzeCalibration = async (base64Image: string): Promise<VisionResponse> => {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
          { text: "Verifica se il bersaglio da freccette è centrato e ben visibile. Ignora eventuali freccette presenti. Rispondi in JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: calibrationSchema,
        systemInstruction: "Sei un esperto di installazioni per tornei di freccette. Assicurati che l'inquadratura permetta di distinguere i fili (spider) del bersaglio."
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
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
          { text: "Individua TUTTE le freccette conficcate nel bersaglio. Per ogni freccetta: 1. Identifica il corpo. 2. Segui la direzione fino alla punta esatta. 3. Determina il settore (1-20) e l'anello (Singolo, Doppio, Triplo, Bullseye). Calcola il punteggio totale sommando le freccette rilevate. Rispondi SOLO in JSON." }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 4000 }, // Aggiunto budget di ragionamento per la precisione millimetrica
        responseMimeType: "application/json",
        responseSchema: scoringSchema,
        systemInstruction: "Sei un arbitro ufficiale di freccette (PDC). La tua precisione deve essere assoluta, specialmente tra l'anello dei tripli e i settori singoli adiacenti. Analizza i pixel attorno alla punta per decidere il punteggio."
      }
    });
    return JSON.parse(response.text || '{}') as VisionResponse;
  } catch (error) {
    console.error("Errore analisi:", error);
    return { detected: false, message: "Errore analisi", totalScore: 0, darts: [] };
  }
};
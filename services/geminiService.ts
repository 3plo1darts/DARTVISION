import { GoogleGenAI, Type } from "@google/genai";
import { VisionResponse } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const scoringSchema = {
  type: Type.OBJECT,
  properties: {
    detected: { type: Type.BOOLEAN, description: "True se il bersaglio è visibile." },
    message: { type: Type.STRING, description: "Descrizione dello stato corrente." },
    darts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          zone: { type: Type.STRING, description: "Settore e anello (es. 'T20', 'D16', 'S1', 'BULL')." },
          score: { type: Type.NUMBER, description: "Valore numerico del tiro." },
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
    totalScore: { type: Type.NUMBER, description: "Somma dei punteggi delle freccette visibili." },
    confidence: { type: Type.NUMBER, description: "Livello di certezza del rilevamento (0-1)." }
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
          { text: "Analizza la posizione del bersaglio. È centrato? I numeri sono leggibili? Rispondi in JSON." }
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
    return { detected: false, message: "Errore durante la calibrazione ottica.", sectorsIdentified: false };
  }
};

export const analyzeScore = async (base64Image: string): Promise<VisionResponse> => {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
          { text: `ISTRUZIONI ARBITRO PDC:
          1. Identifica il centro esatto (BULLSEYE) per calibrare lo spazio.
          2. Orienta i settori (20 è l'apice verticale).
          3. Per ogni freccetta conficcata:
             - Individua l'asta e seguila fino alla punta metallica.
             - Determina se la punta è nel settore Singolo (S), Doppio (D) o Triplo (T).
             - Sii estremamente pignolo sui fili metallici (spider): se la punta è all'interno del filo del triplo, è T.
          4. Se una freccetta ne copre un'altra, usa la prospettiva per stimare la posizione della punta coperta.
          RESTITUISCI SOLO JSON.` }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 20000 },
        maxOutputTokens: 25000,
        responseMimeType: "application/json",
        responseSchema: scoringSchema,
        systemInstruction: "Sei un sistema di visione computerizzata ad alta precisione per tornei di freccette. La tua analisi deve essere oggettiva e millimetrica. Ignora freccette cadute a terra."
      }
    });
    return JSON.parse(response.text || '{}') as VisionResponse;
  } catch (error) {
    console.error("Pro Analysis Error:", error);
    return { 
      detected: false, 
      message: "L'AI ha riscontrato un problema nell'analisi spaziale.", 
      totalScore: 0, 
      darts: [] 
    };
  }
};
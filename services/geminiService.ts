import { GoogleGenAI, Type } from "@google/genai";
import { VisionResponse } from '../types';
import { preprocessDartImage } from '../utils/imageProcessing';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const scoringSchema = {
  type: Type.OBJECT,
  properties: {
    detected: { type: Type.BOOLEAN, description: "True se il bersaglio è visibile e correttamente inquadrato." },
    message: { type: Type.STRING, description: "Feedback sullo stato del rilevamento (es. 'Board found', 'Shadows too strong')." },
    darts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          zone: { type: Type.STRING, description: "Identificativo settore (es. 'T20', 'D16', 'S1', 'BULL', 'OUTER BULL')." },
          score: { type: Type.NUMBER, description: "Valore numerico (es. 60 per T20)." },
          coordinates: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: "Coordinata X della punta della freccetta (0-1000)." },
              y: { type: Type.NUMBER, description: "Coordinata Y della punta della freccetta (0-1000)." }
            },
            required: ["x", "y"]
          }
        },
        required: ["zone", "score", "coordinates"]
      }
    },
    totalScore: { type: Type.NUMBER, description: "Punteggio totale delle freccette attualmente nel bersaglio." },
    confidence: { type: Type.NUMBER, description: "Grado di certezza complessivo dell'analisi (0-1)." }
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
          { text: "Verifica se il bersaglio da freccette è centrato, parallelo alla fotocamera e ben illuminato. Rispondi in JSON." }
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

/**
 * Refactored analyzeScore:
 * Implements a "Robust Pipeline" by sending multiple versions of the same frame.
 * 1. An Enhanced Color Frame for shaft/flight recognition.
 * 2. An Edge-Detected High-Contrast Frame for precise tip-to-spider alignment.
 */
export const analyzeScore = async (base64Image: string): Promise<VisionResponse> => {
  try {
    // Pipeline Step 1: Pre-process the image
    const { enhanced, edges } = await preprocessDartImage(base64Image);
    
    const cleanEnhanced = enhanced.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    const cleanEdges = edges.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    // Pipeline Step 2: Multimodal analysis with dual-view context
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanEnhanced } },
          { inlineData: { mimeType: "image/jpeg", data: cleanEdges } },
          { text: `SISTEMA DI VISIONE ARBITRALE PDC - DOPPIA VISTA:
          Ti vengono fornite due immagini dello stesso frame: 
          1. Versione a colori migliorata (per distinguere freccette e ombre).
          2. Mappa dei contorni ad alto contrasto (per vedere lo 'spider' metallico).

          COMPITI:
          - Usa la Mappa dei Contorni per localizzare precisamente i fili metallici del bersaglio.
          - Usa l'Immagine a Colori per confermare che l'oggetto sia una freccetta e non un riflesso.
          - Identifica il punto ESATTO di contatto tra la punta della freccetta e il bersaglio.
          - Zone critiche: Tripli (anello interno), Doppi (anello esterno), Bullseye (rosso), Outer Bull (verde).
          - Restituisci il punteggio accumulato per tutte le freccette visibili.

          Sii millimetrico. Se una punta è sulla linea, assegna il settore interno.` }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 24000 }, // Aumentato budget per gestire il doppio input
        maxOutputTokens: 30000,
        responseMimeType: "application/json",
        responseSchema: scoringSchema,
        systemInstruction: "Sei un arbitro AI esperto. Analizzi pixel per pixel la relazione tra le freccette e la rete metallica (spider). Non omettere freccette se sono chiaramente presenti."
      }
    });

    return JSON.parse(response.text || '{}') as VisionResponse;
  } catch (error) {
    console.error("Robust Pipeline Analysis Error:", error);
    return { 
      detected: false, 
      message: "L'AI ha riscontrato un problema nel processo di analisi multi-vista.", 
      totalScore: 0, 
      darts: [] 
    };
  }
};

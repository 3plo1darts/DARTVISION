import { GoogleGenAI, Type, Schema } from "@google/genai";
import { VisionResponse } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const calibrationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    detected: { type: Type.BOOLEAN, description: "True se il bersaglio è chiaramente visibile e centrato." },
    sectorsIdentified: { type: Type.BOOLEAN, description: "True se i settori numerici (20, 1, 18, ecc.) sono distinguibili." },
    message: { type: Type.STRING, description: "Un breve messaggio di stato sulla visibilità o illuminazione in italiano." }
  },
  required: ["detected", "sectorsIdentified", "message"]
};

const scoringSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    detected: { type: Type.BOOLEAN, description: "True SOLO se il bersaglio è chiaramente visibile nel frame." },
    message: { type: Type.STRING, description: "Messaggio di stato in italiano." },
    darts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          zone: { type: Type.STRING, description: "Il segmento colpito in italiano, es: 'Singolo 20', 'Triplo 19', 'Centro', 'Fuori'." },
          score: { type: Type.NUMBER, description: "Il valore numerico del punteggio." },
          coordinates: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER, description: "Coordinata X della punta della freccetta su griglia 1000x1000." },
              y: { type: Type.NUMBER, description: "Coordinata Y della punta della freccetta su griglia 1000x1000." }
            },
            required: ["x", "y"]
          }
        },
        required: ["zone", "score", "coordinates"]
      }
    },
    totalScore: { type: Type.NUMBER, description: "Somma di tutte le freccette visibili." }
  },
  required: ["detected", "darts", "totalScore"]
};

/**
 * Analyzes a base64 image for dartboard calibration using the latest Gemini 3 model.
 */
export const analyzeCalibration = async (base64Image: string): Promise<VisionResponse> => {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
          { text: "Analizza questa immagine scattata da un cellulare. C'è un bersaglio per freccette standard (London pattern)? È centrato e i numeri sono leggibili? Ignora le freccette presenti. Rispondi solo in formato JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: calibrationSchema,
        systemInstruction: "Sei un arbitro esperto. Devi assicurarti che il setup mobile sia perfetto. Se il bersaglio è troppo lontano o storto, chiedi di correggerlo. Sii conciso e rispondi in italiano."
      }
    });

    return JSON.parse(response.text || '{}') as VisionResponse;
  } catch (error) {
    console.error("Gemini Calibration Error:", error);
    return { detected: false, message: "Errore connessione", sectorsIdentified: false };
  }
};

/**
 * Analyzes a base64 image to score darts with high precision.
 */
export const analyzeScore = async (base64Image: string): Promise<VisionResponse> => {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
          { text: "Analizza questa foto di un bersaglio con freccette. Individua esattamente dove la punta di ogni freccetta tocca il bersaglio. Fornisci coordinate X,Y (0-1000) e il punteggio corrispondente (es. Triple 20). Rispondi solo in JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: scoringSchema,
        systemInstruction: "Sei il segnapunti ufficiale. Guarda bene i tripli e i doppi. Se una freccetta è nel 'Centro' (Bullseye) o 'Cerchio esterno' (Outer Bull), specificalo chiaramente. Usa nomi zone in italiano."
      }
    });

    return JSON.parse(response.text || '{}') as VisionResponse;
  } catch (error) {
    console.error("Gemini Scoring Error:", error);
    return { detected: false, message: "Errore analisi", totalScore: 0, darts: [] };
  }
};
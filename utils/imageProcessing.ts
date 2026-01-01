/**
 * Pipeline di elaborazione immagini ottimizzata per DartVision.
 * Genera una versione ad alto contrasto/colore e una mappa dei bordi
 * per aiutare l'AI a isolare le freccette.
 */

export const preprocessDartImage = async (base64: string): Promise<{ enhanced: string; edges: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject('No context');

      // Risoluzione di analisi bilanciata (1024px è un buon compromesso tra dettaglio e velocità)
      const TARGET_WIDTH = 1024;
      const scale = TARGET_WIDTH / img.width;
      canvas.width = TARGET_WIDTH;
      canvas.height = img.height * scale;

      // --- 1. Generazione Immagine Enhanced (Colore e Contrasto) ---
      // Boost del rosso e del verde (colori tipici dei settori e delle freccette)
      ctx.filter = 'contrast(1.4) saturate(1.8) brightness(1.1)';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const enhanced = canvas.toDataURL('image/jpeg', 0.8);

      // --- 2. Generazione Mappa dei Bordi (Sobel Filter) ---
      // Ripuliamo il filtro per l'elaborazione manuale dei pixel
      ctx.filter = 'none';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      // Convertiamo in scala di grigi per Sobel
      const gray = new Uint8ClampedArray(width * height);
      for (let i = 0; i < data.length; i += 4) {
        gray[i / 4] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      }

      const sobelData = new Uint8ClampedArray(width * height);
      const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let resX = 0;
          let resY = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixel = gray[(y + ky) * width + (x + kx)];
              resX += pixel * gx[(ky + 1) * 3 + (kx + 1)];
              resY += pixel * gy[(ky + 1) * 3 + (kx + 1)];
            }
          }
          const mag = Math.sqrt(resX * resX + resY * resY);
          // Thresholding leggero per isolare le linee (le freccette sono linee dritte e nette)
          sobelData[y * width + x] = mag > 40 ? Math.min(255, mag * 2) : 0;
        }
      }

      // Scriviamo i bordi nel canvas (bianco su nero)
      for (let i = 0; i < data.length; i += 4) {
        const val = sobelData[i / 4];
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
      const edges = canvas.toDataURL('image/jpeg', 0.6);

      resolve({ enhanced, edges });
    };
    img.onerror = reject;
    img.src = base64;
  });
};

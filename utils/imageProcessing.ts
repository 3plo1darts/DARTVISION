/**
 * Utility ultra-leggera per il pre-processing.
 * Si limita a migliorare il contrasto per l'AI senza calcoli pesanti sui bordi.
 */
export const preprocessDartImage = async (base64: string): Promise<{ enhanced: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No context');

      // Risoluzione bilanciata: sufficiente per vedere lo spider, leggera da inviare
      const MAX_WIDTH = 1280;
      const scale = Math.min(1, MAX_WIDTH / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      // Miglioramento visivo rapido (hardware accelerated in molti browser)
      ctx.filter = 'contrast(1.3) brightness(1.1) sharpness(1.0)';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      resolve({ enhanced: canvas.toDataURL('image/jpeg', 0.7) });
    };
    img.onerror = reject;
    img.src = base64;
  });
};

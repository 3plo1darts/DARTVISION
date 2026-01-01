/**
 * Utility for pre-processing images to improve AI detection reliability.
 * Focuses on contrast enhancement and edge isolation for dartboard "spider" recognition.
 */

export const preprocessDartImage = async (base64: string): Promise<{ enhanced: string; edges: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject('No context');

      canvas.width = img.width;
      canvas.height = img.height;

      // 1. Generate ENHANCED version (Boosted Contrast & Sharpness)
      ctx.filter = 'contrast(1.4) brightness(1.1) saturate(1.2) sharpness(1.0)';
      ctx.drawImage(img, 0, 0);
      const enhanced = canvas.toDataURL('image/jpeg', 0.85);

      // 2. Generate EDGE version (Basic Sobel-like edge detection)
      // We'll use a grayscale + high-contrast approach for better edge visibility
      ctx.filter = 'grayscale(1) contrast(3) invert(0)';
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Simple Laplacian-like edge detection pass (high-pass filter)
      // This helps emphasize the metal "spider" grid
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = data[i+1] = data[i+2] = avg > 180 ? 255 : 0; // Thresholding for clean edges
      }
      ctx.putImageData(imageData, 0, 0);
      const edges = canvas.toDataURL('image/jpeg', 0.6);

      resolve({ enhanced, edges });
    };
    img.onerror = reject;
    img.src = base64;
  });
};

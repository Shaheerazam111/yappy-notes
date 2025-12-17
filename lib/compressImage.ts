import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file and converts it to base64
 * @param file - The image file to compress
 * @returns Base64 string of the compressed image
 */
export async function compressImageToBase64(file: File): Promise<string> {
  const options = {
    maxSizeMB: 0.5, // Maximum size in MB
    maxWidthOrHeight: 1920, // Maximum width or height
    useWebWorker: true,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(compressedFile);
    });
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
}


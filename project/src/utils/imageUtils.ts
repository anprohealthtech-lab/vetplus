export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]); // Extract Base64 part
      } else {
        reject(new Error('Failed to convert file to Base64'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

const dataURLtoBase64 = (dataURL: string): string => {
  return dataURL.split(',')[1];
};

export { dataURLtoBase64 };
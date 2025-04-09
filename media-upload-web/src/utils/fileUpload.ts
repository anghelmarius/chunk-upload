'use strict'
import axios from 'axios';

const CHUNK_SIZE = 1 * 1024 * 1024; //1 MB

export const initiateUpload = async (filename: string, fileSize: number): Promise<string | null> => {
  try {
    const response = await axios.post('http://127.0.0.1:8000/initiate', {
      filename,
      fileSize,
    });

    return response.data.uploadId;
  } catch (error) {
    console.error('Error initiating upload:', error);
    return null;
  }
};

export const uploadChunk = async (
  file: File,
  uploadId: string,
  originalFilename: string,
  onProgress: (progress: number) => void
): Promise<boolean> => {
  if (!(file instanceof Blob)) {
    console.error('Invalid file object passed to uploadChunk:', file);
    return false;
  }

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  let uploadedChunks = 0;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    console.log(`Uploading Chunk ${i + 1}/${totalChunks}:`, { start, end, size: chunk.size });

    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', i.toString());
    formData.append('chunk', chunk);
    formData.append('originalFilename', originalFilename);

    try {
      await axios.post('http://127.0.0.1:8000/chunk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      uploadedChunks++;
      onProgress(Math.round((uploadedChunks / totalChunks) * 100));
      console.log(`Chunk ${i + 1}/${totalChunks} uploaded.`);
    } catch (error) {
      console.error(`Error uploading chunk ${i + 1}:`, error);
      return false;
    }
  }

  return true;
};

export const finalizeUpload = async (
  uploadId: string,
  totalChunks: number,
  filename: string
): Promise<boolean> => {
  try {
    const response = await axios.post('http://127.0.0.1:8000/finalize', {
      uploadId,
      totalChunks,
      filename,
    });

    console.log('Upload finalized:', response.data);
    return true;
  } catch (error) {
    console.error('Error finalizing upload:', JSON.stringify(error));
    return false;
  }
};

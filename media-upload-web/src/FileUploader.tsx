import React, { useRef, useState } from 'react';
import { initiateUpload, uploadChunk, finalizeUpload } from './utils/fileUpload';

const MAX_FILE_SIZE_MB = 50;
const MAX_FILES = 10;
const MAX_CONCURRENT_UPLOADS = 3;

interface FileWithPreview {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  preview: string;
  originalFile: File;
}

const FileUploader: React.FC = () => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [progressMap, setProgressMap] = useState<{ [key: string]: number }>({});
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    processFiles(Array.from(event.target.files));
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    processFiles(Array.from(event.dataTransfer.files));
  };

  const processFiles = (selectedFiles: File[]) => {
    const newErrors: string[] = [];
    const validFiles: FileWithPreview[] = [];

    if (selectedFiles.length + files.length > MAX_FILES) {
      newErrors.push(`You can upload a maximum of ${MAX_FILES} files.`);
      selectedFiles.splice(MAX_FILES - files.length);
    }

    selectedFiles.forEach((file) => {
      if (!(file.type?.startsWith('image/') || file.type?.startsWith('video/'))) {
        newErrors.push(`Invalid file type: ${file.name}`);
      } else if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        newErrors.push(`File too large (max ${MAX_FILE_SIZE_MB} MB): ${file.name}`);
      } else {
        validFiles.push({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          preview: URL.createObjectURL(file),
          originalFile: file,
        });
      }
    });

    setErrors(newErrors);
    setFiles((prevFiles) => [...prevFiles, ...validFiles]);
  };

  const uploadFile = async (file: FileWithPreview): Promise<void> => {
    const { originalFile } = file;

    try {
      const uploadId = await initiateUpload(originalFile.name, originalFile.size);
      if (!uploadId) throw new Error(`Failed to initiate upload for ${originalFile.name}`);

      await uploadChunk(originalFile, uploadId, originalFile.name, (progress) => {
        setProgressMap((prev) => {
          const updatedProgressMap = { ...prev, [file.name]: progress };
          updateOverallProgress(updatedProgressMap);
          return updatedProgressMap;
        });
      });

      const totalChunks = Math.ceil(originalFile.size / (1 * 1024 * 1024));
      await finalizeUpload(uploadId, totalChunks, originalFile.name);

      console.log(`${originalFile.name} uploaded successfully!`);
    } catch (error) {
      console.error(`Error uploading ${originalFile.name}:`, error);
    }
  };

  const updateOverallProgress = (currentProgressMap: { [key: string]: number }) => {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize === 0) return;

    const totalUploaded = files.reduce((sum, file) => {
      const progress = currentProgressMap[file.name] || 0;
      return sum + (progress / 100) * file.size;
    }, 0);

    setOverallProgress(Math.round((totalUploaded / totalSize) * 100));
  };

  const handleUpload = async () => {
    if (files.length === 0 || isUploading) return;

    setIsUploading(true);

    const queue = [...files];
    let activeUploads = 0;

    const processQueue = async () => {
      while (queue.length > 0 && activeUploads < MAX_CONCURRENT_UPLOADS) {
        const file = queue.shift();
        if (!file) continue;

        activeUploads++;

        uploadFile(file).finally(() => {
          activeUploads--;
          processQueue();
        });
      }

      if (queue.length === 0 && activeUploads === 0) {
        setIsUploading(false);
        alert('All files uploaded successfully!');
      }
    };

    processQueue();
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Enhanced File Uploader</h1>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={handleDropZoneClick}
        style={styles.dropZone}
      >
        Drag and drop files here or click to select
        <input
          type="file"
          multiple
          accept="image/*,video/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={styles.fileInput}
        />
      </div>

      {errors.length > 0 && (
        <div style={styles.errorContainer}>
          <h3>Validation Errors:</h3>
          <ul>
            {errors.map((error, index) => (
              <li key={index} style={styles.errorText}>
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {files.length > 0 && (
        <div style={styles.filesContainer}>
          <h3>Selected Files:</h3>
          {files.map((file) => (
            <div key={file.name} style={styles.fileCard}>
              {file.type.startsWith('image/') ? (
                <img src={file.preview} alt={file.name} style={styles.filePreview} />
              ) : (
                <video src={file.preview} controls style={styles.filePreview} />
              )}
              <p>{file.name}</p>
              <p>{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              <p>Progress: {progressMap[file.name] || 0}%</p>
              <div style={styles.progressBarContainer}>
                <div
                  style={{
                    ...styles.progressBar,
                    width: `${progressMap[file.name] || 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
          <button onClick={handleUpload} disabled={isUploading} style={styles.uploadButton}>
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </button>

          {/* Overall Progress */}
          <div style={{ marginTop: '20px' }}>
            <h3>Overall Progress:</h3>
            <div style={styles.progressBarContainer}>
              <div
                style={{
                  ...styles.progressBar,
                  width: `${overallProgress}%`,
                  backgroundColor: '#2196f3',
                }}
              />
            </div>
            <p>{overallProgress}%</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '600px',
    margin: 'auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    boxShadow: '0px 4px 6px rgba(0,0,0,0.1)',
  },
  title: {
    textAlign: 'center' as const,
    color: '#333',
    marginBottom: '20px',
  },
  dropZone: {
    border: '2px dashed #ccc',
    borderRadius: '8px',
    padding: '30px',
    textAlign: 'center' as const,
    color: '#666',
    backgroundColor: '#fafafa',
    cursor: 'pointer' as const,
    transition: 'background-color .2s ease-in-out',
  },
  fileInput: {
    display: 'none',
  },
  errorContainer: {
    color: '#d9534f',
    marginTop: '10px',
  },
  errorText: {
    fontSize: '14px',
    marginBottom: '5px',
  },
  filesContainer: {
    marginTop: '20px',
  },
  fileCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    paddingBottom:'15px'
   
  }, 
  uploadButton: {
    padding:"12 px",
    margin:"12"
  },
  filePreview: {
    width: '75px',
    height: '75px',
    objectFit: 'cover' as const,
    borderRadius: '4px',
  },
}

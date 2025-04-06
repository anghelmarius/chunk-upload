const express = require("express");
const fs = require("fs");
const path = require("path");
const formidable = require("formidable");
const cors = require("cors");
const multer = require("multer")
const app = express();
const port = 8000;

const CHUNKS_DIR = path.join(__dirname, 'chunks');

if (!fs.existsSync(CHUNKS_DIR)) {
    fs.mkdirSync(CHUNKS_DIR, { recursive: true });
  }

  const upload = multer({
    dest: CHUNKS_DIR,
    limits: { fileSize: 1 * 1024 * 1024 },
  });
app.use(cors());

app.use(express.json());

app.post("/initiate", (req, res) => {
  const { filename, fileSize } = req.body;

  if (!filename || !fileSize) {
    return res.status(400).json({ error: 'Filename and fileSize are required.' });
  }

  const uploadId = `${filename}-${Date.now()}`;
  res.status(200).json({ uploadId });
});

app.post('/chunk', upload.single('chunk'), (req, res) => {
    try {
      const { uploadId, chunkIndex } = req.body;
  
      if (!uploadId || chunkIndex === undefined) {
        return res.status(400).json({ error: 'uploadId and chunkIndex are required.' });
      }
  
      if (!req.file) {
        return res.status(400).json({ error: 'Chunk file is required.' });
      }
  
      const chunkPath = path.join(CHUNKS_DIR, `${uploadId}-${chunkIndex}`);
      fs.rename(req.file.path, chunkPath, (err) => {
        if (err) {
          console.error('Error saving chunk:', err);
          return res.status(500).json({ error: 'Failed to save chunk.' });
        }
  
        res.status(200).json({ message: `Chunk ${chunkIndex} uploaded successfully.` });
      });
    } catch (error) {
      console.error('Error processing chunk:', error);
      res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  });


app.post('/finalize', async (req, res) => {
    const { uploadId, filename } = req.body;
  
    if (!uploadId) {
      return res.status(400).json({ error: 'uploadId is required.' });
    }
  
    const finalFilePath = path.join(__dirname, 'uploads', `${filename}`);
    const writeStream = fs.createWriteStream(finalFilePath);
  
    try {
      const chunkFiles = fs.readdirSync(CHUNKS_DIR)
        .filter(file => file.startsWith(uploadId))
        .sort((a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]));
  
      for (const chunkFile of chunkFiles) {
        const chunkPath = path.join(CHUNKS_DIR, chunkFile);
        const data = fs.readFileSync(chunkPath);
        writeStream.write(data);
        fs.unlinkSync(chunkPath);
      }
  
      writeStream.end();
      res.status(200).json({ message: 'File merged successfully!' });
    } catch (error) {
      console.error('Error merging chunks:', error);
      res.status(500).json({ error: 'Failed to merge chunks.' });
    }
  });
  

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});


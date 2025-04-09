import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import ProgressBar from 'react-native-progress/Bar';
import { Video } from 'expo-av';
import axios from 'axios';
import RNHeicConverter from 'react-native-heic-converter';

const CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB
const API_BASE_URL = 'http://192.168.1.103:8000';

const FileUploader: React.FC = () => {
  const [files, setFiles] = useState<any[]>([]); // Array to store multiple files
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Denied',
        'You need to grant media library permissions to use this feature.'
      );
      return false;
    }
    return true;
  };

  const generateTimestampedFileName = (userId: string, originalName: string): string => {
    // const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 15);
    // const extension = originalName.split('.').pop();
    return originalName
  };

  const pickFiles = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setIsLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true, // Enable multiple file selection
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        const selectedFiles = await Promise.all(
          result.assets.map(async (file: any) => {
            let fileUri = file.uri;

            // Check if the file is HEIC and convert it
            if (file.type === 'livePhoto' || fileUri.endsWith('.heic')) {
              const conversionResult = await RNHeicConverter.convert({
                path: fileUri,
                quality: 1,
                extension: 'jpg',
              });

              if (conversionResult.success) {
                fileUri = conversionResult.path; // Update URI to point to converted JPEG
              } else {
                Alert.alert('Conversion Failed', 'Unable to convert HEIC image.');
                return null;
              }
            }

            return {
              uri: fileUri,
              type: file.type || (fileUri.includes('.mp4') ? 'video/mp4' : 'image/jpeg'),
              name: fileUri.split('/').pop(),
            };
          })
        );

        setFiles((prevFiles) => [...prevFiles, ...selectedFiles.filter(Boolean)]);
      } else {
        Alert.alert('No files selected', 'Please select files to upload.');
      }
    } catch (error) {
      console.error('Error picking files:', error);
      Alert.alert('Error', 'An error occurred while picking the files.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetFiles = () => {
    setFiles([]);
    setProgress({});
  };


  const uploadFile = async (file: any, index: number) => {
    try {
      // Step 1: Get file info
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const fileSize = blob.size;

      // Validate file size (max: 50 MB)
      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
      if (fileSize > MAX_FILE_SIZE) {
        Alert.alert(
          'File Too Large',
          `The file "${file.name}" is larger than the allowed size of 50 MB.`
        );
        return;
      }

      // Generate a unique filename with timestamp
      const userId = '12345'; // Replace with actual user ID from your app logic
      const fileName = generateTimestampedFileName(userId, file.name);

      // Step 2: Initiate upload
      const initiateResponse = await axios.post(`${API_BASE_URL}/initiate`, {
        filename: fileName,
        fileSize,
      });

      const { uploadId } = initiateResponse.data;

      // Step 3: Upload chunks
      let uploadedChunks = 0;
      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileSize);

        const chunkBlob = blob.slice(start, end);

        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', i.toString());
        formData.append('chunk', chunkBlob);

        await axios.post(`${API_BASE_URL}/chunk`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        uploadedChunks++;
        setProgress((prevProgress) => ({
          ...prevProgress,
          [index]: uploadedChunks / totalChunks,
        }));
      }

      // Step 4: Finalize upload
      await axios.post(`${API_BASE_URL}/finalize`, {
        uploadId,
        totalChunks,
        filename: fileName,
      });

      Alert.alert('Upload Complete', `Your file "${fileName}" has been uploaded successfully!`);
    } catch (error) {
      console.error('Upload Error:', JSON.stringify(error));
      Alert.alert('Upload Failed', `An error occurred while uploading "${file.name}".`);
    }
  };

  const uploadAllFiles = () => {
    files.forEach((file, index) => uploadFile(file, index));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>File Uploader</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Pick Files" onPress={pickFiles} />
      )}

      <ScrollView style={styles.fileList}>
        {files.map((file, index) => (
          <View key={index} style={styles.previewContainer}>
            <Text style={styles.fileInfo}>{file.name}</Text>
            {file.type?.includes('image') ? (
              <Image source={{ uri: file.uri }} style={styles.imagePreview} />
            ) : file.type?.includes('video') ? (
              <Video
                source={{ uri: file.uri }}
                style={styles.videoPreview}
                useNativeControls
                resizeMode="contain"
                isLooping
              />
            ) : (
              <Text>Unsupported file type</Text>
            )}
            {progress[index] > 0 && (
              <ProgressBar progress={progress[index]} width={200} />
            )}
          </View>
        ))}
      </ScrollView>

      {files.length > 0 && (
        <>
          <Button title="Upload All Files" onPress={uploadAllFiles} />
          <Button title="Reset Files" onPress={resetFiles} color="#ff0000" /> {/* Reset Button */}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fileList: {

  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#eef2f3', // Light gradient background
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50', // Dark gray-blue
    marginBottom: 20,
  },
  previewContainer: {
    marginTop: 20,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    elevation: 6,
    marginBottom: 10,
  },
  imagePreview: {
    width: 150,
    height: 150,
    resizeMode: 'cover',
    marginTop: 10,
    borderRadius: 10, // Rounded corners
  },
  videoPreview: {
    width: 250,
    height: 150,
    marginTop: 10,
    borderRadius: 10, // Rounded corners
  },
  fileInfo: {
    fontSize: 16,
    color: '#34495e', // Medium gray-blue
    marginTop: 5,
  },
});


export default FileUploader;

import React from 'react';
import { SafeAreaView } from 'react-native';
import FileUploader from './FileUploader';

const App: React.FC = () => {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <FileUploader />
    </SafeAreaView>
  );
};

export default App;

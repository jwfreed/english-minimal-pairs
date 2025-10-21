// TEST FILE - For debugging TTS issues on physical devices
// You can temporarily import this into your index.tsx to test
// -----------------------------------------------------------------------------
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import Tts from 'react-native-tts';

// Type definition for react-native-tts Voice
interface TtsVoice {
  id: string;
  name: string;
  language: string;
  quality: number;
  latency: number;
  networkConnectionRequired: boolean;
  notInstalled: boolean;
}

export default function TTSDebugScreen() {
  const [logs, setLogs] = useState<string[]>([]);
  const [voices, setVoices] = useState<TtsVoice[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
    console.log(message);
  };

  const testBasicTTS = async () => {
    addLog('🧪 Testing basic TTS...');
    try {
      // Set up event listeners
      Tts.addEventListener('tts-start', () => addLog('✅ Speech started'));
      Tts.addEventListener('tts-finish', () => addLog('✅ Speech completed'));
      Tts.addEventListener('tts-cancel', () => addLog('⏸️ Speech cancelled'));
      
      await Tts.speak('Hello world');
    } catch (error) {
      addLog(`❌ Exception: ${error}`);
    }
  };

  const testWithVolume = async () => {
    addLog('🔊 Testing TTS with explicit rate and volume...');
    try {
      Tts.addEventListener('tts-start', () => addLog('✅ Volume test started'));
      Tts.addEventListener('tts-finish', () => addLog('✅ Volume test completed'));
      
      await Tts.setDefaultRate(1.0);
      await Tts.speak('Testing volume');
    } catch (error) {
      addLog(`❌ Exception: ${error}`);
    }
  };

  const checkVoices = async () => {
    addLog('🎤 Checking available voices...');
    try {
      const availableVoices = await Tts.voices();
      setVoices(availableVoices);
      addLog(`✅ Found ${availableVoices.length} voices`);
      
      const englishVoices = availableVoices.filter((v: TtsVoice) => v.language.startsWith('en'));
      addLog(`   ${englishVoices.length} English voices`);
      
      if (availableVoices.length === 0) {
        addLog('⚠️ WARNING: No voices available! TTS will not work.');
        addLog('⚠️ This usually means you are on iOS Simulator.');
      }
    } catch (error) {
      addLog(`❌ Error checking voices: ${error}`);
    }
  };

  const testWithVoice = async () => {
    const englishVoices = voices.filter((v: TtsVoice) => v.language.startsWith('en'));
    if (englishVoices.length === 0) {
      addLog('❌ No English voices available to test');
      return;
    }

    const voice = englishVoices[0];
    addLog(`🎤 Testing with voice: ${voice.name}`);
    try {
      Tts.addEventListener('tts-start', () => addLog(`✅ Custom voice started: ${voice.name}`));
      Tts.addEventListener('tts-finish', () => addLog(`✅ Custom voice completed`));
      
      await Tts.setDefaultVoice(voice.id);
      await Tts.speak('Testing custom voice');
    } catch (error) {
      addLog(`❌ Exception: ${error}`);
    }
  };

  const testMinimalPairWords = async () => {
    addLog('📚 Testing minimal pair words...');
    const words = ['sheep', 'ship', 'light', 'right'];
    
    for (const word of words) {
      try {
        addLog(`   Speaking: ${word}`);
        await new Promise<void>((resolve) => {
          Tts.addEventListener('tts-finish', () => {
            addLog(`   ✅ ${word} completed`);
            resolve();
          });
          
          Tts.speak(word);
        });
        // Wait 500ms between words
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        addLog(`   ❌ ${word} exception: ${error}`);
      }
    }
    addLog('✅ Minimal pair test complete');
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TTS Debug Screen</Text>
      <Text style={styles.subtitle}>Platform: {Platform.OS}</Text>
      
      <ScrollView style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={checkVoices}>
          <Text style={styles.buttonText}>1. Check Voices</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testBasicTTS}>
          <Text style={styles.buttonText}>2. Test Basic TTS</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testWithVolume}>
          <Text style={styles.buttonText}>3. Test with Volume</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testWithVoice}>
          <Text style={styles.buttonText}>4. Test Custom Voice</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.button} onPress={testMinimalPairWords}>
          <Text style={styles.buttonText}>5. Test Minimal Pairs</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={clearLogs}>
          <Text style={styles.buttonText}>Clear Logs</Text>
        </TouchableOpacity>
      </ScrollView>
      
      <ScrollView style={styles.logContainer}>
        <Text style={styles.logTitle}>Logs:</Text>
        {logs.map((log, index) => (
          <Text key={index} style={styles.logText}>{log}</Text>
        ))}
      </ScrollView>
      
      {voices.length > 0 && (
        <View style={styles.voiceInfo}>
          <Text style={styles.voiceTitle}>Available Voices: {voices.length}</Text>
          <Text style={styles.voiceSubtitle}>
            English: {voices.filter(v => v.language.startsWith('en')).length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  buttonContainer: {
    maxHeight: 300,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  logContainer: {
    flex: 1,
    marginTop: 20,
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  logText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 5,
    color: '#333',
  },
  voiceInfo: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
  },
  voiceTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  voiceSubtitle: {
    fontSize: 12,
    color: '#666',
  },
});

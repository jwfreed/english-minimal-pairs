// TEST FILE - For debugging TTS issues on physical devices
// You can temporarily import this into your index.tsx to test. Mount it
// inside SettingsProvider (app/(tabs)/) — it reads the production voice pool.
// -----------------------------------------------------------------------------
// All playback goes through speakWord below, which assembles options with the
// same buildSpeechOptions the production path (useAudio) uses. Debugging here
// therefore validates the exact option shape users hear: voice identifier,
// locale propagation, rate/pitch/volume defaults.
// -----------------------------------------------------------------------------
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { buildSpeechOptions, type SpeechOptions } from '@/src/domain/audioPlayback';
import { useSettings } from '@/src/context/SettingsContext';
import { minimalPairs } from '@/src/constants/minimalPairs';

// Same rate the placement test uses; production practice varies it per user.
const DEBUG_RATE = 1.0;

// Deterministic pronunciation-audit sample: both words of the first two pairs
// of the first category, with their intended IPA so a listener can compare
// what the voice says against what the dataset claims. Flagged pairs from
// docs/pronunciation-risk-audit.md can be checked the same way.
const AUDIT_SAMPLE: { word: string; ipa: string }[] = minimalPairs[0].pairs
  .slice(0, 2)
  .flatMap((pair) => [
    { word: pair.word1, ipa: pair.ipa1 },
    { word: pair.word2, ipa: pair.ipa2 },
  ]);

export default function TTSDebugScreen() {
  const { getNextVoice } = useSettings();
  const [logs, setLogs] = useState<string[]>([]);
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [lastOptions, setLastOptions] = useState<SpeechOptions | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
    if (__DEV__) {
      console.log(message);
    }
  };

  /**
   * Single debug playback path. Options come from buildSpeechOptions — the
   * same pure builder useAudio.play uses — so the debug screen and production
   * cannot drift apart. Resolves when speech finishes, stops, or errors.
   */
  const speakWord = (word: string, voice: Speech.Voice | null): Promise<void> => {
    return new Promise<void>((resolve) => {
      const options = buildSpeechOptions({
        rate: DEBUG_RATE,
        voice,
        onDone: () => {
          addLog(`✅ "${word}" completed`);
          resolve();
        },
        onStopped: () => {
          addLog(`⏸️ "${word}" stopped`);
          resolve();
        },
        onError: (error) => {
          addLog(`❌ "${word}" error: ${JSON.stringify(error)}`);
          resolve();
        },
      });
      setLastOptions(options);
      addLog(
        `🎤 voice: ${
          voice
            ? `${voice.name} (${voice.identifier}) [${voice.quality ?? 'unknown quality'}]`
            : 'system default'
        }`
      );
      addLog(`🌐 locale: ${options.language}`);
      try {
        // onStart is inspection-only; it does not alter the option shape.
        Speech.speak(word, {
          ...options,
          onStart: () => addLog(`▶️ "${word}" started`),
        });
      } catch (error) {
        addLog(`❌ Exception: ${error}`);
        resolve();
      }
    });
  };

  const testBasicTTS = async () => {
    addLog('🧪 Testing system default voice through the production option path...');
    await speakWord('Hello world', null);
  };

  const testWithVolume = async () => {
    addLog('🔊 Testing production option defaults (rate/pitch/volume)...');
    await speakWord('Testing volume', null);
  };

  const checkVoices = async () => {
    addLog('🎤 Checking available voices...');
    try {
      const availableVoices = await Speech.getAvailableVoicesAsync();
      setVoices(availableVoices);
      addLog(`✅ Found ${availableVoices.length} voices`);

      const englishVoices = availableVoices.filter(v => v.language.startsWith('en'));
      addLog(`   ${englishVoices.length} English voices`);

      if (availableVoices.length === 0) {
        addLog('⚠️ WARNING: No voices available! TTS will not work.');
        addLog('⚠️ This usually means you are on iOS Simulator.');
      }
    } catch (error) {
      addLog(`❌ Error checking voices: ${error}`);
    }
  };

  const testRotationVoice = async () => {
    // Production selection: exclusions, prioritization, round-robin rotation.
    const voice = getNextVoice();
    if (!voice) {
      addLog('❌ Rotation pool is empty (no en-* voices, or all excluded)');
      return;
    }
    addLog(`🎤 Testing rotation voice: ${voice.name}`);
    await speakWord('Testing custom voice', voice);
  };

  const testMinimalPairWords = async () => {
    addLog('📚 Testing dataset minimal-pair words with rotating production voices...');

    for (const { word, ipa } of AUDIT_SAMPLE) {
      addLog(`   Speaking: ${word} — intended IPA ${ipa}`);
      await speakWord(word, getNextVoice());
      // Wait 500ms between words
      await new Promise(resolve => setTimeout(resolve, 500));
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

        <TouchableOpacity style={styles.button} onPress={testRotationVoice}>
          <Text style={styles.buttonText}>4. Test Rotation Voice</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testMinimalPairWords}>
          <Text style={styles.buttonText}>5. Test Minimal Pairs</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={clearLogs}>
          <Text style={styles.buttonText}>Clear Logs</Text>
        </TouchableOpacity>
      </ScrollView>

      {lastOptions && (
        <View style={styles.optionsInfo}>
          <Text style={styles.voiceTitle}>Last speech options (production shape)</Text>
          <Text style={styles.logText}>
            {/* Callbacks are functions, so JSON.stringify drops them and only
                the effective option values remain. */}
            {JSON.stringify(lastOptions)}
          </Text>
        </View>
      )}

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
  optionsInfo: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff8e1',
    borderRadius: 8,
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

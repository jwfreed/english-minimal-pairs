// plugins/withAudioSession.js
// Config plugin to configure iOS audio session for TTS
const { withAppDelegate } = require('@expo/config-plugins');

/**
 * Add AVFoundation import and audio session configuration to AppDelegate
 */
const withAudioSession = (config) => {
  return withAppDelegate(config, (config) => {
    const { modResults } = config;
    let contents = modResults.contents;

    // Check if already modified
    if (contents.includes('AVFoundation') && contents.includes('configureAudioSession')) {
      console.log('✅ Audio session configuration already present in AppDelegate');
      return config;
    }

    // Add AVFoundation import after other imports
    if (!contents.includes('import AVFoundation')) {
      // Match any 'import <Something>' line to anchor the insertion
      const importMatch = contents.match(/^(import\s+\w+.*\n)/m);
      if (importMatch) {
        contents = contents.replace(
          importMatch[0],
          importMatch[0] + 'import AVFoundation\n'
        );
      } else {
        // Fallback: prepend at the top of the file
        contents = 'import AVFoundation\n\n' + contents;
      }
    }

    // Add the configureAudioSession method before the last closing brace
    const audioSessionMethod = `
  private func configureAudioSession() {
    do {
      let audioSession = AVAudioSession.sharedInstance()
      
      // Set the category to playback with spokenAudio mode
      // This ensures audio plays even when the device is in silent mode
      try audioSession.setCategory(
        .playback,
        mode: .spokenAudio,
        options: [.duckOthers, .allowBluetoothHFP, .allowBluetoothA2DP]
      )
      
      // Activate the audio session
      try audioSession.setActive(true, options: [])
      
      // Log success with volume info
      let volume = audioSession.outputVolume
      print("✅ Audio session configured successfully")
      print("   Category: \\(audioSession.category.rawValue)")
      print("   Mode: \\(audioSession.mode.rawValue)")
      print("   Output volume: \\(volume)")
      
      // Check if volume is too low
      if volume < 0.1 {
        print("⚠️  WARNING: Device volume is very low (\\(volume)). User may not hear audio.")
      }
      
    } catch let error as NSError {
      print("❌ Failed to configure audio session")
      print("   Error: \\(error.localizedDescription)")
    }
  }
`;

    // Find the last closing brace of the AppDelegate class
    const lastBraceIndex = contents.lastIndexOf('}');
    if (lastBraceIndex !== -1) {
      contents = contents.slice(0, lastBraceIndex) + audioSessionMethod + '\n' + contents.slice(lastBraceIndex);
    }

    // Add call to configureAudioSession in didFinishLaunchingWithOptions
    if (!contents.includes('configureAudioSession()')) {
      const dlMatch = contents.match(/(didFinishLaunchingWithOptions[^{]*\{[ \t]*\n?)/);
      if (dlMatch) {
        contents = contents.replace(
          dlMatch[0],
          dlMatch[0] + '    // Configure audio session for speech synthesis\n    configureAudioSession()\n\n'
        );
      } else {
        console.warn('⚠️  withAudioSession: could not find didFinishLaunchingWithOptions — skipping configureAudioSession() injection');
      }
    }

    modResults.contents = contents;
    return config;
  });
};

module.exports = withAudioSession;

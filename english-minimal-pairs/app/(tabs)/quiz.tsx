import { View, Text, Button, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { useState } from 'react';
import { minimalPairs } from '../../constants/minimalPairs';

export default function QuizScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);

  // If we've exceeded the data length, go to results
  if (currentIndex >= minimalPairs.length) {
    return (
      <View style={styles.container}>
        <Text>All done! Your score is {score}</Text>
        <Link href="/(tabs)/results">
          <Button title="View Results" />
        </Link>
      </View>
    );
  }

  const currentPair = minimalPairs[currentIndex].pair;

  // For demonstration, let's say the correct answer is always the first word
  const handleGuess = (pickedFirstWord: boolean) => {
    if (pickedFirstWord) {
      setScore((prev) => prev + 1);
    }
    setCurrentIndex((prev) => prev + 1);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Question {currentIndex + 1} of {minimalPairs.length}
      </Text>
      <Text style={styles.subtitle}>
        Category: {minimalPairs[currentIndex].category}
      </Text>

      {/* In a real scenario, you'd play the audio for one of the pair words 
          and let the user guess which word they heard. */}
      <Button title={currentPair[0].word} onPress={() => handleGuess(true)} />
      <Button title={currentPair[1].word} onPress={() => handleGuess(false)} />

      <Text style={{ marginTop: 20 }}>Score: {score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, marginBottom: 10 },
  subtitle: { fontSize: 18, marginBottom: 20 },
});

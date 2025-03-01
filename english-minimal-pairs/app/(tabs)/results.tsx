import { View, Text, Button, StyleSheet } from 'react-native';
import { Link, useRouter } from 'expo-router';

export default function ResultsScreen() {
  const router = useRouter();

  const handleReset = () => {
    // For a more complex approach,
    // you might reset a global or AsyncStorage state
    router.push('/(tabs)/quiz');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Results Screen</Text>
      <Text>Show the final score or summary here</Text>
      <Link href="/(tabs)">
        <Button title="Go Home" />
      </Link>
      <Button title="Retake Quiz" onPress={handleReset} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, marginBottom: 10 },
});

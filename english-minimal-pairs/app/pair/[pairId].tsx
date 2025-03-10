// import React, { useEffect, useState } from 'react';
// import { View, Text, Button, StyleSheet } from 'react-native';
// import { useLocalSearchParams, useRouter } from 'expo-router';
// import { PairSession } from '../../src/storage/types';
// import { addPairSession } from '../../src/storage/sessionStorage';
// import { minimalPairs } from '../../constants/minimalPairs';

// export default function PairPracticeScreen() {
//   const { pairId } = useLocalSearchParams<{ pairId: string }>();
//   const router = useRouter(); // Now this is recognized

//   const [attempts, setAttempts] = useState(0);
//   const [correct, setCorrect] = useState(0);
//   const [sessionStart] = useState(Date.now());

//   const pairData = minimalPairs.find((p) => p.id === pairId);
//   if (!pairData) {
//     return (
//       <View style={styles.container}>
//         <Text>No pair found for ID: {pairId}</Text>
//         <Button title="Go Back" onPress={() => router.back()} />
//       </View>
//     );
//   }

//   function handleGuess(isCorrect: boolean) {
//     setAttempts((prev) => prev + 1);
//     if (isCorrect) {
//       setCorrect((prev) => prev + 1);
//     }
//   }

//   useEffect(() => {
//     return () => {
//       finalizeSession();
//     };
//   }, []);

//   function finalizeSession() {
//     const session: PairSession = {
//       sessionId: Date.now().toString(),
//       startTime: sessionStart,
//       endTime: Date.now(),
//       attempts,
//       correct,
//     };
//     if (pairId) {
//       addPairSession(pairId as string, session);
//     }
//   }

//   const battingAverage = attempts > 0 ? correct / attempts : 0;

//   return (
//     <View style={styles.container}>
//       <Text style={styles.title}>{pairData.category}</Text>
//       <Text style={styles.subtitle}>Practicing: {pairData.id}</Text>
//       <Button title="Answer Correct" onPress={() => handleGuess(true)} />
//       <Button title="Answer Incorrect" onPress={() => handleGuess(false)} />
//       <Text style={{ marginTop: 20 }}>
//         Attempts: {attempts}, Correct: {correct}
//       </Text>
//       <Text>Batting Average: {(battingAverage * 100).toFixed(1)}%</Text>
//       <Button
//         title="Done"
//         onPress={() => {
//           finalizeSession();
//           router.push('/(tabs)');
//         }}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
//   title: { fontSize: 22, marginBottom: 10 },
//   subtitle: { fontSize: 18, marginBottom: 20 },
// });

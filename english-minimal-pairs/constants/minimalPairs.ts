// minimalPairs.ts

export const minimalPairs = [
  {
    id: 'bat-pat',
    category: 'Consonant Minimal Pairs',
    pair: [
      {
        word: 'bat',
        ipa: '/bæt/',
        audio: require('../assets/audio/bat.mp3'),
      },
      {
        word: 'pat',
        ipa: '/pæt/',
        audio: require('../assets/audio/pat.mp3'),
      },
    ],
  },
  {
    id: 'cap-gap',
    category: 'Consonant Minimal Pairs',
    pair: [
      {
        word: 'cap',
        ipa: '/kæp/',
        audio: require('../assets/audio/cap.mp3'),
      },
      {
        word: 'gap',
        ipa: '/gæp/',
        audio: require('../assets/audio/gap.mp3'),
      },
    ],
  },
  {
    id: 'bit-beat',
    category: 'Vowel Minimal Pairs',
    pair: [
      {
        word: 'bit',
        ipa: '/bɪt/',
        audio: require('../assets/audio/bit.mp3'),
      },
      {
        word: 'beat',
        ipa: '/biːt/',
        audio: require('../assets/audio/beat.mp3'),
      },
    ],
  },
];

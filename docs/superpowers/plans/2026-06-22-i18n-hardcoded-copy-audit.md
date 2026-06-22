# i18n Hardcoded Copy Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire every hardcoded user-facing English string in the Soundwise app through the translation system, adding natural translations in all 15 supported locales.

**Architecture:** The app uses a `translate(tKeys.key)` pattern backed by `alternateLanguages.ts` (locale objects) and `translationKeys.ts` (key registry). New keys go in both files; components call `useLanguage()` to get `translate`. Utility functions (`practiceFeedback.ts`, `contrastLabel.ts`) accept an optional `translate` parameter with English fallback so existing tests pass unchanged.

**Tech Stack:** React Native / Expo, TypeScript, custom i18n via `LanguageContext`, Node.js test scripts in `scripts/`

---

## Strings Found and Their Disposition

### Files with hardcoded strings (TRANSLATE_USER_FACING)

| File | Line | String | Action |
|------|------|--------|--------|
| `app/components/AnswerButtons.tsx` | 85 | `"Which word did you hear?"` | new key `whichWordDidYouHear` |
| `app/components/AnswerButtons.tsx` | 101 | `accessibilityHint="Double tap to select this word as your answer"` | new key `doubleTapToSelectWord` |
| `app/components/AnswerButtons.tsx` | 155 | `"Compare the two words"` | new key `compareTheTwoWords` |
| `app/components/AnswerButtons.tsx` | 170 | `` accessibilityLabel={`Play ${item.word} ${item.ipa}`} `` | new key `play` prefix |
| `app/components/AnswerButtons.tsx` | 171 | `` accessibilityHint={`Double tap to hear ${item.word}`} `` | new key `doubleTapToHear` prefix |
| `app/components/AnswerButtons.tsx` | 175 | `Play {item.word}` | new key `play` prefix |
| `app/components/PairPicker.tsx` | 58 | `accessibilityLabel="Try a specific pair"` | new key `tryASpecificPair` via prop |
| `app/components/practice/PracticePairSelector.tsx` | 42 | `"Loading…"` | new key `loading` |
| `app/components/practice/PracticePairSelector.tsx` | 49 | `"Try a specific pair"` | new key `tryASpecificPair` |
| `app/components/practice/ListenControls.tsx` | 27 | `accessibilityHint="Double tap to hear a word"` | new key `doubleTapToHearAWord` |
| `app/components/practice/PracticeHeader.tsx` | 29 | `accessibilityLabel="Help"` | new key `helpLabel` via prop |
| `app/components/HelpOverlay.tsx` | 46 | `accessibilityLabel="Close help"` | new key `closeHelp` |
| `app/components/HelpOverlay.tsx` | 55 | `accessibilityLabel="How to practice help"` | reuse `helpTitle` key |
| `app/components/HelpOverlay.tsx` | 70 | `"Tips"` | new key `tips` |
| `app/(tabs)/index.tsx` | 480 | `"Loading…"` | new key `loading` |
| `app/(tabs)/index.tsx` | 502 | `title="Practice"` | reuse `practicePairs` key |
| `app/(tabs)/index.tsx` | 514 | `"Listen for the sound difference."` | new key `listenForSoundDifference` |
| `app/(tabs)/index.tsx` | 527 | `` `This contrast moved to Level ${promotedTier}` `` | new key `contrastMovedToLevel` prefix |
| `utils/practiceFeedback.ts` | 42 | `` `Correct — you heard ${correctPhoneme} in ${correctWord}.` `` | new key `correctYouHeard` prefix |
| `utils/practiceFeedback.ts` | 43 | `` `Correct — that was ${correctWord}.` `` | new key `correctThatWas` prefix |
| `utils/practiceFeedback.ts` | 54 | `` `This was ${correctWord}.` `` | new key `incorrectThisWas` prefix |
| `utils/practiceFeedback.ts` | 55 | `` `Listen again and compare it with ${contrastWord}.` `` | new key `listenAndCompareWith` prefix |
| `utils/contrastLabel.ts` | 3 | `'Train this contrast'` | new key `trainThisContrast` |
| `utils/contrastLabel.ts` | 29 | `` `Train /${first}/ vs /${second}/` `` | new key `trainContrast` prefix |

### Strings intentionally NOT translated (PRESERVE_DATA_VALUE / PRESERVE_INTERNAL)

- `item.word`, `pair.word1`, `pair.word2` — English training words being studied
- `item.ipa`, `pair.ipa1`, `pair.ipa2` — IPA phonetic notation (linguistic data)
- `/${first}/ vs /${second}/` — phoneme notation with slash formatting
- `"in"` between phoneme and word in `correctYouHeard` — English preposition between two English data values
- `"Loading…"` indicator in `PlacementTest.tsx` line 144 (`<ActivityIndicator />` — no text there)
- `translate(tKeys.someKey) || 'English fallback'` patterns in settings/placement — fallbacks only show if translate returns undefined (defensive, not user-facing in practice)
- `console.log`, `console.error` strings — internal
- `STORAGE_KEY`, route names, enum values — internal

---

## 19 New Translation Keys

```
whichWordDidYouHear      compareTheTwoWords       play
tryASpecificPair         loading                  listenForSoundDifference
contrastMovedToLevel     tips                     closeHelp
helpLabel                doubleTapToSelectWord    doubleTapToHearAWord
doubleTapToHear          correctYouHeard          correctThatWas
incorrectThisWas         listenAndCompareWith     trainThisContrast
trainContrast
```

---

## File Map

| File | Change type |
|------|-------------|
| `app/constants/translationKeys.ts` | Add 19 keys to `tKeys` |
| `app/constants/alternateLanguages.ts` | Add 19 translations per locale × 15 locales |
| `app/components/AnswerButtons.tsx` | Wire 5 strings via existing `useLanguage` |
| `app/components/PairPicker.tsx` | Add `accessibilityLabel?: string` prop |
| `app/components/practice/PracticePairSelector.tsx` | Add `useLanguage()`, pass label to PairPicker |
| `app/components/practice/ListenControls.tsx` | Add `useLanguage()` for hint |
| `app/components/practice/PracticeHeader.tsx` | Add `helpAccessibilityLabel: string` prop |
| `app/components/HelpOverlay.tsx` | Wire 3 strings |
| `app/(tabs)/index.tsx` | Wire 4 strings, pass helpAccessibilityLabel |
| `utils/practiceFeedback.ts` | Add optional `translate` param, wire 4 keys |
| `utils/contrastLabel.ts` | Add optional `translate` param, wire 2 keys |
| `scripts/i18n.test.js` | New coverage test |

---

## Task 1: Create branch and verify baseline

**Files:** none changed

- [ ] **Step 1: Create the branch**

```bash
git checkout -b app-i18n-hardcoded-copy-audit
```

Expected: `Switched to a new branch 'app-i18n-hardcoded-copy-audit'`

- [ ] **Step 2: Run existing tests to confirm baseline passes**

```bash
cd /Users/jonathanfreed/Documents/Development/english-minimal-pairs && npm test
```

Expected: all tests pass (practiceFeedback, contrastLabel, etc.)

- [ ] **Step 3: Run typecheck to confirm baseline**

```bash
npm run typecheck
```

Expected: no errors

---

## Task 2: Add 19 new keys to `translationKeys.ts`

**Files:**
- Modify: `app/constants/translationKeys.ts`

- [ ] **Step 1: Add all 19 new keys to the `tKeys` object**

In `app/constants/translationKeys.ts`, add after the `noPairsFound` line (before `} as const`):

```typescript
  // Practice UI
  whichWordDidYouHear: 'whichWordDidYouHear',
  compareTheTwoWords: 'compareTheTwoWords',
  play: 'play',
  tryASpecificPair: 'tryASpecificPair',
  loading: 'loading',
  listenForSoundDifference: 'listenForSoundDifference',
  contrastMovedToLevel: 'contrastMovedToLevel',
  // Help overlay
  tips: 'tips',
  closeHelp: 'closeHelp',
  helpLabel: 'helpLabel',
  // Accessibility hints
  doubleTapToSelectWord: 'doubleTapToSelectWord',
  doubleTapToHearAWord: 'doubleTapToHearAWord',
  doubleTapToHear: 'doubleTapToHear',
  // Feedback copy (label-prefix pattern)
  correctYouHeard: 'correctYouHeard',
  correctThatWas: 'correctThatWas',
  incorrectThisWas: 'incorrectThisWas',
  listenAndCompareWith: 'listenAndCompareWith',
  // Contrast training title
  trainThisContrast: 'trainThisContrast',
  trainContrast: 'trainContrast',
```

- [ ] **Step 2: Verify typecheck still passes (type only changes in next task)**

```bash
npm run typecheck 2>&1 | head -20
```

Expected: errors about missing keys in locale objects (because alternateLanguages hasn't been updated yet). These are expected and will be fixed in Task 3.

---

## Task 3: Add English source strings and all 15 locale translations to `alternateLanguages.ts`

**Files:**
- Modify: `app/constants/alternateLanguages.ts`

This is the largest single task. Add the 19 new key/value pairs to each of the 16 locale objects (`englishTranslations` + 15 language objects).

### englishTranslations block

- [ ] **Step 1: Add to `englishTranslations` (after `noPairsFound`)**

```typescript
  // Practice UI
  whichWordDidYouHear: 'Which word did you hear?',
  compareTheTwoWords: 'Compare the two words',
  play: 'Play',
  tryASpecificPair: 'Try a specific pair',
  loading: 'Loading…',
  listenForSoundDifference: 'Listen for the sound difference.',
  contrastMovedToLevel: 'This contrast moved to Level',
  // Help overlay
  tips: 'Tips',
  closeHelp: 'Close help',
  helpLabel: 'Help',
  // Accessibility hints
  doubleTapToSelectWord: 'Double tap to select this word as your answer',
  doubleTapToHearAWord: 'Double tap to hear a word',
  doubleTapToHear: 'Double tap to hear',
  // Feedback copy
  correctYouHeard: 'Correct — you heard',
  correctThatWas: 'Correct — that was',
  incorrectThisWas: 'This was',
  listenAndCompareWith: 'Listen again and compare it with',
  // Contrast training title
  trainThisContrast: 'Train this contrast',
  trainContrast: 'Train',
```

### 日本語 block

- [ ] **Step 2: Add to `日本語` locale (after `noPairsFound`)**

```typescript
  whichWordDidYouHear: 'どの単語が聞こえましたか？',
  compareTheTwoWords: '2つの単語を比べる',
  play: '再生',
  tryASpecificPair: '特定のペアを選ぶ',
  loading: '読み込み中…',
  listenForSoundDifference: '音の違いに集中して聞いてください。',
  contrastMovedToLevel: 'このコントラストのレベルが上がりました：',
  tips: 'ヒント',
  closeHelp: 'ヘルプを閉じる',
  helpLabel: 'ヘルプ',
  doubleTapToSelectWord: 'ダブルタップしてこの単語を回答として選ぶ',
  doubleTapToHearAWord: 'ダブルタップして単語を聞く',
  doubleTapToHear: 'ダブルタップして聞く：',
  correctYouHeard: '正解。聞こえた音：',
  correctThatWas: '正解。その単語は',
  incorrectThisWas: 'この単語は',
  listenAndCompareWith: 'もう一度聞いて比べてみてください：',
  trainThisContrast: 'このコントラストを練習',
  trainContrast: '練習：',
```

### 中文 block

- [ ] **Step 3: Add to `中文` locale (after `noPairsFound`)**

```typescript
  whichWordDidYouHear: '你听到了哪个词？',
  compareTheTwoWords: '对比两个单词',
  play: '播放',
  tryASpecificPair: '选择特定词对',
  loading: '加载中…',
  listenForSoundDifference: '专心听声音的区别。',
  contrastMovedToLevel: '此对比音升至等级',
  tips: '小技巧',
  closeHelp: '关闭帮助',
  helpLabel: '帮助',
  doubleTapToSelectWord: '双击选择此词作为你的答案',
  doubleTapToHearAWord: '双击播放单词',
  doubleTapToHear: '双击收听',
  correctYouHeard: '正确。你听到了',
  correctThatWas: '正确。那个词是',
  incorrectThisWas: '这个词是',
  listenAndCompareWith: '再听一次，与之对比：',
  trainThisContrast: '练习此对比音',
  trainContrast: '练习',
```

### ภาษาไทย block

- [ ] **Step 4: Add to `ภาษาไทย` locale (after `noPairsFound`)**

```typescript
  whichWordDidYouHear: 'คุณได้ยินคำไหน？',
  compareTheTwoWords: 'เปรียบเทียบสองคำ',
  play: 'เล่น',
  tryASpecificPair: 'เลือกคู่คำที่ต้องการ',
  loading: 'กำลังโหลด…',
  listenForSoundDifference: 'ฟังความแตกต่างของเสียง',
  contrastMovedToLevel: 'เสียงนี้เลื่อนไปอยู่ที่ระดับ',
  tips: 'เคล็ดลับ',
  closeHelp: 'ปิดวิธีใช้',
  helpLabel: 'วิธีใช้',
  doubleTapToSelectWord: 'แตะสองครั้งเพื่อเลือกคำนี้เป็นคำตอบ',
  doubleTapToHearAWord: 'แตะสองครั้งเพื่อฟังคำ',
  doubleTapToHear: 'แตะสองครั้งเพื่อฟัง',
  correctYouHeard: 'ถูก — คุณได้ยิน',
  correctThatWas: 'ถูก — คำนั้นคือ',
  incorrectThisWas: 'คำนั้นคือ',
  listenAndCompareWith: 'ฟังอีกครั้งและเปรียบเทียบกับ',
  trainThisContrast: 'ฝึกเสียงนี้',
  trainContrast: 'ฝึก',
```

### Español block

- [ ] **Step 5: Add to `Español` locale (after `noPairsFound`)**

```typescript
  whichWordDidYouHear: '¿Qué palabra escuchaste?',
  compareTheTwoWords: 'Compara las dos palabras',
  play: 'Escuchar',
  tryASpecificPair: 'Elegir un par específico',
  loading: 'Cargando…',
  listenForSoundDifference: 'Escucha la diferencia de sonido.',
  contrastMovedToLevel: 'Este contraste pasó al nivel',
  tips: 'Consejos',
  closeHelp: 'Cerrar ayuda',
  helpLabel: 'Ayuda',
  doubleTapToSelectWord: 'Doble toque para seleccionar esta palabra como respuesta',
  doubleTapToHearAWord: 'Doble toque para escuchar una palabra',
  doubleTapToHear: 'Doble toque para escuchar',
  correctYouHeard: 'Correcto: escuchaste',
  correctThatWas: 'Correcto: era',
  incorrectThisWas: 'Era',
  listenAndCompareWith: 'Escucha de nuevo y compáralo con',
  trainThisContrast: 'Practicar este contraste',
  trainContrast: 'Practicar',
```

### العربية block

- [ ] **Step 6: Add to `العربية` locale (after `noPairsFound`)**

```typescript
  whichWordDidYouHear: 'أي كلمة سمعت؟',
  compareTheTwoWords: 'قارن بين الكلمتين',
  play: 'تشغيل',
  tryASpecificPair: 'اختر زوجاً محدداً',
  loading: 'جارٍ التحميل…',
  listenForSoundDifference: 'استمع إلى الفرق في الصوت.',
  contrastMovedToLevel: 'انتقل هذا التباين إلى المستوى',
  tips: 'نصائح',
  closeHelp: 'إغلاق التعليمات',
  helpLabel: 'تعليمات',
  doubleTapToSelectWord: 'انقر مرتين لاختيار هذه الكلمة كإجابتك',
  doubleTapToHearAWord: 'انقر مرتين للاستماع إلى كلمة',
  doubleTapToHear: 'انقر مرتين للاستماع',
  correctYouHeard: 'صحيح — سمعت',
  correctThatWas: 'صحيح — الكلمة كانت',
  incorrectThisWas: 'الكلمة كانت',
  listenAndCompareWith: 'استمع مرة أخرى وقارنه مع',
  trainThisContrast: 'تدرّب على هذا التباين',
  trainContrast: 'تدرّب على',
```

### Русский block

- [ ] **Step 7: Add to `Русский` locale (after `noPairsFound`)**

```typescript
  whichWordDidYouHear: 'Какое слово вы услышали?',
  compareTheTwoWords: 'Сравните два слова',
  play: 'Слушать',
  tryASpecificPair: 'Выбрать конкретную пару',
  loading: 'Загрузка…',
  listenForSoundDifference: 'Слушайте, улавливая разницу в звуках.',
  contrastMovedToLevel: 'Этот контраст перешёл на уровень',
  tips: 'Советы',
  closeHelp: 'Закрыть справку',
  helpLabel: 'Справка',
  doubleTapToSelectWord: 'Дважды нажмите, чтобы выбрать это слово в качестве ответа',
  doubleTapToHearAWord: 'Дважды нажмите, чтобы услышать слово',
  doubleTapToHear: 'Дважды нажмите, чтобы услышать',
  correctYouHeard: 'Правильно — вы услышали',
  correctThatWas: 'Правильно — это было',
  incorrectThisWas: 'Это было',
  listenAndCompareWith: 'Послушайте ещё раз и сравните с',
  trainThisContrast: 'Тренировать этот контраст',
  trainContrast: 'Тренировать',
```

### 한국어 block

- [ ] **Step 8: Add to `한국어` locale (after `noPairsFound`)**

```typescript
  whichWordDidYouHear: '어떤 단어를 들었나요?',
  compareTheTwoWords: '두 단어 비교하기',
  play: '재생',
  tryASpecificPair: '특정 쌍 선택하기',
  loading: '불러오는 중…',
  listenForSoundDifference: '소리 차이를 들어보세요.',
  contrastMovedToLevel: '이 대비음이 레벨로 올랐습니다:',
  tips: '도움말',
  closeHelp: '도움말 닫기',
  helpLabel: '도움말',
  doubleTapToSelectWord: '두 번 탭해서 이 단어를 답으로 선택하기',
  doubleTapToHearAWord: '두 번 탭해서 단어 듣기',
  doubleTapToHear: '두 번 탭해서 듣기:',
  correctYouHeard: '정답 — 들린 소리:',
  correctThatWas: '정답 — 그 단어는',
  incorrectThisWas: '이 단어는',
  listenAndCompareWith: '다시 듣고 비교해보세요:',
  trainThisContrast: '이 대비음 훈련하기',
  trainContrast: '훈련:',
```

### हिन्दी / اردو block

- [ ] **Step 9: Add to `हिन्दी / اردو` locale (after `noPairsFound`)**

```typescript
  whichWordDidYouHear: 'आपने कौन सा शब्द सुना?/آپ نے کون سا لفظ سنا؟',
  compareTheTwoWords: 'दो शब्दों की तुलना करें/دو الفاظ کا موازنہ کریں',
  play: 'सुनें/سنیں',
  tryASpecificPair: 'एक विशेष जोड़ी चुनें/ایک مخصوص جوڑا چنیں',
  loading: 'लोड हो रहा है…/لوڈ ہو رہا ہے…',
  listenForSoundDifference: 'ध्वनि का अंतर सुनें।/آواز کا فرق سنیں۔',
  contrastMovedToLevel: 'यह ध्वनि अंतर स्तर पर पहुँचा/یہ آوازی فرق سطح پر پہنچا',
  tips: 'सुझाव/تجاویز',
  closeHelp: 'सहायता बंद करें/مدد بند کریں',
  helpLabel: 'सहायता/مدد',
  doubleTapToSelectWord: 'इस शब्द को अपना उत्तर चुनने के लिए दो बार टैप करें/اس لفظ کو اپنا جواب چننے کے لیے دو بار ٹیپ کریں',
  doubleTapToHearAWord: 'शब्द सुनने के लिए दो बार टैप करें/لفظ سننے کے لیے دو بار ٹیپ کریں',
  doubleTapToHear: 'सुनने के लिए दो बار टैप करें/سننے کے لیے دو بار ٹیپ کریں',
  correctYouHeard: 'सही — आपने सुना/صحیح — آپ نے سنا',
  correctThatWas: 'सही — वह शब्द था/صحیح — وہ لفظ تھا',
  incorrectThisWas: 'यह शब्द था/یہ لفظ تھا',
  listenAndCompareWith: 'फिर से सुनें और इससे तुलना करें:/دوبارہ سنیں اور اس سے موازنہ کریں:',
  trainThisContrast: 'यह ध्वनि अंतर सीखें/یہ آوازی فرق سیکھیں',
  trainContrast: 'सीखें/سیکھیں',
```

### Português block

- [ ] **Step 10: Add to `Português` locale (after `noPairsFound`)**

```typescript
  whichWordDidYouHear: 'Qual palavra você ouviu?',
  compareTheTwoWords: 'Comparar as duas palavras',
  play: 'Ouvir',
  tryASpecificPair: 'Escolher um par específico',
  loading: 'Carregando…',
  listenForSoundDifference: 'Ouça a diferença no som.',
  contrastMovedToLevel: 'Este contraste avançou para o nível',
  tips: 'Dicas',
  closeHelp: 'Fechar ajuda',
  helpLabel: 'Ajuda',
  doubleTapToSelectWord: 'Toque duas vezes para selecionar esta palavra como resposta',
  doubleTapToHearAWord: 'Toque duas vezes para ouvir uma palavra',
  doubleTapToHear: 'Toque duas vezes para ouvir',
  correctYouHeard: 'Correto — você ouviu',
  correctThatWas: 'Correto — era',
  incorrectThisWas: 'Era',
  listenAndCompareWith: 'Ouça novamente e compare com',
  trainThisContrast: 'Praticar este contraste',
  trainContrast: 'Praticar',
```

### Tiếng Việt block

- [ ] **Step 11: Add to `Tiếng Việt` locale (after `noPairsFound`)**

```typescript
  whichWordDidYouHear: 'Bạn nghe thấy từ nào?',
  compareTheTwoWords: 'So sánh hai từ',
  play: 'Nghe',
  tryASpecificPair: 'Chọn một cặp từ cụ thể',
  loading: 'Đang tải…',
  listenForSoundDifference: 'Lắng nghe sự khác biệt về âm thanh.',
  contrastMovedToLevel: 'Cặp âm này đã lên cấp',
  tips: 'Mẹo',
  closeHelp: 'Đóng trợ giúp',
  helpLabel: 'Trợ giúp',
  doubleTapToSelectWord: 'Nhấn đúp để chọn từ này làm câu trả lời',
  doubleTapToHearAWord: 'Nhấn đúp để nghe một từ',
  doubleTapToHear: 'Nhấn đúp để nghe',
  correctYouHeard: 'Đúng — bạn đã nghe thấy',
  correctThatWas: 'Đúng — đó là',
  incorrectThisWas: 'Đó là',
  listenAndCompareWith: 'Nghe lại và so sánh với',
  trainThisContrast: 'Luyện cặp âm này',
  trainContrast: 'Luyện',
```

### Türkçe block

- [ ] **Step 12: Add to `Türkçe` locale (after `noPairsFound`)**

```typescript
  whichWordDidYouHear: 'Hangi kelimeyi duydunuz?',
  compareTheTwoWords: 'İki kelimeyi karşılaştır',
  play: 'Dinle',
  tryASpecificPair: 'Belirli bir çift seç',
  loading: 'Yükleniyor…',
  listenForSoundDifference: 'Ses farkını dinleyin.',
  contrastMovedToLevel: 'Bu ses farkı seviyeye yükseldi:',
  tips: 'İpuçları',
  closeHelp: 'Yardımı kapat',
  helpLabel: 'Yardım',
  doubleTapToSelectWord: 'Bu kelimeyi cevabın olarak seçmek için iki kez dokun',
  doubleTapToHearAWord: 'Bir kelime duymak için iki kez dokun',
  doubleTapToHear: 'Duymak için iki kez dokun',
  correctYouHeard: 'Doğru — duyduğunuz',
  correctThatWas: 'Doğru — bu kelimeydi',
  incorrectThisWas: 'Bu kelimeydi',
  listenAndCompareWith: 'Tekrar dinleyin ve karşılaştırın:',
  trainThisContrast: 'Bu ses farkını çalış',
  trainContrast: 'Çalış',
```

### فارسی block

- [ ] **Step 13: Add to `فارسی` locale (after `noPairsFound`)**

```typescript
  whichWordDidYouHear: 'کدام کلمه را شنیدید؟',
  compareTheTwoWords: 'دو کلمه را مقایسه کنید',
  play: 'پخش',
  tryASpecificPair: 'یک جفت خاص انتخاب کنید',
  loading: 'در حال بارگذاری…',
  listenForSoundDifference: 'تفاوت صدا را بشنوید.',
  contrastMovedToLevel: 'این تضاد به سطح رسید',
  tips: 'نکات',
  closeHelp: 'بستن راهنما',
  helpLabel: 'راهنما',
  doubleTapToSelectWord: 'دو بار ضربه بزنید تا این کلمه را به عنوان پاسخ انتخاب کنید',
  doubleTapToHearAWord: 'دو بار ضربه بزنید تا یک کلمه بشنوید',
  doubleTapToHear: 'دو بار ضربه بزنید تا بشنوید',
  correctYouHeard: 'درست — شنیدید',
  correctThatWas: 'درست — آن کلمه بود',
  incorrectThisWas: 'این بود',
  listenAndCompareWith: 'دوباره گوش کنید و با مقایسه کنید:',
  trainThisContrast: 'این تضاد را تمرین کنید',
  trainContrast: 'تمرین',
```

### 廣東話 block

- [ ] **Step 14: Add to `廣東話` locale (after `noPairsFound`)**

```typescript
  whichWordDidYouHear: '你聽到係哪個字？',
  compareTheTwoWords: '對比兩個字',
  play: '播放',
  tryASpecificPair: '選擇特定配對',
  loading: '載入中…',
  listenForSoundDifference: '聽聲音嘅分別。',
  contrastMovedToLevel: '呢個對比音升到等級',
  tips: '提示',
  closeHelp: '關閉幫助',
  helpLabel: '幫助',
  doubleTapToSelectWord: '雙擊選擇此字作為你的答案',
  doubleTapToHearAWord: '雙擊收聽一個字',
  doubleTapToHear: '雙擊聆聽',
  correctYouHeard: '啱，你聽到嘅係',
  correctThatWas: '啱，嗰個字係',
  incorrectThisWas: '嗰個字係',
  listenAndCompareWith: '再聽一次，同以下對比：',
  trainThisContrast: '練習呢個對比音',
  trainContrast: '練習',
```

### Bahasa Indonesia block

- [ ] **Step 15: Add to `Bahasa Indonesia` locale (after `noPairsFound`)**

```typescript
  whichWordDidYouHear: 'Kata mana yang kamu dengar?',
  compareTheTwoWords: 'Bandingkan kedua kata',
  play: 'Putar',
  tryASpecificPair: 'Pilih pasangan kata tertentu',
  loading: 'Memuat…',
  listenForSoundDifference: 'Dengarkan perbedaan bunyinya.',
  contrastMovedToLevel: 'Kontras ini naik ke level',
  tips: 'Tips',
  closeHelp: 'Tutup bantuan',
  helpLabel: 'Bantuan',
  doubleTapToSelectWord: 'Ketuk dua kali untuk memilih kata ini sebagai jawabanmu',
  doubleTapToHearAWord: 'Ketuk dua kali untuk mendengar sebuah kata',
  doubleTapToHear: 'Ketuk dua kali untuk mendengar',
  correctYouHeard: 'Benar — kamu mendengar',
  correctThatWas: 'Benar — kata itu adalah',
  incorrectThisWas: 'Kata itu adalah',
  listenAndCompareWith: 'Dengarkan lagi dan bandingkan dengan',
  trainThisContrast: 'Latih kontras ini',
  trainContrast: 'Latih',
```

- [ ] **Step 16: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors (all locale objects now have all required keys)

- [ ] **Step 17: Commit translations layer**

```bash
git add app/constants/translationKeys.ts app/constants/alternateLanguages.ts
git commit -m "i18n: add 19 translation keys for hardcoded UI copy across 15 locales

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Wire `utils/practiceFeedback.ts`

**Files:**
- Modify: `utils/practiceFeedback.ts`

The function needs to accept an optional `translate` function. When provided, uses translated strings. When omitted (existing tests), uses the same English strings as before.

- [ ] **Step 1: Update `practiceFeedback.ts` to accept translate**

Replace the entire file content with:

```typescript
import type { Pair } from '@/app/constants/minimalPairs';
import type { PlayedIndex, PracticeFeedback } from '@/app/domain/practiceSession';
import type { TranslationKey } from '@/app/constants/translationKeys';

export interface PracticeFeedbackCopy {
  headline: string;
  detail: string | null;
  correctWord: string;
  correctIpa: string;
  correctPhoneme: string | null;
  contrastWord: string;
  contrastIpa: string;
}

export interface PracticeFeedbackCopyInput {
  pair: Pair;
  feedback: PracticeFeedback;
  playedIdx: PlayedIndex;
  translate?: (key: TranslationKey) => string;
}

// English-only fallback strings used when no translate fn is provided (e.g. in tests)
const EN_FALLBACK: Record<string, string> = {
  correctYouHeard: 'Correct — you heard',
  correctThatWas: 'Correct — that was',
  incorrectThisWas: 'This was',
  listenAndCompareWith: 'Listen again and compare it with',
};

function normalizePhonemeForDisplay(value: string | undefined): string | null {
  const compact = (value ?? '').trim().replace(/^\/+|\/+$/g, '').trim();
  return compact ? `/${compact}/` : null;
}

export function buildPracticeFeedbackCopy({
  pair,
  feedback,
  playedIdx,
  translate,
}: PracticeFeedbackCopyInput): PracticeFeedbackCopy {
  const isWord1 = playedIdx === 0;
  const correctWord = isWord1 ? pair.word1 : pair.word2;
  const correctIpa = isWord1 ? pair.ipa1 : pair.ipa2;
  const correctPhoneme = normalizePhonemeForDisplay(
    isWord1 ? pair.contrastPhoneme1 : pair.contrastPhoneme2
  );
  const contrastWord = isWord1 ? pair.word2 : pair.word1;
  const contrastIpa = isWord1 ? pair.ipa2 : pair.ipa1;

  const t = (key: TranslationKey, fallback: string): string =>
    translate ? translate(key) : EN_FALLBACK[key] ?? fallback;

  if (feedback === 'correct') {
    return {
      headline: correctPhoneme
        ? `${t('correctYouHeard', 'Correct — you heard')} ${correctPhoneme} in ${correctWord}.`
        : `${t('correctThatWas', 'Correct — that was')} ${correctWord}.`,
      detail: null,
      correctWord,
      correctIpa,
      correctPhoneme,
      contrastWord,
      contrastIpa,
    };
  }

  return {
    headline: `${t('incorrectThisWas', 'This was')} ${correctWord}.`,
    detail: `${t('listenAndCompareWith', 'Listen again and compare it with')} ${contrastWord}.`,
    correctWord,
    correctIpa,
    correctPhoneme,
    contrastWord,
    contrastIpa,
  };
}
```

- [ ] **Step 2: Run practiceFeedback tests to verify they still pass**

```bash
npm test 2>&1 | grep -A5 "practiceFeedback"
```

Expected: `All practiceFeedback tests passed.`

(Tests don't pass `translate`, so they use `EN_FALLBACK` and get the same English strings as before.)

---

## Task 5: Wire `utils/contrastLabel.ts`

**Files:**
- Modify: `utils/contrastLabel.ts`

- [ ] **Step 1: Update `contrastLabel.ts` to accept translate**

Replace the entire file content with:

```typescript
import type { Pair } from '@/app/constants/minimalPairs';
import type { TranslationKey } from '@/app/constants/translationKeys';

type TranslateFn = (key: TranslationKey) => string;

function normalizePhonemeForDisplay(value: string | undefined): string {
  return (value ?? '').trim().replace(/^\/+|\/+$/g, '').trim();
}

function formatGroupFallback(group: string | undefined, translate?: TranslateFn): string {
  const compact = (group ?? '').trim();
  const defaultTitle = translate
    ? translate('trainThisContrast')
    : 'Train this contrast';
  if (!compact) return defaultTitle;

  const spaced = compact
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  const trainPrefix = translate ? translate('trainContrast') : 'Train';
  return spaced ? `${trainPrefix} ${spaced}` : defaultTitle;
}

export function buildContrastTrainingTitle(pair: Pair | undefined, translate?: TranslateFn): string {
  if (!pair) {
    return translate ? translate('trainThisContrast') : 'Train this contrast';
  }

  const first = normalizePhonemeForDisplay(pair.contrastPhoneme1);
  const second = normalizePhonemeForDisplay(pair.contrastPhoneme2);
  if (first && second) {
    const trainPrefix = translate ? translate('trainContrast') : 'Train';
    return `${trainPrefix} /${first}/ vs /${second}/`;
  }

  return formatGroupFallback(pair.group, translate);
}
```

- [ ] **Step 2: Run contrastLabel tests to verify they still pass**

```bash
npm test 2>&1 | grep -A5 "contrastLabel"
```

Expected: `All contrastLabel tests passed.`

(Tests call `buildContrastTrainingTitle(pair)` without translate → uses English fallback strings → same output as before.)

---

## Task 6: Wire `AnswerButtons.tsx`

**Files:**
- Modify: `app/components/AnswerButtons.tsx`

`useLanguage` is already imported. We just need to replace the 5 hardcoded strings.

- [ ] **Step 1: Replace `"Which word did you hear?"` and feedback panel strings**

In `app/components/AnswerButtons.tsx`:

Replace line 85:
```tsx
      <Text style={styles.answerPrompt}>Which word did you hear?</Text>
```
with:
```tsx
      <Text style={styles.answerPrompt}>{translate(tKeys.whichWordDidYouHear)}</Text>
```

Replace line 101:
```tsx
              accessibilityHint="Double tap to select this word as your answer"
```
with:
```tsx
              accessibilityHint={translate(tKeys.doubleTapToSelectWord)}
```

Replace line 155:
```tsx
              <Text style={styles.compareTitle}>Compare the two words</Text>
```
with:
```tsx
              <Text style={styles.compareTitle}>{translate(tKeys.compareTheTwoWords)}</Text>
```

Replace lines 170–171:
```tsx
                    accessibilityLabel={`Play ${item.word} ${item.ipa}`}
                    accessibilityHint={`Double tap to hear ${item.word}`}
```
with:
```tsx
                    accessibilityLabel={`${translate(tKeys.play)} ${item.word} ${item.ipa}`}
                    accessibilityHint={`${translate(tKeys.doubleTapToHear)} ${item.word}`}
```

Replace line 175:
```tsx
                      Play {item.word}
```
with:
```tsx
                      {translate(tKeys.play)} {item.word}
```

- [ ] **Step 2: Wire translate into buildPracticeFeedbackCopy call**

In `AnswerButtons.tsx`, the `feedbackCopy` memo calls `buildPracticeFeedbackCopy`. Update it to pass translate:

Find (lines 53–59):
```tsx
  const feedbackCopy = useMemo(
    () =>
      feedback !== null && playedIdx != null
        ? buildPracticeFeedbackCopy({ pair, feedback, playedIdx })
        : null,
    [feedback, pair, playedIdx]
  );
```

Replace with:
```tsx
  const feedbackCopy = useMemo(
    () =>
      feedback !== null && playedIdx != null
        ? buildPracticeFeedbackCopy({ pair, feedback, playedIdx, translate })
        : null,
    [feedback, pair, playedIdx, translate]
  );
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors

---

## Task 7: Wire `PairPicker.tsx` — add accessibilityLabel prop

**Files:**
- Modify: `app/components/PairPicker.tsx`

- [ ] **Step 1: Add `accessibilityLabel` prop and remove hardcoded string**

Replace the `Props` interface:
```typescript
interface Props {
  pairs: { word1: string; word2: string; ipa1: string; ipa2: string }[];
  index: number;
  setIndex: (i: number) => void;
  color: string;
  onScrollStart?: () => void;
  onScrollEnd?: () => void;
}
```
with:
```typescript
interface Props {
  pairs: { word1: string; word2: string; ipa1: string; ipa2: string }[];
  index: number;
  setIndex: (i: number) => void;
  color: string;
  accessibilityLabel?: string;
  onScrollStart?: () => void;
  onScrollEnd?: () => void;
}
```

Replace function signature line:
```typescript
function PairPickerInner({ pairs, index, setIndex, color, onScrollStart, onScrollEnd }: Props) {
```
with:
```typescript
function PairPickerInner({ pairs, index, setIndex, color, accessibilityLabel, onScrollStart, onScrollEnd }: Props) {
```

Replace line 58 (hardcoded accessibilityLabel):
```tsx
      accessibilityLabel="Try a specific pair"
```
with:
```tsx
      accessibilityLabel={accessibilityLabel}
```

---

## Task 8: Wire `PracticePairSelector.tsx` — add useLanguage and pass translated props

**Files:**
- Modify: `app/components/practice/PracticePairSelector.tsx`

- [ ] **Step 1: Import useLanguage and tKeys, replace hardcoded strings, pass label to PairPicker**

Replace the entire file:

```tsx
import React from 'react';
import { Text, View } from 'react-native';
import PairPicker from '@/app/components/PairPicker';
import type { Pair } from '@/app/constants/minimalPairs';
import type { AppStyles } from '@/app/constants/styles';
import { useLanguage } from '@/app/context/LanguageContext';
import { tKeys } from '@/app/constants/translationKeys';

type PracticePairSelectorStyles = Pick<
  AppStyles,
  'pickerOverrideContainer' | 'pickerOverrideLabel'
>;

interface PracticePairSelectorProps {
  isLoading: boolean;
  selectedPair: Pair | undefined;
  pairs: Pair[];
  index: number;
  onIndexChange: (index: number) => void;
  color: string;
  loadingTextColor: string;
  styles: PracticePairSelectorStyles;
  onScrollStart: () => void;
  onScrollEnd: () => void;
}

export default function PracticePairSelector({
  isLoading,
  selectedPair,
  pairs,
  index,
  onIndexChange,
  color,
  loadingTextColor,
  styles,
  onScrollStart,
  onScrollEnd,
}: PracticePairSelectorProps) {
  const { translate } = useLanguage();

  if (isLoading || !selectedPair) {
    return (
      <View
        style={{ height: 220, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{ color: loadingTextColor }}>{translate(tKeys.loading)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.pickerOverrideContainer}>
      <Text style={styles.pickerOverrideLabel}>{translate(tKeys.tryASpecificPair)}</Text>
      <PairPicker
        pairs={pairs}
        index={index}
        setIndex={onIndexChange}
        color={color}
        accessibilityLabel={translate(tKeys.tryASpecificPair)}
        onScrollStart={onScrollStart}
        onScrollEnd={onScrollEnd}
      />
    </View>
  );
}
```

---

## Task 9: Wire `ListenControls.tsx` — add useLanguage for hint

**Files:**
- Modify: `app/components/practice/ListenControls.tsx`

- [ ] **Step 1: Add useLanguage and replace hardcoded hint**

Replace the entire file:

```tsx
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import type { AppStyles } from '@/app/constants/styles';
import { useLanguage } from '@/app/context/LanguageContext';
import { tKeys } from '@/app/constants/translationKeys';

type ListenControlsStyles = Pick<AppStyles, 'button' | 'buttonText'>;

interface ListenControlsProps {
  label: string;
  disabled: boolean;
  onPlay: () => void;
  styles: ListenControlsStyles;
}

export default function ListenControls({
  label,
  disabled,
  onPlay,
  styles,
}: ListenControlsProps) {
  const { translate } = useLanguage();

  return (
    <TouchableOpacity
      style={[styles.button, { zIndex: 10 }]}
      onPress={onPlay}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={translate(tKeys.doubleTapToHearAWord)}
      accessibilityState={{ disabled }}
    >
      <Text style={styles.buttonText} importantForAccessibility="no">
        {label}
      </Text>
    </TouchableOpacity>
  );
}
```

---

## Task 10: Wire `PracticeHeader.tsx` — add helpAccessibilityLabel prop

**Files:**
- Modify: `app/components/practice/PracticeHeader.tsx`

- [ ] **Step 1: Add prop and replace hardcoded accessibilityLabel**

Replace the entire file:

```tsx
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppStyles } from '@/app/constants/styles';

type PracticeHeaderStyles = Pick<
  AppStyles,
  'practiceHeader' | 'practiceHeaderSpacer' | 'practiceTitle' | 'helpButton'
>;

interface PracticeHeaderProps {
  title: string;
  helpAccessibilityLabel: string;
  onHelpPress: () => void;
  primaryColor: string;
  styles: PracticeHeaderStyles;
}

export default function PracticeHeader({
  title,
  helpAccessibilityLabel,
  onHelpPress,
  primaryColor,
  styles,
}: PracticeHeaderProps) {
  return (
    <View style={styles.practiceHeader}>
      <View style={styles.practiceHeaderSpacer} />
      <Text style={styles.practiceTitle}>{title}</Text>
      <TouchableOpacity
        accessibilityLabel={helpAccessibilityLabel}
        accessibilityRole="button"
        activeOpacity={0.8}
        hitSlop={8}
        onPress={onHelpPress}
        style={styles.helpButton}
      >
        <Ionicons
          name="information-circle-outline"
          size={24}
          color={primaryColor}
        />
      </TouchableOpacity>
    </View>
  );
}
```

---

## Task 11: Wire `HelpOverlay.tsx`

**Files:**
- Modify: `app/components/HelpOverlay.tsx`

- [ ] **Step 1: Replace 3 hardcoded strings**

Replace line 46 (backdrop close button):
```tsx
          accessibilityLabel="Close help"
```
with:
```tsx
          accessibilityLabel={t(tKeys.closeHelp)}
```

Replace line 55 (modal region label):
```tsx
            accessibilityLabel="How to practice help"
```
with:
```tsx
            accessibilityLabel={t(tKeys.helpTitle)}
```

Replace line 70 (Tips heading):
```tsx
              <ThemedText style={styles.tipsHeading} type="defaultSemiBold">
                Tips
              </ThemedText>
```
with:
```tsx
              <ThemedText style={styles.tipsHeading} type="defaultSemiBold">
                {t(tKeys.tips)}
              </ThemedText>
```

---

## Task 12: Wire `app/(tabs)/index.tsx`

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Update the 4 hardcoded strings**

Replace line 480 (loading state):
```tsx
        <Text style={{ color: theme.textSecondary }}>Loading…</Text>
```
with:
```tsx
        <Text style={{ color: theme.textSecondary }}>{translate(tKeys.loading)}</Text>
```

Replace line 502–504 (PracticeHeader title and new helpAccessibilityLabel prop):
```tsx
      <PracticeHeader
        title="Practice"
        onHelpPress={() => setIsHelpVisible(true)}
```
with:
```tsx
      <PracticeHeader
        title={translate(tKeys.practicePairs)}
        helpAccessibilityLabel={translate(tKeys.helpLabel)}
        onHelpPress={() => setIsHelpVisible(true)}
```

Replace line 513–515 (contrastInstruction):
```tsx
          <Text style={styles.contrastInstruction}>
            Listen for the sound difference.
          </Text>
```
with:
```tsx
          <Text style={styles.contrastInstruction}>
            {translate(tKeys.listenForSoundDifference)}
          </Text>
```

Replace lines 524–529 (LevelUpCelebration label):
```tsx
        <LevelUpCelebration
          promotedTier={promotedTier}
          label={
            promotedTier == null
              ? translate(tKeys.levelUnlocked)
              : `This contrast moved to Level ${promotedTier}`
          }
```
with:
```tsx
        <LevelUpCelebration
          promotedTier={promotedTier}
          label={
            promotedTier == null
              ? translate(tKeys.levelUnlocked)
              : `${translate(tKeys.contrastMovedToLevel)} ${promotedTier}`
          }
```

- [ ] **Step 2: Update contrastTrainingTitle memo to pass translate**

Find (lines 210–213):
```tsx
  const contrastTrainingTitle = useMemo(
    () => buildContrastTrainingTitle(selectedPair),
    [selectedPair]
  );
```
Replace with:
```tsx
  const contrastTrainingTitle = useMemo(
    () => buildContrastTrainingTitle(selectedPair, translate),
    [selectedPair, translate]
  );
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors

---

## Task 13: Add i18n coverage test

**Files:**
- Create: `scripts/i18n.test.js`

- [ ] **Step 1: Create the test file**

```javascript
const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const { tKeys } = loadTsModule(
  path.join(__dirname, '..', 'app', 'constants', 'translationKeys.ts')
);
const { englishTranslations, alternateLanguages } = loadTsModule(
  path.join(__dirname, '..', 'app', 'constants', 'alternateLanguages.ts')
);

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const tKeyNames = Object.keys(tKeys);
const englishKeyNames = Object.keys(englishTranslations);
const localeNames = Object.keys(alternateLanguages);

runTest('every tKey exists in englishTranslations', () => {
  const missing = tKeyNames.filter((k) => !(k in englishTranslations));
  assert.deepStrictEqual(
    missing,
    [],
    `tKeys not in englishTranslations: ${missing.join(', ')}`
  );
});

for (const locale of localeNames) {
  runTest(`${locale}: no tKey is missing`, () => {
    const localeObj = alternateLanguages[locale];
    const missing = tKeyNames.filter((k) => !(k in localeObj));
    assert.deepStrictEqual(
      missing,
      [],
      `[${locale}] missing keys: ${missing.join(', ')}`
    );
  });
}

console.log(`\nAll i18n coverage tests passed (${localeNames.length} locales, ${tKeyNames.length} keys).`);
```

- [ ] **Step 2: Run all tests to confirm everything passes**

```bash
npm test
```

Expected output includes:
```
i18n.test.js
ok - every tKey exists in englishTranslations
ok - English: no tKey is missing
ok - 日本語: no tKey is missing
... (all 15 locales pass)
All i18n coverage tests passed (16 locales, N keys).
```

---

## Task 14: Final verification and commit

- [ ] **Step 1: Run full typecheck**

```bash
npm run typecheck
```

Expected: 0 errors

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all test files pass, including new `i18n.test.js`

- [ ] **Step 3: Grep for any remaining hardcoded user-facing strings (spot check)**

```bash
grep -rn "Which word did you hear\|Compare the two words\|Listen for the sound\|Double tap to\|Try a specific\|Train this contrast\|Correct — you heard\|This was\|Listen again and compare" app/ utils/ --include="*.tsx" --include="*.ts"
```

Expected: 0 results (all wired through translation keys)

- [ ] **Step 4: Commit all component and utility changes**

```bash
git add app/components/AnswerButtons.tsx \
  app/components/PairPicker.tsx \
  app/components/practice/PracticePairSelector.tsx \
  app/components/practice/ListenControls.tsx \
  app/components/practice/PracticeHeader.tsx \
  app/components/HelpOverlay.tsx \
  app/(tabs)/index.tsx \
  utils/practiceFeedback.ts \
  utils/contrastLabel.ts \
  scripts/i18n.test.js
git commit -m "i18n: wire all hardcoded UI copy through translation keys

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Natural Translation Notes / Needs Native Review

The following translations were generated to be natural and concise but should be verified by native speakers:

- **Japanese** `correctYouHeard`: "正解。聞こえた音：" — colon separator before English phoneme+word
- **Japanese** `trainContrast`: "練習：" — colon after the verb to naturally lead into the phoneme pair
- **Korean** `correctYouHeard`: "정답 — 들린 소리:" — colon before English phoneme; verify with native Korean speaker
- **Korean** `trainContrast`: "훈련:" — verify this verb form is natural in the context of phoneme pairs
- **Hindi/Urdu** all keys use the dual Hindi/Urdu pattern (slash-separated) matching the existing convention in the file
- **Arabic** `closeHelp`: "إغلاق التعليمات" — verify preferred term for "help" (التعليمات vs المساعدة)
- **Persian** `listenAndCompareWith`: "دوباره گوش کنید و با مقایسه کنید:" — the "با" (with) immediately before the English comparison word may read awkwardly; verify
- **Thai** `whichWordDidYouHear`: uses "？" (full-width question mark) matching existing Thai strings in the file
- **Vietnamese** `contrastMovedToLevel`: "Cặp âm này đã lên cấp" drops the level number context — consider "Cặp âm này đã lên cấp" + number, or "Cặp âm này chuyển sang cấp" to be more parallel. The number is appended as-is.
- **Turkish** `compareTheTwoWords`: "İki kelimeyi karşılaştır" — imperative form; verify if a noun form is preferred
- **Cantonese** `whichWordDidYouHear`: "你聽到係哪個字？" — verify natural Cantonese phrasing

---

## Merge Readiness Checklist

Before merging, confirm:
- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm test` passes (all scripts including `i18n.test.js`)
- [ ] Spot-check grep finds no remaining hardcoded user-facing English
- [ ] All 16 locale objects contain all `tKeys` keys (enforced by `i18n.test.js`)
- [ ] English training words (ship, sheep, right, light etc.) were not translated
- [ ] IPA and phoneme notation unchanged
- [ ] No UI redesign or behavior changes
- [ ] `app/components/FeedbackDisplay.tsx` — confirmed this file does not exist (not a missing file)

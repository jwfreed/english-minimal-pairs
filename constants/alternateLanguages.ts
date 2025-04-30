interface LanguageTranslations {
  home: string;
  results: string;
  info: string;
  practicePairs: string;
  averageByPair: string;
  playAudio: string;
  accuracyTrend: string;
  timePracticed: string;
  min: string;
  weightedAverage: string;
  total: string;

  titleOne: string;
  infoOne: string;
  titleTwo: string;
  infoTwo: string;
  titleThree: string;
  infoThree: string;
  audioErrorTitle?: string | undefined;
  audioErrorNotReady?: string | undefined;
  audioErrorPlaybackFail?: string | undefined;
  [key: string]: string | undefined;
}

export const alternateLanguages: Record<string, LanguageTranslations> = {
  日本語: {
    home: 'ホーム',
    results: '結果',
    info: '情報',
    practicePairs: '練習ペア',
    averageByPair: 'ペア別平均',
    playAudio: 'オーディオを再生',
    accuracyTrend: '正答率の推移',
    timePracticed: '練習時間',
    min: '分',
    weightedAverage: '加重平均',
    total: '合計',
    audioErrorTitle: '音声エラー',
    audioErrorNotReady: '音声がまだ準備できていません',
    audioErrorPlaybackFail: '再生に失敗しました',
    titleOne: '👂 耳を鍛えて、リスニング力を変えよう！',
    infoOne:
      '多くの英語学習者は "ship" と "sheep"、"light" と "right" の違いを聞き取れません。このアプリは、そうした違いを聞き取れる耳を作るためのトレーニングを提供します。',
    titleTwo: '🎯 目標',
    infoTwo:
      '各ペアを合計60分以上練習することを目指しましょう。最初は難しく感じるかもしれませんが、練習を重ねることで脳が適応してきます！',
    titleThree: '✅ アプリの使い方',
    infoThree:
      '•「オーディオを再生」をタップして単語を聞く\n• 聞こえた単語を選択\n• 正解・不正解がすぐに表示\n• 練習履歴が保存され、進捗が確認できます',
  },

  中文: {
    home: '首页',
    results: '结果',
    info: '信息',
    practicePairs: '练习对',
    averageByPair: '每对平均',
    playAudio: '播放音频',
    accuracyTrend: '准确率趋势',
    timePracticed: '练习时间',
    min: '分钟',
    weightedAverage: '加权平均',
    audioErrorTitle: '音频错误',
    audioErrorNotReady: '音频尚未准备好',
    audioErrorPlaybackFail: '播放失败',
    total: '总计',
    titleOne: '👂 训练你的耳朵，改善听力理解！',
    infoOne:
      '许多英语学习者分不清 "ship" 和 "sheep" 或 "light" 和 "right"。本应用帮助你训练听觉，分辨这些细微差别。',
    titleTwo: '🎯 目标',
    infoTwo: '每对词至少练习60分钟。起初可能很难，但练习多了，大脑会适应！',
    titleThree: '✅ 使用方法',
    infoThree:
      '• 点击“播放音频”听单词\n• 选择你听到的单词\n• 立即获得反馈\n• 记录练习进度，查看成长',
  },
  ภาษาไทย: {
    home: 'หน้าแรก',
    results: 'ผลลัพธ์',
    info: 'ข้อมูล',
    practicePairs: 'คู่ฝึก',
    averageByPair: 'เฉลี่ยต่อคู่',
    playAudio: 'เล่นเสียง',
    accuracyTrend: 'แนวโน้มความถูกต้อง',
    timePracticed: 'เวลาที่ฝึกฝน',
    min: 'นาที',
    weightedAverage: 'ค่าเฉลี่ยถ่วงน้ำหนัก',
    audioErrorTitle: 'ข้อผิดพลาดเสียง',
    audioErrorNotReady: 'ไฟล์เสียงยังไม่พร้อม',
    audioErrorPlaybackFail: 'เล่นเสียงไม่สำเร็จ',
    total: 'ทั้งหมด',
    titleOne: '👂 ฝึกหูของคุณ เปลี่ยนการฟังของคุณ!',
    infoOne:
      'ผู้เรียนภาษาอังกฤษหลายคนแยกไม่ออกระหว่างคำว่า "ship" กับ "sheep" หรือ "light" กับ "right" แอปนี้ช่วยฝึกให้คุณได้ยินความแตกต่างนั้น',
    titleTwo: '🎯 เป้าหมาย',
    infoTwo:
      'ฝึกแต่ละคู่ให้ครบอย่างน้อย 60 นาที ไม่ต้องกังวลถ้ายังยากในตอนแรก สมองจะค่อยๆ ปรับตัว',
    titleThree: '✅ วิธีใช้งาน',
    infoThree:
      '• แตะ “เล่นเสียง” เพื่อฟัง\n• เลือกคำที่คุณได้ยิน\n• รับคำตอบถูก/ผิดทันที\n• ติดตามความก้าวหน้าของคุณ',
  },
  'idioma español': {
    home: 'Inicio',
    results: 'Resultados',
    info: 'Información',
    practicePairs: 'Parejas de práctica',
    averageByPair: 'Promedio por pareja',
    playAudio: 'Reproducir Audio',
    accuracyTrend: 'Tendencia de precisión',
    timePracticed: 'Tiempo practicado',
    min: 'minutos',
    weightedAverage: 'Promedio ponderado',
    audioErrorTitle: 'Error de audio',
    audioErrorNotReady: 'El audio aún no está listo',
    audioErrorPlaybackFail: 'Error al reproducir',
    total: 'Total',
    titleOne: '👂 ¡Entrena tus oídos y mejora tu comprensión auditiva!',
    infoOne:
      'Muchos estudiantes no distinguen "ship" de "sheep" o "light" de "right". Esta app te entrena para reconocer esas diferencias.',
    titleTwo: '🎯 Meta',
    infoTwo:
      'Practica al menos 60 minutos por cada pareja. ¡Tu oído mejorará con el tiempo!',
    titleThree: '✅ Cómo funciona',
    infoThree:
      '• Toca "Reproducir Audio" para escuchar\n• Elige la palabra que crees haber oído\n• Recibe retroalimentación inmediata\n• Tu progreso se guarda automáticamente',
  },
  'اللغة العربية': {
    home: 'الرئيسية',
    results: 'النتائج',
    info: 'المعلومات',
    practicePairs: 'أزواج التدريب',
    averageByPair: 'متوسط الزوج',
    playAudio: 'تشغيل الصوت',
    accuracyTrend: 'اتجاه الدقة',
    timePracticed: 'الوقت الممارس',
    min: 'دقائق',
    weightedAverage: 'المتوسط المرجح',
    audioErrorTitle: 'خطأ في الصوت',
    audioErrorNotReady: 'الصوت غير جاهز بعد',
    audioErrorPlaybackFail: 'فشل في التشغيل',
    total: 'المجموع',
    titleOne: '👂 درّب أذنيك وغيّر مهارات الاستماع!',
    infoOne:
      'الكثير من متعلمي اللغة الإنجليزية لا يميزون بين "ship" و "sheep" أو "light" و "right". هذا التطبيق يساعدك على تحسين تمييز هذه الأصوات.',
    titleTwo: '🎯 الهدف',
    infoTwo:
      'خصص 60 دقيقة على الأقل لكل زوج كلمات. لا تقلق إذا بدا الأمر صعبًا في البداية — سيتكيف دماغك مع الوقت.',
    titleThree: '✅ طريقة الاستخدام',
    infoThree:
      '• اضغط على "تشغيل الصوت" للاستماع\n• اختر الكلمة التي سمعتها\n• ستحصل على نتيجة فورية\n• يتم حفظ تقدمك تلقائيًا',
  },
  'русский язык': {
    home: 'Главная',
    results: 'Результаты',
    info: 'Информация',
    practicePairs: 'Пары для практики',
    averageByPair: 'Среднее по парам',
    playAudio: 'Воспроизвести аудио',
    accuracyTrend: 'Тенденция точности',
    timePracticed: 'Время практики',
    min: 'минут',
    weightedAverage: 'Взвешенное среднее',
    audioErrorTitle: 'Ошибка аудио',
    audioErrorNotReady: 'Аудио ещё не готово',
    audioErrorPlaybackFail: 'Не удалось воспроизвести',
    total: 'Итого',
    titleOne: '👂 Тренируй слух — улучшай понимание!',
    infoOne:
      'Многие изучающие английский не различают "ship" и "sheep" или "light" и "right". Это приложение поможет научиться их слышать.',
    titleTwo: '🎯 Цель',
    infoTwo:
      'Практикуй каждую пару минимум 60 минут. Сложно сначала — но мозг привыкнет!',
    titleThree: '✅ Как это работает',
    infoThree:
      '• Нажми “Воспроизвести аудио”\n• Выбери слово, которое услышал\n• Мгновенная обратная связь\n• Прогресс сохраняется',
  },
  한국어: {
    home: '홈',
    results: '결과',
    info: '정보',
    practicePairs: '연습 쌍',
    averageByPair: '쌍별 평균',
    playAudio: '오디오 재생',
    accuracyTrend: '정확도 추이',
    timePracticed: '연습 시간',
    min: '분',
    weightedAverage: '가중 평균',
    audioErrorTitle: '오디오 오류',
    audioErrorNotReady: '오디오가 아직 준비되지 않았습니다',
    audioErrorPlaybackFail: '재생에 실패했습니다',
    total: '총합',
    titleOne: '👂 귀를 훈련하여 듣기 능력을 향상시키세요!',
    infoOne:
      '많은 영어 학습자들이 "ship"과 "sheep", "light"과 "right"의 차이를 구별하지 못합니다. 이 앱은 그런 구별을 가능하게 도와줍니다.',
    titleTwo: '🎯 목표',
    infoTwo:
      '각 단어 쌍을 최소 60분 이상 연습하세요. 처음에는 어려워도 점점 더 잘 들릴 거예요!',
    titleThree: '✅ 사용 방법',
    infoThree:
      '• "오디오 재생"을 눌러 단어 듣기\n• 들은 단어 선택하기\n• 즉시 피드백 받기\n• 진행 상황 자동 저장',
  },
  'हिंदी/اردو': {
    home: 'होम/ہوم',
    results: 'परिणाम/نتائج',
    info: 'जानकारी/معلومات',
    practicePairs: 'अभ्यास जोड़ी/عملی جوڑے',
    averageByPair: 'जोड़ी द्वारा औसत/جوڑے کے حساب سے اوسط',
    playAudio: 'ऑडियो चलाएँ/آڈیو چلائیں',
    accuracyTrend: 'सटीकता प्रवृत्ति/درستگی کا رجحان',
    timePracticed: 'अभ्यास का समय/مشق کا وقت',
    min: 'मिनट/منٹ',
    weightedAverage: 'भारित औसत/وزنی اوسط',
    audioErrorTitle: 'ऑडियो त्रुटि',
    audioErrorNotReady: 'ऑडियो अभी तैयार नहीं है',
    audioErrorPlaybackFail: 'प्लेबैक विफल हुआ',
    total: 'कुल/کل',
    titleOne: '👂 अपने कानों को प्रशिक्षित करें, सुनने की क्षमता सुधारें!',
    infoOne:
      '"ship" और "sheep" या "light" और "right" जैसे शब्दों में फर्क करना कठिन हो सकता है। यह ऐप आपको वह फर्क सुनने में मदद करता है।',
    titleTwo: '🎯 लक्ष्य',
    infoTwo:
      'हर जोड़ी पर कम से कम 60 मिनट अभ्यास करें। शुरुआत में कठिन लग सकता है, लेकिन अभ्यास से सुधार होगा!',
    titleThree: '✅ यह कैसे काम करता है',
    infoThree:
      '• "ऑडियो चलाएँ" पर टैप करें\n• सुनी हुई शब्द चुनें\n• तुरंत प्रतिक्रिया पाएं\n• आपकी प्रगति सहेजी जाती है',
  },
  Português: {
    home: 'Início',
    results: 'Resultados',
    info: 'Informações',
    practicePairs: 'Pares de prática',
    averageByPair: 'Média por par',
    playAudio: 'Reproduzir áudio',
    accuracyTrend: 'Tendência de precisão',
    timePracticed: 'Tempo praticado',
    min: 'minutos',
    weightedAverage: 'Média ponderada',
    audioErrorTitle: 'Erro de áudio',
    audioErrorNotReady: 'O áudio ainda não está pronto',
    audioErrorPlaybackFail: 'Falha na reprodução',
    total: 'Total',
    titleOne: '👂 Treine seus ouvidos, melhore sua escuta!',
    infoOne:
      'Muitos alunos de inglês não distinguem "ship" de "sheep" ou "light" de "right". Este app ajuda a treinar sua audição para perceber essas diferenças.',
    titleTwo: '🎯 Objetivo',
    infoTwo:
      'Pratique pelo menos 60 minutos com cada par. No início pode ser difícil, mas seu cérebro vai se adaptar!',
    titleThree: '✅ Como funciona',
    infoThree:
      '• Toque em "Reproduzir áudio" para ouvir\n• Escolha a palavra que você ouviu\n• Receba feedback imediato\n• Acompanhe seu progresso automaticamente',
  },
  'Tiếng Việt': {
    home: 'Trang chủ',
    results: 'Kết quả',
    info: 'Thông tin',
    practicePairs: 'Cặp luyện tập',
    averageByPair: 'Trung bình theo cặp',
    playAudio: 'Phát âm thanh',
    accuracyTrend: 'Xu hướng chính xác',
    timePracticed: 'Thời gian luyện tập',
    min: 'phút',
    weightedAverage: 'Trung bình trọng số',
    audioErrorTitle: 'Lỗi âm thanh',
    audioErrorNotReady: 'Âm thanh chưa sẵn sàng',
    audioErrorPlaybackFail: 'Phát lại thất bại',
    total: 'Tổng cộng',
    titleOne: '👂 Luyện tai, cải thiện kỹ năng nghe!',
    infoOne:
      'Nhiều người học tiếng Anh không phân biệt được "ship" và "sheep", hoặc "light" và "right". Ứng dụng này giúp bạn luyện nghe các âm thanh khó phân biệt.',
    titleTwo: '🎯 Mục tiêu',
    infoTwo:
      'Dành ít nhất 60 phút luyện tập mỗi cặp. Ban đầu có thể khó, nhưng não bạn sẽ thích nghi dần!',
    titleThree: '✅ Cách sử dụng',
    infoThree:
      '• Nhấn "Phát âm thanh" để nghe\n• Chọn từ bạn nghe thấy\n• Nhận phản hồi ngay lập tức\n• Tiến độ luyện tập sẽ được lưu lại',
  },
  Türkçe: {
    home: 'Ana Sayfa',
    results: 'Sonuçlar',
    info: 'Bilgiler',
    practicePairs: 'Alıştırma Çiftleri',
    averageByPair: 'Çifte Göre Ortalama',
    playAudio: 'Ses çal',
    accuracyTrend: 'Doğruluk Trendi',
    timePracticed: 'Alıştırma süresi',
    min: 'dakika',
    weightedAverage: 'Ağırlıklı Ortalama',
    audioErrorTitle: 'Ses hatası',
    audioErrorNotReady: 'Ses henüz hazır değil',
    audioErrorPlaybackFail: 'Oynatma başarısız',
    total: 'Toplam',
    titleOne: '👂 Kulaklarınızı eğitin, dinleme becerinizi geliştirin!',
    infoOne:
      'Birçok İngilizce öğrenen kişi "ship" ve "sheep" ya da "light" ve "right" arasındaki farkı duyamaz. Bu uygulama size bu farkları duymayı öğretir.',
    titleTwo: '🎯 Hedef',
    infoTwo:
      'Her eşleşme için en az 60 dakika pratik yapın. Başta zor olabilir ama zamanla beyniniz alışır!',
    titleThree: '✅ Nasıl çalışır',
    infoThree:
      '• Kelimeyi duymak için "Ses çal" tuşuna basın\n• Duyduğunuz kelimeyi seçin\n• Anında geri bildirim alın\n• İlerlemeniz kaydedilir',
  },
  'زبان فارسی': {
    home: 'خانه',
    results: 'نتایج',
    info: 'اطلاعات',
    practicePairs: 'جفت‌های تمرینی',
    averageByPair: 'میانگین هر جفت',
    playAudio: 'پخش صدا',
    accuracyTrend: 'روند دقت',
    timePracticed: 'زمان تمرین',
    min: 'دقیقه',
    weightedAverage: 'میانگین وزنی',
    audioErrorTitle: 'خطای صدا',
    audioErrorNotReady: 'صدا هنوز آماده نیست',
    audioErrorPlaybackFail: 'پخش ناموفق بود',
    total: 'مجموع',
    titleOne: '👂 گوش‌های خود را آموزش دهید و مهارت شنیداری را بهبود دهید!',
    infoOne:
      'بسیاری از زبان‌آموزان تفاوت "ship" و "sheep" یا "light" و "right" را تشخیص نمی‌دهند. این اپ به شما کمک می‌کند تا این تفاوت‌ها را بشنوید.',
    titleTwo: '🎯 هدف',
    infoTwo:
      'برای هر جفت کلمه، حداقل ۶۰ دقیقه تمرین کنید. در ابتدا ممکن است سخت باشد، اما ذهن شما با تمرین سازگار می‌شود.',
    titleThree: '✅ نحوه استفاده',
    infoThree:
      '• برای شنیدن کلمه، "پخش صدا" را بزنید\n• کلمه‌ای که شنیدید را انتخاب کنید\n• بلافاصله بازخورد بگیرید\n• پیشرفت شما ذخیره می‌شود',
  },
  廣東話: {
    home: '首頁',
    results: '結果',
    info: '資訊',
    practicePairs: '練習對',
    averageByPair: '每對平均',
    playAudio: '播放音頻',
    accuracyTrend: '準確率趨勢',
    timePracticed: '練習時間',
    min: '分鐘',
    weightedAverage: '加權平均',
    audioErrorTitle: '聲音錯誤',
    audioErrorNotReady: '聲音尚未準備好',
    audioErrorPlaybackFail: '播放失敗',
    total: '總計',
    titleOne: '👂 訓練耳朵，改善聽力！',
    infoOne:
      '好多學英文嘅人都分唔清 "ship" 同 "sheep" 或 "light" 同 "right"。呢個應用程式幫你聽得出呢啲分別。',
    titleTwo: '🎯 目標',
    infoTwo: '每對最少練習60分鐘。剛開始可能會難，但你嘅腦會習慣嘅！',
    titleThree: '✅ 使用方法',
    infoThree:
      '• 撳「播放音頻」去聽一個字\n• 揀返你聽到嘅字\n• 即時睇答啱定唔啱\n• 系統會自動記錄你嘅進度',
  },
  'bahasa Indo': {
    home: 'Beranda',
    results: 'Hasil',
    info: 'Informasi',
    practicePairs: 'Pasangan Latihan',
    averageByPair: 'Rata-rata per Pasangan',
    playAudio: 'Putar Audio',
    accuracyTrend: 'Tren Akurasi',
    timePracticed: 'Waktu berlatih',
    min: 'menit',
    weightedAverage: 'Rata-rata tertimbang',
    audioErrorTitle: 'Kesalahan audio',
    audioErrorNotReady: 'Audio belum siap',
    audioErrorPlaybackFail: 'Pemutaran gagal',
    total: 'Total',
    titleOne: '👂 Latih pendengaranmu, tingkatkan kemampuan listening!',
    infoOne:
      'Banyak pelajar bingung membedakan "ship" dan "sheep" atau "light" dan "right". Aplikasi ini membantu kamu melatih pendengaran untuk membedakan bunyi tersebut.',
    titleTwo: '🎯 Tujuan',
    infoTwo:
      'Latih setiap pasangan kata selama minimal 60 menit. Awalnya mungkin sulit, tapi otakmu akan terbiasa.',
    titleThree: '✅ Cara penggunaan',
    infoThree:
      '• Tekan "Putar Audio" untuk mendengarkan\n• Pilih kata yang kamu dengar\n• Dapatkan umpan balik langsung\n• Kemajuanmu akan tersimpan secara otomatis',
  },
};

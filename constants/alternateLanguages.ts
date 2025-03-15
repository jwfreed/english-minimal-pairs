interface LanguageTranslations {
  home: string;
  results: string;
  practicePairs: string;
  averageByPair: string;
  playAudio: string;
  [key: string]: string; // Allows any string key to be used
}

export const alternateLanguages: Record<string, LanguageTranslations> = {
  日本語: {
    home: 'ホーム',
    results: '結果',
    practicePairs: '練習ペア',
    averageByPair: 'ペア別平均',
    playAudio: 'オーディオを再生',
  },
  中文: {
    home: '首页',
    results: '结果',
    practicePairs: '练习对',
    averageByPair: '每对平均',
    playAudio: '播放音频',
  },
  ภาษาไทย: {
    home: 'หน้าแรก',
    results: 'ผลลัพธ์',
    practicePairs: 'คู่ฝึก',
    averageByPair: 'เฉลี่ยต่อคู่',
    playAudio: 'เล่นเสียง',
  },
  'idioma español': {
    home: 'Inicio',
    results: 'Resultados',
    practicePairs: 'Parejas de práctica',
    averageByPair: 'Promedio por pareja',
    playAudio: 'Reproducir Audio',
  },
  'اللغة العربية': {
    home: 'الرئيسية',
    results: 'النتائج',
    practicePairs: 'أزواج التدريب',
    averageByPair: 'متوسط الزوج',
    playAudio: 'تشغيل الصوت',
  },
  'русский язык': {
    home: 'Главная',
    results: 'Результаты',
    practicePairs: 'Пары для практики',
    averageByPair: 'Среднее по парам',
    playAudio: 'Воспроизвести аудио',
  },
  한국어: {
    home: '홈',
    results: '결과',
    practicePairs: '연습 쌍',
    averageByPair: '쌍별 평균',
    playAudio: '오디오 재생',
  },
  'हिंदी/اردو': {
    home: 'होम/ہوم',
    results: 'परिणाम/نتائج',
    practicePairs: 'अभ्यास जोड़ी/عملی جوڑے',
    averageByPair: 'जोड़ी द्वारा औसत/جوڑے کے حساب سے اوسط',
    playAudio: 'ऑडियो चलाएँ/آڈیو چلائیں',
  },
  Português: {
    home: 'Início',
    results: 'Resultados',
    practicePairs: 'Pares de prática',
    averageByPair: 'Média por par',
    playAudio: 'Reproduzir áudio',
  },
  'Tiếng Việt': {
    home: 'Trang chủ',
    results: 'Kết quả',
    practicePairs: 'Cặp luyện tập',
    averageByPair: 'Trung bình theo cặp',
    playAudio: 'Phát âm thanh',
  },
  Türkçe: {
    home: 'Ana Sayfa',
    results: 'Sonuçlar',
    practicePairs: 'Alıştırma Çiftleri',
    averageByPair: 'Çifte Göre Ortalama',
    playAudio: 'Ses çal',
  },
  'زبان فارسی': {
    home: 'خانه',
    results: 'نتایج',
    practicePairs: 'جفت‌های تمرینی',
    averageByPair: 'میانگین هر جفت',
    playAudio: 'پخش صدا',
  },
  廣東話: {
    home: '首頁',
    results: '結果',
    practicePairs: '練習對',
    averageByPair: '每對平均',
    playAudio: '播放音頻',
  },
  'bahasa Indo': {
    home: 'Beranda',
    results: 'Hasil',
    practicePairs: 'Pasangan Latihan',
    averageByPair: 'Rata-rata per Pasangan',
    playAudio: 'Putar Audio',
  },
};

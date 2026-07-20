type TranslationValues = Record<string, string | number>;

interface FormatTranslationOptions {
  isDevelopment?: boolean;
  onMissingValue?: (placeholder: string) => void;
}

/** Replaces named placeholders in localized UI strings without translating content values. */
export function formatTranslation(
  template: string,
  values: TranslationValues,
  options: FormatTranslationOptions = {}
): string {
  const isDevelopment =
    options.isDevelopment ??
    (typeof __DEV__ !== 'undefined' && __DEV__);

  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    if (key in values) return String(values[key]);

    options.onMissingValue?.(key);
    if (isDevelopment && !options.onMissingValue) {
      console.warn(`Missing translation value for "${key}" in "${template}"`);
    }
    return isDevelopment ? placeholder : '';
  });
}

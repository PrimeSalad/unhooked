/** Mirrors ApplicationInfo.category on Android 8+. Android has no "shopping" category. */
export type AppCategory =
  'social' | 'video' | 'game' | 'audio' | 'image' | 'news' | 'maps' | 'productivity' | 'other';

/** An app with a launcher icon. Read on demand for the picker; never stored or sent anywhere. */
export interface LaunchableApp {
  packageName: string;
  label: string;
  /** PNG, base64 (no data: prefix). Null when icons weren't requested. */
  iconBase64: string | null;
  category: AppCategory;
  /** Phone, SMS or Settings: never guardable. */
  isEssential: boolean;
}

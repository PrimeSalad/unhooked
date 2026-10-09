import { Platform } from 'react-native';

const mockNative = {
  getLaunchableApps: jest.fn(),
  hasUsageAccess: jest.fn(() => true),
  canDrawOverlays: jest.fn(() => true),
  openUsageAccessSettings: jest.fn(),
  openOverlaySettings: jest.fn(),
};
let mockModule: typeof mockNative | null = null;

jest.mock('expo', () => ({
  NativeModule: class {},
  requireOptionalNativeModule: () => mockModule,
}));

function load(): typeof import('../../index') {
  let guard: typeof import('../../index') | undefined;
  jest.isolateModules(() => {
    guard = require('../../index');
  });
  return guard!;
}

describe('unhooked-guard JS wrapper', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
    mockModule = null;
    jest.clearAllMocks();
  });

  it('is a safe no-op when the native module is missing (Expo Go)', async () => {
    Platform.OS = 'android';
    const guard = load();
    expect(guard.isGuardAvailable()).toBe(false);
    await expect(guard.getLaunchableApps()).resolves.toEqual([]);
    expect(guard.hasUsageAccess()).toBe(false);
    expect(guard.canDrawOverlays()).toBe(false);
    expect(() => guard.openUsageAccessSettings()).not.toThrow();
  });

  it('is unavailable on iOS even if a module were present', () => {
    Platform.OS = 'ios';
    mockModule = mockNative;
    const guard = load();
    expect(guard.isGuardAvailable()).toBe(false);
    guard.openOverlaySettings();
    expect(mockNative.openOverlaySettings).not.toHaveBeenCalled();
  });

  it('returns installed apps sorted by label, with icons by default', async () => {
    Platform.OS = 'android';
    mockModule = mockNative;
    mockNative.getLaunchableApps.mockResolvedValue([
      {
        packageName: 'com.zhiliaoapp.musically',
        label: 'TikTok',
        iconBase64: 'x',
        category: 'social',
        isEssential: false,
      },
      {
        packageName: 'com.shopee.ph',
        label: 'Shopee',
        iconBase64: 'y',
        category: 'other',
        isEssential: false,
      },
    ]);
    const guard = load();
    const apps = await guard.getLaunchableApps();
    expect(mockNative.getLaunchableApps).toHaveBeenCalledWith(true);
    expect(apps.map((a) => a.label)).toEqual(['Shopee', 'TikTok']);
    expect(guard.hasUsageAccess()).toBe(true);
  });
});

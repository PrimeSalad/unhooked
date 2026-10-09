import { recommendLocalModel, type AndroidDeviceProfile } from '../localModels';

const device = (overrides: Partial<AndroidDeviceProfile> = {}): AndroidDeviceProfile => ({
  manufacturer: 'Infinix',
  modelName: 'X6856',
  totalMemoryBytes: 8_000_000_000,
  availableMemoryBytes: 4_000_000_000,
  freeStorageBytes: 8_000_000_000,
  runtimeAvailable: true,
  ...overrides,
});

describe('recommendLocalModel', () => {
  it('uses Qwen 2.5 1.5B on a high-end phone', () => {
    expect(recommendLocalModel(device())).toBe('qwen2.5-1.5b');
  });

  it('keeps Gemma 3 1B for tight memory or low battery', () => {
    expect(recommendLocalModel(device({ totalMemoryBytes: 3_000_000_000 }))).toBe('gemma3-1b');
    expect(
      recommendLocalModel(device({ batteryPercent: 12, charging: false })),
    ).toBe('gemma3-1b');
  });

  it('falls back when there is not enough storage for Qwen', () => {
    expect(recommendLocalModel(device({ freeStorageBytes: 500_000_000 }))).toBe('gemma3-1b');
  });
});

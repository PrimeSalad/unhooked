import {
  fitsDevice,
  pickLocalModel,
  planModelDownload,
  recommendLocalModel,
  type AndroidDeviceProfile,
  type LocalModelId,
} from '../localModels';

const set = (...ids: LocalModelId[]) => new Set<LocalModelId>(ids);

describe('pickLocalModel', () => {
  it('auto uses the recommended Gemma 4 E2B when installed', () => {
    expect(pickLocalModel('auto', 'gemma4-e2b', set('gemma4-e2b', 'gemma4-e4b'))).toBe(
      'gemma4-e2b',
    );
  });

  it('returns an explicit installed choice', () => {
    expect(pickLocalModel('gemma4-e4b', 'gemma4-e2b', set('gemma4-e2b', 'gemma4-e4b'))).toBe(
      'gemma4-e4b',
    );
  });

  it('falls back to an installed model when the choice is not installed', () => {
    expect(pickLocalModel('gemma4-e2b', 'gemma4-e2b', set('gemma4-e4b'))).toBe('gemma4-e4b');
  });

  it('returns null when nothing is installed', () => {
    expect(pickLocalModel('auto', 'gemma4-e2b', set())).toBeNull();
  });

  it('treats a choice that left the catalog as auto', () => {
    expect(
      pickLocalModel('qwen2.5-1.5b' as LocalModelId, 'gemma4-e2b', set('gemma4-e2b')),
    ).toBe('gemma4-e2b');
  });

  it('vision picks an installed Gemma model', () => {
    expect(pickLocalModel('auto', 'gemma4-e2b', set('gemma4-e4b'), 'vision')).toBe(
      'gemma4-e4b',
    );
  });

  it('auto keeps the already-loaded model to avoid an engine reload', () => {
    expect(
      pickLocalModel('auto', 'gemma4-e2b', set('gemma4-e2b', 'gemma4-e4b'), 'any', 'gemma4-e4b'),
    ).toBe('gemma4-e4b');
  });

  it('an explicit choice ignores the loaded model', () => {
    expect(
      pickLocalModel(
        'gemma4-e2b',
        'gemma4-e2b',
        set('gemma4-e2b', 'gemma4-e4b'),
        'any',
        'gemma4-e4b',
      ),
    ).toBe('gemma4-e2b');
  });

  it('ignores a loaded model that is not installed', () => {
    expect(pickLocalModel('auto', 'gemma4-e2b', set('gemma4-e2b'), 'any', 'gemma4-e4b')).toBe(
      'gemma4-e2b',
    );
  });
});

describe('planModelDownload', () => {
  it('starts fresh when there is no usable partial file', () => {
    expect(planModelDownload(null, 100)).toEqual({ kind: 'fresh' });
    expect(planModelDownload(undefined, 100)).toEqual({ kind: 'fresh' });
    expect(planModelDownload(0, 100)).toEqual({ kind: 'fresh' });
    expect(planModelDownload(-50, 100)).toEqual({ kind: 'fresh' });
  });

  it('resumes from the partial offset', () => {
    expect(planModelDownload(40, 100)).toEqual({ kind: 'resume', offset: 40 });
  });

  it('resumes a partial one byte short of the total', () => {
    expect(planModelDownload(99, 100)).toEqual({ kind: 'resume', offset: 99 });
  });

  it('treats a partial at or past the total as complete', () => {
    expect(planModelDownload(100, 100)).toEqual({ kind: 'complete' });
    expect(planModelDownload(150, 100)).toEqual({ kind: 'complete' });
  });
});

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
  it('defaults to Gemma 4 E2B on every phone', () => {
    expect(recommendLocalModel(device())).toBe('gemma4-e2b');
    expect(recommendLocalModel(device({ totalMemoryBytes: 3_000_000_000 }))).toBe('gemma4-e2b');
    expect(recommendLocalModel(null)).toBe('gemma4-e2b');
  });
});

describe('fitsDevice', () => {
  it('offers Gemma 4 E4B on high-end phones only', () => {
    expect(fitsDevice('gemma4-e4b', 12_050_000_000)).toBe(true);
    expect(fitsDevice('gemma4-e4b', 7_800_000_000)).toBe(false);
    expect(fitsDevice('gemma4-e2b', 5_600_000_000)).toBe(true);
    expect(fitsDevice('gemma4-e2b', 3_800_000_000)).toBe(false);
    expect(fitsDevice('gemma4-e4b', null)).toBe(true);
  });
});

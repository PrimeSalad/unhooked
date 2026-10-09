import { pickLocalModel, planModelDownload } from '../localModels';
import type { LocalModelId } from '../localModels';

const set = (...ids: LocalModelId[]) => new Set<LocalModelId>(ids);

describe('pickLocalModel', () => {
  it('returns an explicit installed text choice', () => {
    expect(
      pickLocalModel('qwen2.5-1.5b', 'qwen3-0.6b', set('qwen2.5-1.5b'), 'any'),
    ).toBe('qwen2.5-1.5b');
  });

  it('falls back to an installed model for an explicit choice that is not installed', () => {
    expect(pickLocalModel('qwen2.5-1.5b', 'qwen3-0.6b', set('qwen3-0.6b'), 'any')).toBe(
      'qwen3-0.6b',
    );
  });

  it('auto falls back to the largest installed model within the recommended size', () => {
    expect(
      pickLocalModel('auto', 'gemma4-e2b', set('qwen3-0.6b', 'qwen2.5-1.5b'), 'any'),
    ).toBe('qwen2.5-1.5b');
  });

  it('auto falls back to a model larger than recommended when nothing smaller is installed', () => {
    expect(pickLocalModel('auto', 'qwen3-0.6b', set('qwen2.5-1.5b'), 'any')).toBe(
      'qwen2.5-1.5b',
    );
  });

  it('text skips an installed vision model for an explicit vision choice', () => {
    expect(
      pickLocalModel('gemma4-e2b', 'qwen3-0.6b', set('gemma4-e2b', 'qwen3-0.6b'), 'text'),
    ).toBe('qwen3-0.6b');
  });

  it('text returns null when only vision models are installed', () => {
    expect(pickLocalModel('auto', 'qwen3-0.6b', set('gemma4-e2b'), 'text')).toBeNull();
  });

  it('vision picks an installed vision model even when a text model is chosen', () => {
    expect(
      pickLocalModel('qwen3-0.6b', 'qwen3-0.6b', set('qwen3-0.6b', 'gemma4-e2b'), 'vision'),
    ).toBe('gemma4-e2b');
  });

  it('vision returns null when no vision model is installed', () => {
    expect(
      pickLocalModel('auto', 'gemma4-e2b', set('qwen3-0.6b', 'qwen2.5-1.5b'), 'vision'),
    ).toBeNull();
  });

  it('vision prefers the chosen vision model when installed', () => {
    expect(
      pickLocalModel('gemma4-e4b', 'gemma4-e2b', set('gemma4-e2b', 'gemma4-e4b'), 'vision'),
    ).toBe('gemma4-e4b');
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

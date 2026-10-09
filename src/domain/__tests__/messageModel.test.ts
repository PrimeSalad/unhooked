import { classifyMessageLocally } from '../messageModel';

describe('on-device message classifier', () => {
  it('recognizes paraphrased Taglish harassment without a cloud model', () => {
    const result = classifyMessageLocally(
      'Ipapahiya ka sa mga kakilala mo at tatawagan namin employer mo.',
    );
    expect(result.category).toBe('harassment');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('separates a normal payment reminder from coercive messages', () => {
    const result = classifyMessageLocally(
      'Friendly reminder po that your payment is due next Friday. Thank you.',
    );
    expect(result.category).toBe('safe');
  });

  it('returns normalized probabilities for transparent UI', () => {
    const result = classifyMessageLocally('Click this link and enter your password now');
    const total = Object.values(result.probabilities).reduce((sum, n) => sum + n, 0);
    expect(total).toBeCloseTo(1);
    expect(result.modelVersion).toBe('ginto-message-nb-v1');
  });
});

import { describe, expect, it } from 'vitest';
import { GestureStabilizer } from './gestureStabilizer';

describe('GestureStabilizer', () => {
  it('switches after two matching observations spanning exactly 150ms', () => {
    const stabilizer = new GestureStabilizer();
    expect(stabilizer.observe('thumbs-up', 0)).toBe('default');
    expect(stabilizer.observe('thumbs-up', 149)).toBe('default');
    expect(stabilizer.observe('thumbs-up', 150)).toBe('thumbs-up');
  });

  it('requires the same confirmation when moving directly between non-default gestures', () => {
    const stabilizer = new GestureStabilizer();
    stabilizer.observe('thumbs-up', 0);
    stabilizer.observe('thumbs-up', 150);
    expect(stabilizer.observe('silly', 200)).toBe('thumbs-up');
    expect(stabilizer.observe('silly', 350)).toBe('silly');
  });

  it('returns to default after 500ms of uninterrupted default observations', () => {
    const stabilizer = new GestureStabilizer();
    stabilizer.observe('silly', 0);
    stabilizer.observe('silly', 150);
    expect(stabilizer.observe('default', 200)).toBe('silly');
    expect(stabilizer.observe('default', 699)).toBe('silly');
    expect(stabilizer.observe('default', 700)).toBe('default');
  });

  it('cancels a pending default reset when evidence is interrupted', () => {
    const stabilizer = new GestureStabilizer();
    stabilizer.observe('silly', 0);
    stabilizer.observe('silly', 150);
    stabilizer.observe('default', 200);
    expect(stabilizer.observe('silly', 400)).toBe('silly');
    expect(stabilizer.observe('default', 800)).toBe('silly');
  });

  it('restarts the non-default confirmation window when another candidate interrupts it', () => {
    const stabilizer = new GestureStabilizer();
    stabilizer.observe('thumbs-up', 0);
    expect(stabilizer.observe('silly', 100)).toBe('default');
    expect(stabilizer.observe('silly', 249)).toBe('default');
    expect(stabilizer.observe('silly', 250)).toBe('silly');
  });

  it('ignores non-monotonic timestamps and resets deterministically', () => {
    const stabilizer = new GestureStabilizer();
    stabilizer.observe('thumbs-up', 100);
    expect(stabilizer.observe('thumbs-up', 50)).toBe('default');
    expect(stabilizer.reset()).toBe('default');
    expect(stabilizer.value).toBe('default');
  });
});

import { describe, it, expect } from 'vitest';
import { rateLimitHeadroom } from './rateLimitHeadroom';

const config = { maxRequests: 100, windowMs: 60_000 };

describe('rateLimitHeadroom', () => {
  it('does not overlap a user that this instance has not checked', () => {
    const headroom = rateLimitHeadroom(config, { now: () => 0 });

    expect(headroom.canOverlap('u1')).toBe(false);
  });

  it('overlaps while the last count is below half the limit', () => {
    const headroom = rateLimitHeadroom(config, { now: () => 1_000 });

    headroom.record('u1', { count: 49, windowStart: 0 });
    expect(headroom.canOverlap('u1')).toBe(true);
    headroom.record('u1', { count: 50, windowStart: 0 });
    expect(headroom.canOverlap('u1')).toBe(false);
  });

  it('overlaps again when the window of the last count has ended', () => {
    let time = 1_000;
    const headroom = rateLimitHeadroom(config, { now: () => time });

    headroom.record('u1', { count: 80, windowStart: 0 });
    expect(headroom.canOverlap('u1')).toBe(false);
    time = 60_000;
    expect(headroom.canOverlap('u1')).toBe(true);
  });

  it('does not overlap for a full window after a rejection', () => {
    let time = 10_000;
    const headroom = rateLimitHeadroom(config, { now: () => time });

    headroom.record('u1', { count: 1, windowStart: 0 });
    headroom.reject('u1');
    time = 69_999;
    expect(headroom.canOverlap('u1')).toBe(false);
    time = 70_000;
    expect(headroom.canOverlap('u1')).toBe(true);
  });

  it('keeps the users apart', () => {
    const headroom = rateLimitHeadroom(config, { now: () => 0 });

    headroom.record('u1', { count: 1, windowStart: 0 });
    expect(headroom.canOverlap('u2')).toBe(false);
  });

  it('forgets every user when it holds too many', () => {
    const headroom = rateLimitHeadroom(config, { now: () => 0, maxUsers: 2 });

    headroom.record('u1', { count: 1, windowStart: 0 });
    headroom.record('u2', { count: 1, windowStart: 0 });
    headroom.record('u3', { count: 1, windowStart: 0 });
    expect(headroom.canOverlap('u1')).toBe(false);
    expect(headroom.canOverlap('u3')).toBe(true);
  });
});

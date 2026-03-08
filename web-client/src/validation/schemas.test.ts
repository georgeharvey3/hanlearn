import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  registerPasswordSchema,
  usernameSchema,
  amendedMeaningSchema,
  searchInputSchema,
  customWordTextSchema,
  customWordMeaningSchema,
} from './schemas';

describe('emailSchema', () => {
  it('accepts valid emails', () => {
    expect(emailSchema.safeParse('user@example.com').success).toBe(true);
    expect(emailSchema.safeParse('a@b.co').success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = emailSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(emailSchema.safeParse('missing@').success).toBe(false);
    expect(emailSchema.safeParse('@missing.com').success).toBe(false);
  });

  it('rejects emails exceeding 254 chars', () => {
    const longEmail = 'a'.repeat(245) + '@' + 'b'.repeat(5) + '.com';
    expect(longEmail.length).toBeGreaterThan(254);
    expect(emailSchema.safeParse(longEmail).success).toBe(false);
  });

  it('trims whitespace', () => {
    const result = emailSchema.safeParse('  user@example.com  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('user@example.com');
    }
  });
});

describe('passwordSchema', () => {
  it('accepts non-empty passwords', () => {
    expect(passwordSchema.safeParse('a').success).toBe(true);
    expect(passwordSchema.safeParse('password123').success).toBe(true);
  });

  it('rejects empty string', () => {
    const result = passwordSchema.safeParse('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Password is required');
    }
  });

  it('rejects passwords exceeding 128 chars', () => {
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });
});

describe('registerPasswordSchema', () => {
  it('requires minimum 6 characters', () => {
    expect(registerPasswordSchema.safeParse('12345').success).toBe(false);
    expect(registerPasswordSchema.safeParse('123456').success).toBe(true);
  });

  it('rejects passwords exceeding 128 chars', () => {
    expect(registerPasswordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });

  it('returns correct error message for short passwords', () => {
    const result = registerPasswordSchema.safeParse('abc');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Password must be at least 6 characters');
    }
  });
});

describe('usernameSchema', () => {
  it('accepts valid usernames', () => {
    const result = usernameSchema.safeParse('john');
    expect(result.success).toBe(true);
  });

  it('trims whitespace', () => {
    const result = usernameSchema.safeParse('  john  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('john');
    }
  });

  it('rejects empty or whitespace-only', () => {
    expect(usernameSchema.safeParse('').success).toBe(false);
    expect(usernameSchema.safeParse('   ').success).toBe(false);
  });

  it('rejects usernames exceeding 50 chars', () => {
    expect(usernameSchema.safeParse('a'.repeat(51)).success).toBe(false);
  });

  it('strips control characters', () => {
    const result = usernameSchema.safeParse('john\x00doe');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('johndoe');
    }
  });
});

describe('amendedMeaningSchema', () => {
  it('accepts valid meanings', () => {
    expect(amendedMeaningSchema.safeParse('hello').success).toBe(true);
  });

  it('accepts empty string (meaning can be cleared)', () => {
    const result = amendedMeaningSchema.safeParse('');
    expect(result.success).toBe(true);
  });

  it('trims whitespace', () => {
    const result = amendedMeaningSchema.safeParse('  hello  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('hello');
    }
  });

  it('rejects meanings exceeding 500 chars', () => {
    expect(amendedMeaningSchema.safeParse('a'.repeat(501)).success).toBe(false);
  });

  it('strips control characters', () => {
    const result = amendedMeaningSchema.safeParse('to run\x07quickly');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('to runquickly');
    }
  });

  it('preserves normal whitespace characters', () => {
    const result = amendedMeaningSchema.safeParse('to run\nquickly');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('to run\nquickly');
    }
  });
});

describe('searchInputSchema', () => {
  it('accepts valid search input', () => {
    expect(searchInputSchema.safeParse('你好').success).toBe(true);
  });

  it('trims whitespace', () => {
    const result = searchInputSchema.safeParse('  你好  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('你好');
    }
  });

  it('rejects input exceeding 100 chars', () => {
    expect(searchInputSchema.safeParse('a'.repeat(101)).success).toBe(false);
  });

  it('strips control characters', () => {
    const result = searchInputSchema.safeParse('你\x00好');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('你好');
    }
  });
});

describe('customWordTextSchema', () => {
  it('accepts valid Chinese text', () => {
    expect(customWordTextSchema.safeParse('你好').success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(customWordTextSchema.safeParse('').success).toBe(false);
  });

  it('rejects text exceeding 50 chars', () => {
    expect(customWordTextSchema.safeParse('字'.repeat(51)).success).toBe(false);
  });
});

describe('customWordMeaningSchema', () => {
  it('accepts valid meanings', () => {
    expect(customWordMeaningSchema.safeParse('hello').success).toBe(true);
  });

  it('rejects empty string', () => {
    expect(customWordMeaningSchema.safeParse('').success).toBe(false);
  });

  it('rejects meanings exceeding 500 chars', () => {
    expect(customWordMeaningSchema.safeParse('a'.repeat(501)).success).toBe(false);
  });
});

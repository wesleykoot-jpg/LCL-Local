import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateConfig } from '../cli';

const envBackup = { ...process.env };

describe('cli validateConfig', () => {
  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it('allows dry run without Supabase credentials', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = validateConfig(true);

    expect(result).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('requires Supabase credentials when not in dry run', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_KEY;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = validateConfig(false);

    expect(result).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });
});

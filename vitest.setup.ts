import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Provide a global fetch stub if not present
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = vi.fn() as unknown as typeof fetch;
}

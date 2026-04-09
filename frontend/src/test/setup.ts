import '@testing-library/jest-dom'

// Recharts uses ResizeObserver — polyfill for jsdom
;(globalThis as unknown as Record<string, unknown>).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

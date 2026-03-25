import { formatUptime } from './system.js'

describe('formatUptime', () => {
  it('should format seconds-only as 0m', () => {
    expect(formatUptime(45)).toBe('0m')
  })

  it('should format minutes only', () => {
    expect(formatUptime(300)).toBe('5m')
  })

  it('should format hours and minutes', () => {
    expect(formatUptime(3660)).toBe('1h 1m')
  })

  it('should format days, hours, and minutes', () => {
    expect(formatUptime(90060)).toBe('1d 1h 1m')
  })

  it('should omit zero hours when only days and minutes', () => {
    expect(formatUptime(86700)).toBe('1d 5m')
  })

  it('should handle exactly one day', () => {
    expect(formatUptime(86400)).toBe('1d 0m')
  })

  it('should handle multi-day uptimes', () => {
    expect(formatUptime(259200)).toBe('3d 0m')
  })
})

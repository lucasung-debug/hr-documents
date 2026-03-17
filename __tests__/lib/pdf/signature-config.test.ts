import { getSignaturePositionConfig } from '@/lib/pdf/signature-config'

// A4 page size in points
const A4_WIDTH = 595.28
const A4_HEIGHT = 841.89

describe('getSignaturePositionConfig', () => {
  it('loads config successfully with all required keys', () => {
    const config = getSignaturePositionConfig()

    const requiredKeys = [
      'labor_contract',
      'labor_contract_monthly',
      'labor_contract_daily',
      'personal_info_consent',
      'holiday_extension',
      'data_security_pledge',
      'compliance',
      'overtime_work',
    ]

    for (const key of requiredKeys) {
      expect(config[key as keyof typeof config]).toBeDefined()
    }
  })

  it('all positions have positive coordinates and sizes', () => {
    const config = getSignaturePositionConfig()

    for (const [key, value] of Object.entries(config)) {
      if (key.startsWith('_')) continue // skip comments

      const positions = Array.isArray(value) ? value : [value]
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i]
        expect(pos.page).toBeGreaterThanOrEqual(0)
        expect(pos.x).toBeGreaterThanOrEqual(0)
        expect(pos.y).toBeGreaterThanOrEqual(0)
        expect(pos.width).toBeGreaterThan(0)
        expect(pos.height).toBeGreaterThan(0)
      }
    }
  })

  it('all positions are within A4 page bounds (with 10% tolerance)', () => {
    const config = getSignaturePositionConfig()
    const maxX = A4_WIDTH * 1.1
    const maxY = A4_HEIGHT * 1.1

    for (const [key, value] of Object.entries(config)) {
      if (key.startsWith('_')) continue

      const positions = Array.isArray(value) ? value : [value]
      for (const pos of positions) {
        expect(pos.x + pos.width).toBeLessThanOrEqual(maxX)
        expect(pos.y + pos.height).toBeLessThanOrEqual(maxY)
      }
    }
  })

  it('labor_contract variants have array positions', () => {
    const config = getSignaturePositionConfig()

    expect(Array.isArray(config.labor_contract)).toBe(true)
    expect(Array.isArray(config.labor_contract_monthly)).toBe(true)
    expect(Array.isArray(config.labor_contract_daily)).toBe(true)

    // Monthly has 4 signature positions (1 on page 0, 3 on page 1)
    const monthly = config.labor_contract_monthly
    if (Array.isArray(monthly)) {
      expect(monthly.length).toBeGreaterThanOrEqual(3)
    }

    // Daily has 3 signature positions
    const daily = config.labor_contract_daily
    if (Array.isArray(daily)) {
      expect(daily.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('single-page documents have single position objects', () => {
    const config = getSignaturePositionConfig()

    const singlePageDocs = ['holiday_extension', 'data_security_pledge', 'overtime_work'] as const
    for (const key of singlePageDocs) {
      const pos = config[key]
      expect(Array.isArray(pos)).toBe(false)
      if (!Array.isArray(pos)) {
        expect(pos.page).toBe(0)
      }
    }
  })
})

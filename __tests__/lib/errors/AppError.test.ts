import { AppError } from '@/lib/errors/AppError'
import { ERROR_CODES } from '@/lib/errors/codes'

describe('AppError', () => {
  it('should store code, message, and statusCode from constructor arguments', () => {
    const error = new AppError(ERROR_CODES.AUTH_001, 'Unauthorized', 401)

    expect(error.code).toBe(ERROR_CODES.AUTH_001)
    expect(error.message).toBe('Unauthorized')
    expect(error.statusCode).toBe(401)
  })

  it('should default statusCode to 500 when not provided', () => {
    const error = new AppError(ERROR_CODES.SERVER_001, 'Internal Server Error')

    expect(error.statusCode).toBe(500)
  })

  it('should be an instance of both Error and AppError', () => {
    const error = new AppError(ERROR_CODES.VAL_001, 'Validation failed', 400)

    expect(error instanceof Error).toBe(true)
    expect(error instanceof AppError).toBe(true)
  })
})

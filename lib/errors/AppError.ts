import { ErrorCode } from './codes'

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message)
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = 'AppError'
  }
}

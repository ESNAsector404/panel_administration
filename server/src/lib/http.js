/** Erreur applicative avec code HTTP — interceptée par le middleware d'erreur. */
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code ?? null
  }
}

/** Wrap un handler async pour router ses rejets vers next(err). */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

/** An error that is safe to show to the user, carried to the client with both languages. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly zh: string,
    readonly en: string,
  ) {
    super(en)
  }
}

export const errors = {
  badRequest: () => new ApiError(400, 'bad_request', '请求格式不正确', 'Malformed request'),
  forbidden: () => new ApiError(403, 'forbidden', '请求来源不被允许', 'Request origin not allowed'),
  unauthorized: () => new ApiError(401, 'unauthorized', '请先登录', 'Please log in first'),
  invalidEmail: () => new ApiError(400, 'invalid_email', '请输入有效的邮箱地址', 'Please enter a valid email address'),
  weakPassword: () =>
    new ApiError(400, 'weak_password', '密码需为 8–64 位，且同时包含字母和数字', 'Password must be 8–64 characters with letters and digits'),
  emailTaken: () => new ApiError(409, 'email_taken', '该邮箱已注册，请直接登录', 'This email is already registered. Please log in.'),
  invalidCredentials: () => new ApiError(401, 'invalid_credentials', '邮箱或密码错误', 'Incorrect email or password'),
  accountLocked: () =>
    new ApiError(429, 'account_locked', '密码错误次数过多，请 15 分钟后再试', 'Too many failed attempts. Try again in 15 minutes.'),
  invalidOrder: (zh: string, en: string) => new ApiError(400, 'invalid_order', zh, en),
  insufficientBalance: () => new ApiError(400, 'insufficient_balance', '可用余额不足', 'Insufficient available balance'),
  priceUnavailable: () =>
    new ApiError(503, 'price_unavailable', '行情暂不可用，请稍后再试', 'Market price unavailable. Please try again shortly.'),
  orderNotFound: () => new ApiError(404, 'order_not_found', '委托不存在', 'Order not found'),
  orderNotOpen: () => new ApiError(409, 'order_not_open', '该委托已成交或已撤销', 'This order is already filled or canceled'),
  internal: () => new ApiError(500, 'internal_error', '服务暂时不可用，请稍后再试', 'Something went wrong. Please try again later.'),
}

/** True when a database error (possibly wrapped by Drizzle) is a unique-constraint violation. */
export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current === 'object' && 'code' in current && (current as { code?: unknown }).code === '23505') return true
    current = typeof current === 'object' && 'cause' in current ? (current as { cause?: unknown }).cause : undefined
  }
  return false
}

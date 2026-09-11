/** Browser-safe names shared with the server; no crypto or session implementation imports. */
export const accessTokenCookieName = 'jingwei_access'
export const refreshTokenCookieName = 'jingwei_refresh'
export const refreshTokenCookiePath = '/api/v1/iam/sessions/refresh'
export const csrfCookieName = 'jingwei_csrf'
export const csrfHeaderName = 'x-csrf-token'

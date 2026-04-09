export interface TelephonyTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
}

export interface TelephonyAccountInfo {
  id: string
  email: string
  name: string
  rawData: unknown
}

export interface TelephonyProvider {
  readonly id: string
  readonly name: string
  getAuthorizationUrl(state: string, redirectUri: string): string
  exchangeCode(code: string, redirectUri: string): Promise<TelephonyTokens>
  refreshTokens(refreshToken: string): Promise<TelephonyTokens>
  getUserInfo(accessToken: string): Promise<TelephonyAccountInfo>
}

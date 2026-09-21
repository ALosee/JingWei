export interface OperatorTable {
  id: string
  login: string
  login_normalized: string
  display_name: string
  status: 'ACTIVE' | 'DISABLED'
  last_login_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface OperatorCredentialTable {
  operator_id: string
  password_hash: string
  failed_attempts: number
  locked_until: Date | null
  password_changed_at: Date
  created_at: Date
  updated_at: Date
}

export interface OperatorSessionTable {
  id: string
  operator_id: string
  access_token_hash: string
  access_expires_at: Date
  csrf_token_hash: string
  created_at: Date
  last_seen_at: Date
  idle_expires_at: Date
  absolute_expires_at: Date
  revoked_at: Date | null
  revocation_reason: string | null
  user_agent: string | null
  ip_address: string | null
}

export interface OperatorRefreshTokenTable {
  token_hash: string
  session_id: string
  generation: number
  issued_at: Date
  expires_at: Date
  consumed_at: Date | null
}

export interface ControlPlaneDatabase {
  'control_plane.operator': OperatorTable
  'control_plane.operator_credential': OperatorCredentialTable
  'control_plane.operator_session': OperatorSessionTable
  'control_plane.operator_refresh_token': OperatorRefreshTokenTable
}

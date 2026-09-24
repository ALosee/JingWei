import { saveBrandDraftSchema, type SaveBrandDraft } from '../../shared/index.js'

export type BrandFieldErrors = Partial<Record<keyof SaveBrandDraft, string>>

const FIELD_LABELS: Record<string, string> = {
  systemName: '系统全称',
  shortName: '系统简称',
  loginTitle: '登录页标题',
  loginTagline: '登录页说明',
  titleMode: '浏览器标题格式',
  horizontalBrandMode: '横向品牌显示',
  logoColorMode: '自定义 Logo 颜色',
  logoAssetId: '横向 Logo',
  markAssetId: '方形标志',
  faviconAssetId: 'Favicon',
  visualTheme: '品牌视觉',
  workspaceDefaults: '工作区默认布局',
  expectedEditRevision: '编辑修订',
}

function describeIssue(path: string, message: string): string {
  const label = FIELD_LABELS[path]
  if (label === undefined) return message
  if (/too small|at least|>=\s*1|min\b/i.test(message)) return `${label}不能为空`
  if (/too big|at most|max\b/i.test(message)) return `${label}超出长度限制`
  if (/uuid|invalid/i.test(message)) return `${label}格式无效`
  if (/required/i.test(message)) return `请填写${label}`
  return `${label}：${message}`
}

export function parseBrandFieldIssues(error: unknown): BrandFieldErrors {
  const issues =
    typeof error === 'object' && error !== null && 'issues' in error
      ? (error as { issues: readonly { path: PropertyKey[]; message: string }[] }).issues
      : []
  const next: BrandFieldErrors = {}
  for (const issue of issues) {
    const path = issue.path.join('.')
    if (path === '') continue
    next[path as keyof SaveBrandDraft] = describeIssue(path, issue.message)
  }
  return next
}

export function mapServerBrandFieldIssues(details: unknown): BrandFieldErrors {
  if (typeof details !== 'object' || details === null) return {}
  const issues =
    'issues' in details && Array.isArray((details as { issues?: unknown }).issues)
      ? (details as { issues: unknown[] }).issues
      : []
  const next: BrandFieldErrors = {}
  for (const issue of issues) {
    if (typeof issue !== 'object' || issue === null) continue
    const path = 'path' in issue ? String(issue.path) : ''
    const message = 'message' in issue ? String(issue.message) : ''
    if (path === '' || path === 'expectedEditRevision') continue
    next[path as keyof SaveBrandDraft] = describeIssue(path, message)
  }
  return next
}

/** Client-side gate so empty required fields never hit the API as a generic 400. */
export function validateSaveBrandDraft(
  input: SaveBrandDraft,
): { ok: true; data: SaveBrandDraft } | { ok: false; errors: BrandFieldErrors } {
  const parsed = saveBrandDraftSchema.safeParse(input)
  if (parsed.success) return { ok: true, data: parsed.data }
  return { ok: false, errors: parseBrandFieldIssues(parsed.error) }
}

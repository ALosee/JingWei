import { APPEARANCE_MODE_STORAGE_KEY, defaultAppearancePreferences } from '../stores/appearance.js'

/** Apply only the user's color-scheme hint before first paint; tenant palettes stay server-owned. */
export function createAppearanceModeInitScript(): string {
  const key = JSON.stringify(APPEARANCE_MODE_STORAGE_KEY)
  const defaultMode = JSON.stringify(defaultAppearancePreferences.mode)
  return `(()=>{try{const p=location.pathname;if(p==='/platform'||p.startsWith('/platform/')){document.documentElement.classList.remove('dark');return}const s=localStorage.getItem(${key});const m=s==='light'||s==='dark'?s:${defaultMode};const d=m==='dark'||(m==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch{}})()`
}

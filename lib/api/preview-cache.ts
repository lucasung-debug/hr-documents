/**
 * Client-side cache for PDF preview data URLs.
 * Prevents re-fetching previews when navigating back to the preview page.
 * Only used in browser (client components).
 */

interface CachedPreview {
  previewUrl: string
  previewType: 'png' | 'pdf'
  cachedAt: number
}

const PREVIEW_TTL_MS = 10 * 60 * 1000 // 10 minutes

const store = new Map<string, CachedPreview>()

export function getCachedPreview(documentKey: string): CachedPreview | null {
  const entry = store.get(documentKey)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > PREVIEW_TTL_MS) {
    store.delete(documentKey)
    return null
  }
  return entry
}

export function setCachedPreview(
  documentKey: string,
  previewUrl: string,
  previewType: 'png' | 'pdf'
): void {
  store.set(documentKey, { previewUrl, previewType, cachedAt: Date.now() })
}

'use client'

import type { DocumentListItem } from '@/types/document'
import { DocumentCard } from './DocumentCard'

interface DocumentListProps {
  docs: DocumentListItem[]
  onConsent: (key: string) => Promise<void>
}

export function DocumentList({ docs, onConsent }: DocumentListProps) {
  const completedCount = docs.filter((d) => d.status !== 'pending').length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">입사 서류 목록</h2>
        <span className="text-sm text-gray-500">
          {completedCount} / {docs.length} 완료
        </span>
      </div>
      {docs.map((doc) => (
        <DocumentCard key={doc.key} doc={doc} onConsent={onConsent} />
      ))}
    </div>
  )
}

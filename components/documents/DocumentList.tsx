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
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[20px] font-semibold text-apple-gray-900 tracking-[-0.01em]">입사 서류 목록</h2>
        <span className="text-sm text-apple-gray-500">
          {completedCount} / {docs.length} 완료
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        {docs.map((doc) => (
          <DocumentCard key={doc.key} doc={doc} onConsent={onConsent} />
        ))}
      </div>
    </div>
  )
}

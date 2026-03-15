'use client'

import { useEffect, useState } from 'react'
import type { OnboardingMaterial } from '@/types/api'

export function MaterialsSection() {
  const [materials, setMaterials] = useState<OnboardingMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await fetch('/api/employee/materials')
        if (!res.ok) throw new Error('자료 조회 실패')
        const data = await res.json()
        setMaterials(data.materials ?? [])
      } catch {
        setError('온보딩 자료를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    fetchMaterials()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apple-blue" />
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 bg-red-50 rounded-apple px-4 py-3">
        {error}
      </p>
    )
  }

  if (materials.length === 0) {
    return (
      <div className="bg-apple-gray-50 border border-apple-gray-100 rounded-apple-lg p-8 text-center">
        <svg className="w-12 h-12 mx-auto text-apple-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm text-apple-gray-500 font-medium">
          입사 안내자료가 준비 중입니다.
        </p>
        <p className="text-xs text-apple-gray-400 mt-1">
          자료가 등록되면 이곳에서 확인하실 수 있습니다.
        </p>
      </div>
    )
  }

  // Group by category
  const grouped = materials.reduce<Record<string, OnboardingMaterial[]>>(
    (acc, m) => {
      const cat = m.category || '기타'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(m)
      return acc
    },
    {}
  )

  return (
    <div className="flex flex-col gap-5">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-apple-gray-700 mb-3">
            {category}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {items.map((m) => (
              <a
                key={m.material_id}
                href={m.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 bg-white border border-apple-gray-100 rounded-apple-lg p-4 shadow-apple-sm hover:border-apple-blue/30 hover:shadow-md transition-all"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-apple bg-apple-blue-light flex items-center justify-center">
                  <svg className="w-5 h-5 text-apple-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-apple-gray-900 truncate">
                    {m.title}
                  </p>
                  {m.description && (
                    <p className="text-[12px] text-apple-gray-500 mt-0.5 line-clamp-1">
                      {m.description}
                    </p>
                  )}
                </div>
                <svg className="w-4 h-4 text-apple-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface SessionContextValue {
  employeeName: string | null
  setEmployeeName: (name: string) => void
  signHash: string | null
  setSignHash: (hash: string) => void
  resetTimer: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

const SESSION_TIMEOUT_MS = 28 * 60 * 1000 // warn at 28 min, expire at 30 min

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [employeeName, setEmployeeName] = useState<string | null>(null)
  const [signHash, setSignHash] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      alert('세션이 만료되었습니다. 다시 로그인해주세요.')
      router.push('/login')
    }, SESSION_TIMEOUT_MS)
  }

  useEffect(() => {
    resetTimer()
    const events = ['mousemove', 'keydown', 'touchstart', 'click']
    events.forEach((e) => window.addEventListener(e, resetTimer))
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach((e) => window.removeEventListener(e, resetTimer))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SessionContext.Provider
      value={{ employeeName, setEmployeeName, signHash, setSignHash, resetTimer }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}

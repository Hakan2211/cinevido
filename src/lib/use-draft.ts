/**
 * useState that survives leaving the page: the labs keep their prompt and
 * settings when the user goes elsewhere and comes back.
 *
 * Values live in memory for client-side navigation and in sessionStorage for
 * a reload (per tab). The server and the first client render always use the
 * initial value, so hydration matches; a value from sessionStorage is put
 * back right after mount.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

const PREFIX = 'cinevido:draft:'
const memory = new Map<string, unknown>()

function store(key: string, value: unknown) {
  memory.set(key, value)
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // storage full or blocked: memory still has it
  }
}

export function useDraft<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() =>
    typeof window !== 'undefined' && memory.has(key)
      ? (memory.get(key) as T)
      : initial,
  )

  // After a reload: memory is empty, sessionStorage may have it
  const checked = useRef(memory.has(key))
  useEffect(() => {
    if (checked.current) return
    checked.current = true
    try {
      const raw = sessionStorage.getItem(PREFIX + key)
      if (raw !== null) {
        const restored = JSON.parse(raw) as T
        memory.set(key, restored)
        setValue(restored)
      }
    } catch {
      // unreadable: keep the initial value
    }
  }, [key])

  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (action) =>
      setValue((prev) => {
        const next =
          typeof action === 'function' ? (action as (p: T) => T)(prev) : action
        store(key, next)
        return next
      }),
    [key],
  )

  return [value, set]
}

/** Forget every draft (on sign-out) */
export function clearDrafts() {
  memory.clear()
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(PREFIX)) sessionStorage.removeItem(k)
    }
  } catch {
    // nothing to clear
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'

export function useSpeechSynthesis() {
  const [supported, setSupported] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSupported(true)
      const loadVoices = () => setVoices(window.speechSynthesis.getVoices())
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
  }, [])

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
    utterRef.current = null
  }, [supported])

  const speak = useCallback(
    (text: string, options?: { voice?: SpeechSynthesisVoice; rate?: number; pitch?: number }) => {
      if (!supported || !text) return
      stop()
      const utter = new SpeechSynthesisUtterance(text)
      if (options?.voice) utter.voice = options.voice
      if (options?.rate) utter.rate = options.rate
      if (options?.pitch) utter.pitch = options.pitch
      utter.onend = () => setSpeaking(false)
      utter.onerror = () => setSpeaking(false)
      utterRef.current = utter
      window.speechSynthesis.speak(utter)
      setSpeaking(true)
    },
    [supported, stop],
  )

  const pause = useCallback(() => {
    if (!supported) return
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause()
    }
  }, [supported])

  const resume = useCallback(() => {
    if (!supported) return
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
    }
  }, [supported])

  return { supported, speaking, voices, speak, pause, resume, stop }
}



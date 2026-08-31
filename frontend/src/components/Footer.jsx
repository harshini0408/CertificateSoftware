import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

export default function Footer() {
    const year = new Date().getFullYear()
    const navigate = useNavigate()

    const hoverTimeout = useRef(null)
    const textRef = useRef(null)
    const isTouch = useRef(false)
    const tappedOnce = useRef(false)

    const [isActive, setIsActive] = useState(false)

    useEffect(() => {
        isTouch.current = window.matchMedia('(pointer: coarse)').matches
        return () => clearTimeout(hoverTimeout.current)
    }, [])

    const activate = () => {
        clearTimeout(hoverTimeout.current)
        setIsActive(true)

        hoverTimeout.current = setTimeout(() => {
            window.scrollTo(0, 0)
            navigate('/authors')
            setIsActive(false)
            tappedOnce.current = false
        }, 1400)
    }

    const deactivate = () => {
        setIsActive(false)
        clearTimeout(hoverTimeout.current)
        tappedOnce.current = false
        resetMagnet()
    }

    const handleMagnetMove = (e) => {
        if (isTouch.current || !textRef.current) return

        const rect = textRef.current.getBoundingClientRect()
        const x = e.clientX - (rect.left + rect.width / 2)
        const y = e.clientY - (rect.top + rect.height / 2)

        textRef.current.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`
    }

    const resetMagnet = () => {
        if (textRef.current) {
            textRef.current.style.transform = 'translate(0px, 0px)'
        }
    }

    return (
        <>
            {/* Spacer keeps content from being hidden behind fixed footer */}
            <div className="h-[72px] shrink-0" />

            <footer
                className="fixed inset-x-0 bottom-0 z-40 py-2"
                style={{
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    borderTop: '1px solid #e2e8f0',
                }}
            >
            <style>{`
        .sdc-hover-zone {
          position: relative;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
          transition: transform 0.25s ease;
        }

        .sdc-hover-zone svg {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .sdc-outline {
          stroke: #0f172a;
          stroke-width: 1.7;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          vector-effect: non-scaling-stroke;
          stroke-dasharray: 520;
          stroke-dashoffset: 520;
          animation: sdc-draw 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          filter: url(#roughen);
        }

        @keyframes sdc-draw {
          to {
            stroke-dashoffset: 0;
          }
        }

        .footer-bottom-only {
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>

                <div className="container mx-auto px-4">
                  <div className="footer-bottom-only flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-gray-500">
                    <span>© {year}. 2026 PSG Institute of Technology and Applied Research. All rights reserved.</span>
                    <span className="hidden sm:inline text-gray-300 font-light">•</span>

                    <button
                        ref={textRef}
                        type="button"
                        className={`sdc-hover-zone ${isActive ? 'active' : ''}`}
                        onPointerEnter={() => !isTouch.current && activate()}
                        onPointerLeave={() => !isTouch.current && deactivate()}
                        onPointerMove={handleMagnetMove}
                        onClick={() => {
                            if (isTouch.current) {
                                if (!tappedOnce.current) {
                                    tappedOnce.current = true
                                    activate()
                                } else {
                                    navigate('/authors')
                                }
                                return
                            }
                            navigate('/authors')
                        }}
                        style={{
                            fontSize: '0.8rem',
                            letterSpacing: '0.04em',
                            fontWeight: 600,
                            position: 'relative',
                            background: 'transparent',
                            border: 'none',
                            color: '#1E3A5F',
                            padding: '2px 8px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                        }}
                        title="Meet the team behind the software"
                    >
                        <span>Meet the Minds Behind the Software</span>
                        <span className="text-navy/70 text-xs transition-transform group-hover:translate-x-0.5">→</span>

                        {isActive && (
                            <svg viewBox="0 0 320 40" width="330" height="46">
                                <defs>
                                    <filter id="roughen">
                                        <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="1" />
                                        <feDisplacementMap in="SourceGraphic" scale="0.45" />
                                    </filter>
                                </defs>

                                <path
                                    d="
                                      M 10 20
                                      C 20 5, 300 5, 310 20
                                      C 318 34, 300 38, 160 38
                                      C 20 38, 2 34, 10 20
                                      Z
                                    "
                                    className="sdc-outline"
                                />
                            </svg>
                        )}
                    </button>
                  </div>
                </div>
            </footer>
        </>
    )
}

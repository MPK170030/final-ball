'use client'

import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[global-error]', error.digest ?? error.message)
  }, [error])

  return (
    <html lang="en" className="dark">
      <body style={{ margin: 0, background: '#181818', color: '#F7F7F7', fontFamily: 'system-ui, sans-serif' }}>
        <main
          style={{
            display: 'flex',
            minHeight: '100dvh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '24rem', width: '100%' }}>
            <h1 style={{ fontSize: '26px', fontWeight: 600, marginBottom: '8px' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: '15px', color: '#A3A3A3', marginBottom: '24px' }}>
              A critical error occurred. Try reloading the page.
            </p>
            {error.digest && (
              <p style={{ fontSize: '13px', color: '#A3A3A3', fontFamily: 'monospace', marginBottom: '16px' }}>
                Ref: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                background: '#FF8A1F',
                color: '#181818',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 24px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}

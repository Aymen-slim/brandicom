'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home, LogIn } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service or console
    console.error('[AppError] Caught render error:', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: '#f8f9fa',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
      }}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '480px',
          width: '100%',
          padding: '36px 32px',
          borderRadius: '16px',
          backgroundColor: '#ffffff',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e5e7eb',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px',
          }}
        >
          <AlertTriangle size={26} />
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', marginBottom: '8px' }}>
          Something went wrong
        </h2>

        <p style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.5, marginBottom: '20px' }}>
          We encountered a temporary rendering or session issue. This can happen if your authentication session expired or refreshed.
        </p>

        {error.digest && (
          <div
            style={{
              padding: '6px 10px',
              backgroundColor: '#f3f4f6',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#4b5563',
              fontFamily: 'var(--font-mono, monospace)',
              marginBottom: '20px',
              display: 'inline-block',
            }}
          >
            Error ID: {error.digest}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => reset()}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '10px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <RefreshCw size={15} />
            Try again
          </button>

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <Link
              href="/dashboard"
              className="btn btn-secondary"
              style={{
                flex: 1,
                padding: '9px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '12.5px',
                textDecoration: 'none',
              }}
            >
              <Home size={14} />
              Dashboard
            </Link>

            <Link
              href="/login"
              className="btn btn-secondary"
              style={{
                flex: 1,
                padding: '9px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '12.5px',
                textDecoration: 'none',
              }}
            >
              <LogIn size={14} />
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

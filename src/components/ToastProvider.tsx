import React from 'react';
import { Toaster } from 'react-hot-toast';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#18181B',
            color: '#fff',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '14px',
            fontWeight: '600',
            maxWidth: '90vw',
          },
          success: {
            iconTheme: {
              primary: '#B4FF39',
              secondary: '#18181B',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#18181B',
            },
          },
        }}
      />
    </>
  );
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import '@/styles/globals.css'
import { App } from './App'
import { queryClient } from '@/lib/query-client'
import { registerDefaultConnectors } from '@/lib/integrations'

// Wire the own-store source connectors (the system of record for this release).
registerDefaultConnectors()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
)

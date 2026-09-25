import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import '@/styles/globals.css'
import { App } from './App'
import { queryClient } from '@/lib/query-client'
import { registerDefaultConnectors } from '@/lib/integrations'
import { usePolicyConfigStore } from '@/stores/policy-config-store'

// Wire the own-store source connectors (the system of record for this release).
registerDefaultConnectors()

// Apply any admin-saved decisioning-threshold overrides to the active policy
// config before the first determination runs (rehydrates from localStorage).
usePolicyConfigStore.getState().hydrateFromServer();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* Bottom-left: its default corner is where the assistant's button sits,
          and in dev the logo covered it and took its clicks. */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />}
    </QueryClientProvider>
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from './wagmi'
import App from './App.tsx'
import './index.css'

// react-query: wagmi가 읽어 온 값(잔고, 거래 목록 등)을 캐시하고, 필요할 때 다시 읽어 오는 역할
const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 앱 전체에서 wagmi 훅(useAccount, useReadContract 등)을 쓸 수 있게 감싸 준다 */}
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)

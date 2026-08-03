import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BoardStateProvider } from './app/state/BoardStateContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BoardStateProvider>
      <App />
    </BoardStateProvider>
  </StrictMode>,
)

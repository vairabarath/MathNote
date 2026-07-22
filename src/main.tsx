import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { WarpSpike } from './spike/WarpSpike'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WarpSpike />
  </StrictMode>,
)

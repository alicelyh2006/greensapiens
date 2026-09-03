import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LampUpload from './LampUpload.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LampUpload />
  </StrictMode>
)

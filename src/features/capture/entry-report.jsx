import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ReportForm from './ReportForm.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ReportForm />
  </StrictMode>
)

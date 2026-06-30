import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import './services/JobService'
import './services/DocumentService'
import './services/AIService'
import './services/RecruiterService'
import './services/AutomationService'
import './services/AnalyticsService'
import './services/EmailCalendarService'
import App from './App.tsx'

registerSW({
  immediate: true,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

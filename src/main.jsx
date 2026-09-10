import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css';
import './i18n'; // Import i18n configuration
import App from './App.jsx'
import './lib/api'; // Initialize window.api for Supabase



createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

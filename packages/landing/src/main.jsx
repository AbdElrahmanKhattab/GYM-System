import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './contexts/LanguageContext.jsx'

// Intercept fetch calls to dynamically prefix them with API URL from environment variables
const originalFetch = window.fetch;
window.fetch = function (url, options) {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  let finalUrl = url;
  if (typeof url === 'string' && url.startsWith('/api')) {
    finalUrl = baseUrl + url;
  }
  return originalFetch(finalUrl, options);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)

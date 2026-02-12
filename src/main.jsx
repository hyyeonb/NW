import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// React 마운트 시 HTML 프리로더 제거
const preloader = document.getElementById('app-preloader');
if (preloader) {
  preloader.classList.add('fade-out');
  setTimeout(() => preloader.remove(), 300);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

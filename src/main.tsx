import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

// Telegram Mini App bootstrap; the app remains fully usable in a regular browser.
const telegram = (window as any).Telegram?.WebApp
if (telegram) {
  telegram.ready()
  telegram.expand()
  telegram.setHeaderColor?.('#0a0a12')
  telegram.setBackgroundColor?.('#0a0a12')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
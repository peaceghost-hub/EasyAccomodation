import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function ThemedApp() {
  useEffect(() => {
    document.body.classList.add('dark-theme');
    document.body.classList.add('min-h-screen');
    document.body.classList.add('bg-app');
    return () => {
      document.body.classList.remove('dark-theme');
      document.body.classList.remove('min-h-screen');
      document.body.classList.remove('bg-app');
    };
  }, []);
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemedApp />
  </StrictMode>,
)

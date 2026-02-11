import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { ActiveGroupProvider } from './contexts/ActiveGroupContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ActiveGroupProvider>
        <App />
      </ActiveGroupProvider>
    </AuthProvider>
  </StrictMode>
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { ActiveGroupProvider } from './contexts/ActiveGroupContext';
import { GroupDataProvider } from './contexts/GroupDataContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ActiveGroupProvider>
            <GroupDataProvider>
              <App />
            </GroupDataProvider>
          </ActiveGroupProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);

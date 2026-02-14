import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import AddExpense from './pages/AddExpense';
import Profile from './pages/Profile';
import Settle from './pages/Settle';
import Analytics from './pages/Analytics';
import { requestPermissionAndSaveToken } from './lib/messaging';
import { onMessage } from 'firebase/messaging';
import { messaging } from './firebase';

function AppRoutes() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) {
      requestPermissionAndSaveToken(user.uid);
    }
  }, [user]);

  useEffect(() => {
    // Listen for foreground messages
    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('[Foreground] Message received: ', payload);
        const { title, body } = payload.notification || {};

        if (title) {
          // Use the browser's Notification API if permission granted
          if (Notification.permission === "granted") {
            new Notification(title, { body, icon: '/icon.svg' });
          } else {
            // Fallback to alert (simple for testing)
            alert(`${title}\n${body}`);
          }
        }
      });
      return () => unsubscribe();
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-dark-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center animate-glow-pulse">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-dark-400 text-sm animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      {user ? (
        <>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/settle" element={<Settle />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="/add" element={<AddExpense />} />
        </>
      ) : null}
      <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

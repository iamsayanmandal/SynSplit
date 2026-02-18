import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import { requestPermissionAndSaveToken } from './lib/messaging';
import { onMessage } from 'firebase/messaging';
import { messaging } from './firebase';
import { useState } from 'react';
import NotificationToast, { type NotificationPayload } from './components/NotificationToast';

// Lazy load pages
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Expenses = lazy(() => import('./pages/Expenses'));
const AddExpense = lazy(() => import('./pages/AddExpense'));
const Profile = lazy(() => import('./pages/Profile'));
const Settle = lazy(() => import('./pages/Settle'));
const Analytics = lazy(() => import('./pages/Analytics'));

const LoadingScreen = () => (
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

function AppRoutes() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) {
      requestPermissionAndSaveToken(user.uid);
    }
  }, [user]);

  const [notification, setNotification] = useState<NotificationPayload | null>(null);

  useEffect(() => {
    // Listen for foreground messages
    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('[Foreground] Message received: ', payload);

        // Robust extraction: payload.notification OR payload.data
        const title = payload.notification?.title || payload.data?.title;
        const body = payload.notification?.body || payload.data?.body;

        if (title && body) {
          // Play a subtle sound
          try {
            const audio = new Audio('/notification.mp3');
            audio.play().catch(() => { }); // Ignore interaction errors
          } catch (e) { }

          // Show custom toast with high priority
          setNotification({ title, body, data: payload.data });
        }
      });
      return () => unsubscribe();
    }
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
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
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

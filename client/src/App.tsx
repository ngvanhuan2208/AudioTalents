import { useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { useAuth } from './context/AuthContext';
import MainLayout from './layouts/MainLayout/MainLayout';
import { AuthModal, type AuthMode } from './components/auth/AuthModal';

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

function AppRouter() {
  const {isLoading, isAuthenticated} = useAuth();
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (nextPath: string) => {
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  };

  useEffect(() => {
    if (isAuthenticated && (path === '/login' || path === '/register')) {
      window.history.replaceState({}, '', '/');
      setPath('/');
    }
  }, [isAuthenticated, path]);

  if (isLoading) return <div className="min-h-screen bg-[#0f131c] text-[#908fa0] flex items-center justify-center text-sm">Đang kiểm tra phiên đăng nhập...</div>;

  const modalModes: Record<string, AuthMode> = { '/login': 'login', '/register': 'register', '/verify-email': 'verify', '/forgot-password': 'forgot', '/reset-password': 'reset' };
  const authMode = modalModes[path];

  // The legacy route components remain available, while public auth routes now render as an overlay.
  return <AudioProvider><MainLayout onNavigate={navigate} />{authMode && (!isAuthenticated || authMode === 'verify') && <AuthModal mode={authMode} onModeChange={next => navigate(Object.entries(modalModes).find(([, value]) => value === next)?.[0] || '/login')} onClose={() => navigate('/')} />}</AudioProvider>;
}

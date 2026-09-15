import React, {useEffect} from 'react';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  onNavigate: (path: string) => void;
  requireAdmin?: boolean;
  requireAuthor?: boolean;
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({onNavigate, requireAdmin, requireAuthor, children}) => {
  const {isLoading, isAuthenticated, user} = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      onNavigate('/login');
      return;
    }
    if (!user.emailVerified) onNavigate('/verify-email');
  }, [isLoading, user, onNavigate]);

  if (isLoading) return <div className="px-4 py-16 text-center text-sm text-[#908fa0]">Đang kiểm tra phiên đăng nhập...</div>;
  if (!user) return <div className="px-4 py-16 text-center text-sm text-[#908fa0]">Vui lòng đăng nhập để tiếp tục.</div>;
  if (!user.emailVerified) return <div className="px-4 py-16 text-center text-sm text-[#908fa0]">Vui lòng xác thực email trước khi tiếp tục.</div>;
  if (!isAuthenticated) return <div className="px-4 py-16 text-center text-sm text-[#908fa0]">Tài khoản hiện không thể truy cập nội dung này.</div>;
  if (requireAdmin && user.role !== 'ADMIN') return <div className="px-4 py-16 text-center text-sm text-[#908fa0]">Bạn không có quyền quản trị.</div>;
  if (requireAuthor && user.role !== 'ADMIN' && user.authorStatus !== 'APPROVED') {
    return <div className="px-4 py-16 text-center text-sm text-[#908fa0]">Chỉ tác giả đã được duyệt mới truy cập được khu vực này.</div>;
  }

  return <>{children}</>;
};

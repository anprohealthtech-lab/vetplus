import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import InactiveLab from '../../pages/InactiveLab';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, labStatus, labStatusLoading } = useAuth();
  const location = useLocation();

  // Show loading state while auth is initializing
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user is a B2B account - they should use B2B portal, not LIMS
  if (user?.user_metadata?.role === 'b2b_account') {
    return <Navigate to="/b2b/portal" replace />;
  }

  // Show loading state while lab status is being checked for the FIRST time only
  // If we already have a lab status, don't show loading (allows smooth navigation)
  if (labStatusLoading && labStatus === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
        <p className="text-gray-600">Verifying lab access...</p>
      </div>
    );
  }

  // Check if lab is active - only 'active' and 'trial' statuses are allowed
  const isLabActive = labStatus === 'active' || labStatus === 'trial';

  // Allow /subscription even for inactive/expired labs so they can subscribe
  const isSubscriptionPage = location.pathname === '/subscription';

  if (!isLabActive && !isSubscriptionPage) {
    // Show inactive lab page instead of redirecting
    return <InactiveLab />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
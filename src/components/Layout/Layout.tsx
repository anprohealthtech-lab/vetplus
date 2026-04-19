import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNavigation from './BottomNavigation';
import MobileBottomNav from './MobileBottomNav';
import { isNative } from '../../utils/platformHelper';
import TATFloater from '../Orders/TATFloater';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, X } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const isMobile = isNative();
  const navigate = useNavigate();
  const { labStatus, trialDaysRemaining } = useAuth();

  const showTrialBanner =
    !bannerDismissed &&
    labStatus === 'trial' &&
    trialDaysRemaining != null &&
    trialDaysRemaining <= 3;

  const bannerColor =
    (trialDaysRemaining ?? 3) <= 1 ? 'bg-red-600' : 'bg-amber-500';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar - fixed position, always rendered */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isMobile={isMobile}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      {/*
        Main content column — offset by sidebar width on large screens.
        Uses flex-col + overflow-hidden so children can manage their own scroll.
      */}
      <div
        className={`
          flex flex-col flex-1 min-w-0
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'lg:pl-20' : 'lg:pl-64'}
        `}
      >
        {/* Sticky header */}
        <div className="flex-none">
          <Header
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            isCollapsed={headerCollapsed}
            onToggleCollapse={() => setHeaderCollapsed(!headerCollapsed)}
          />

          {/* Trial Expiry Banner */}
          {showTrialBanner && (
            <div className={`${bannerColor} text-white px-4 py-2 flex items-center justify-between gap-3 text-sm`}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">
                  {(trialDaysRemaining ?? 0) <= 0
                    ? 'Your free trial expires today!'
                    : `Free trial ends in ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'}!`}
                  {' '}
                  <button
                    onClick={() => navigate('/subscription')}
                    className="underline font-semibold hover:no-underline"
                  >
                    Subscribe now
                  </button>
                </span>
              </div>
              <button
                onClick={() => setBannerDismissed(true)}
                className="flex-shrink-0 hover:opacity-75 transition-opacity"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/*
          Scrollable main area.
          - On mobile: extra bottom padding for bottom nav bar
          - On web: mb-16 lg:mb-0 to clear the bottom nav bar on tablet
          - overflow-y-auto here so pages with h-full or internal scroll work correctly
        */}
        <main
          className={`
            flex-1 overflow-y-auto overflow-x-hidden
            ${isMobile
              ? 'pb-safe-bottom'   /* Capacitor native — safe area bottom */
              : 'pb-16 lg:pb-0'   /* Web tablet: clear bottom nav; desktop: none */
            }
          `}
        >
          <div className="p-3 sm:p-4 md:p-6 min-h-full">
            {children}
          </div>
        </main>

        {/* Bottom Navigation */}
        {isMobile ? <MobileBottomNav /> : <BottomNavigation />}
      </div>

      {/* TAT Floater */}
      <TATFloater className={isMobile ? 'bottom-20' : 'bottom-20 lg:bottom-4'} />
    </div>
  );
};

export default Layout;
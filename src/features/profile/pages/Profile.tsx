import { useState, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { FloatingNav } from '@/shared/components';
import { IdentityCard } from '../components/IdentityCard';
import { PassportGrid } from '../components/PassportGrid';
import { SettingsDeck } from '../components/SettingsDeck';
import { ConfirmModal } from '../components/ConfirmModal';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { DiscoveryRail } from '@/features/events/components/DiscoveryRail';
import { hapticImpact } from '@/shared/lib/haptics';
import { APP_VERSION, APP_NAME } from '@/lib/version';
import toast from 'react-hot-toast';

/**
 * Profile Page - The Digital Sanctuary
 * 
 * Features:
 * - AuroraBackground (Ambient atmosphere layer)
 * - IdentityCard (The Prism) with 3D tilt, holographic foil, bio, and social stats
 * - Sticky tabs for navigation (Passport, Wishlist, Settings)
 * - PassportGrid showing past event history with enhanced empty state
 * - SettingsDeck - Spaceship control panel for settings
 */

type TabType = 'passport' | 'wishlist' | 'settings';

const Profile = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('passport');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const handleTabChange = async (tab: TabType) => {
    await hapticImpact('light');
    setActiveTab(tab);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, tab: TabType) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTabChange(tab);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const tabs: TabType[] = ['passport', 'wishlist', 'settings'];
      const currentIndex = tabs.indexOf(activeTab);
      const nextIndex = e.key === 'ArrowLeft' 
        ? (currentIndex - 1 + tabs.length) % tabs.length
        : (currentIndex + 1) % tabs.length;
      handleTabChange(tabs[nextIndex]);
    }
  };

  const handleSignOutClick = async () => {
    await hapticImpact('medium');
    setShowSignOutConfirm(true);
  };

  const confirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      toast.success('Signed out successfully');
      setShowSignOutConfirm(false);
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <>
      {/* Layer 0: Aurora Background - Fixed */}
      <AuroraBackground>
        <div className="min-h-screen text-white">
          {/* Hero Section - Fixed/Sticky with IdentityCard */}
          <div className="relative pt-24">
            <IdentityCard />
          </div>

          {/* Sticky Tabs - Accessible with ARIA and keyboard navigation */}
          <div className="sticky top-0 z-50  bg-black/60 border-b border-gray-400">
            <div className="max-w-lg mx-auto px-6">
              <div 
                className="flex items-center justify-around h-14"
                role="tablist"
                aria-label="Profile sections"
              >
                <button
                  onClick={() => handleTabChange('passport')}
                  onKeyDown={(e) => handleKeyDown(e, 'passport')}
                  role="tab"
                  aria-selected={activeTab === 'passport'}
                  aria-controls="passport-panel"
                  id="passport-tab"
                  className={`flex-1 text-center py-3 font-bold transition-all min-h-[44px] ${
                    activeTab === 'passport'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/50 hover:text-white/75'
                  }`}
                >
                  Passport
                </button>
                <button
                  onClick={() => handleTabChange('wishlist')}
                  onKeyDown={(e) => handleKeyDown(e, 'wishlist')}
                  role="tab"
                  aria-selected={activeTab === 'wishlist'}
                  aria-controls="wishlist-panel"
                  id="wishlist-tab"
                  className={`flex-1 text-center py-3 font-bold transition-all min-h-[44px] ${
                    activeTab === 'wishlist'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/50 hover:text-white/75'
                  }`}
                >
                  Wishlist
                </button>
                <button
                  onClick={() => handleTabChange('settings')}
                  onKeyDown={(e) => handleKeyDown(e, 'settings')}
                  role="tab"
                  aria-selected={activeTab === 'settings'}
                  aria-controls="settings-panel"
                  id="settings-tab"
                  className={`flex-1 text-center py-3 font-bold transition-all min-h-[44px] ${
                    activeTab === 'settings'
                      ? 'text-white border-b-2 border-white'
                      : 'text-white/50 hover:text-white/75'
                  }`}
                >
                  Settings
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="pb-32 space-y-12">
            <AnimatePresence mode="wait">
              {/* Passport Tab */}
              {activeTab === 'passport' && (
                <motion.div
                  key="passport"
                  role="tabpanel"
                  id="passport-panel"
                  aria-labelledby="passport-tab"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="py-6"
                >
                  <DiscoveryRail title="Your Journey">
                    <p className="text-white/60 text-sm mb-6">
                      Events you've attended around the world
                    </p>
                    <PassportGrid />
                  </DiscoveryRail>
                </motion.div>
              )}

              {/* Wishlist Tab */}
              {activeTab === 'wishlist' && (
                <motion.div
                  key="wishlist"
                  role="tabpanel"
                  id="wishlist-panel"
                  aria-labelledby="wishlist-tab"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="py-6"
                >
                  <DiscoveryRail title="Wishlist">
                    <div className=" bg-white/5 border border-gray-400 rounded-2xl p-12 text-center">
                      <p className="text-white/60">
                        Save events you're interested in attending
                      </p>
                      <p className="text-white/40 text-sm mt-2">Coming soon</p>
                    </div>
                  </DiscoveryRail>
                </motion.div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  role="tabpanel"
                  id="settings-panel"
                  aria-labelledby="settings-tab"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="py-6"
                >
                  <DiscoveryRail title="Settings">
                    <SettingsDeck 
                      onSignOut={handleSignOutClick}
                      isSigningOut={isSigningOut}
                    />

                    {/* App Version */}
                    <div className="py-6 text-center">
                      <p className="text-xs text-white/40">{APP_NAME} · Version {APP_VERSION}</p>
                    </div>
                  </DiscoveryRail>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </AuroraBackground>

      {/* FloatingNav */}
      <FloatingNav activeView="profile" />

      {/* Sign Out Confirmation Modal */}
      <ConfirmModal
        open={showSignOutConfirm}
        title="Sign out?"
        description="You will need to sign in again to access your profile."
        confirmText={isSigningOut ? 'Signing out…' : 'Sign out'}
        cancelText="Stay"
        confirmDisabled={isSigningOut}
        onConfirm={confirmSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />
    </>
  );
};

export default Profile;

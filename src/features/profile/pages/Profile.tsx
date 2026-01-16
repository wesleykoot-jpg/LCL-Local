import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { FloatingNav } from '@/shared/components';
import { IdentityCard } from '../components/IdentityCard';
import { PassportGrid } from '../components/PassportGrid';
import { ConfirmModal } from '../components/ConfirmModal';
import { hapticImpact } from '@/shared/lib/haptics';
import toast from 'react-hot-toast';

// Import version from package.json
import packageJson from '../../../../package.json';

/**
 * Profile Page - The Holographic Identity
 * 
 * Features:
 * - IdentityCard (The Prism) with 3D tilt and holographic effects
 * - Sticky tabs for navigation (Passport, Wishlist, Settings)
 * - PassportGrid showing past event history
 * - Minimal settings section with logout
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
      <div className="min-h-screen bg-black text-white">
        {/* Hero Section - Fixed/Sticky with IdentityCard */}
        <div className="relative pt-24">
          <IdentityCard />
        </div>

        {/* Sticky Tabs */}
        <div className="sticky top-0 z-50 backdrop-blur-md bg-black/80 border-b border-white/10">
          <div className="max-w-lg mx-auto px-5">
            <div className="flex items-center justify-around h-14">
              <button
                onClick={() => handleTabChange('passport')}
                className={`flex-1 text-center py-3 font-medium transition-all ${
                  activeTab === 'passport'
                    ? 'text-white border-b-2 border-white'
                    : 'text-white/50 hover:text-white/75'
                }`}
              >
                Passport
              </button>
              <button
                onClick={() => handleTabChange('wishlist')}
                className={`flex-1 text-center py-3 font-medium transition-all ${
                  activeTab === 'wishlist'
                    ? 'text-white border-b-2 border-white'
                    : 'text-white/50 hover:text-white/75'
                }`}
              >
                Wishlist
              </button>
              <button
                onClick={() => handleTabChange('settings')}
                className={`flex-1 text-center py-3 font-medium transition-all ${
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
        <div className="pb-32">
          <AnimatePresence mode="wait">
            {/* Passport Tab */}
            {activeTab === 'passport' && (
              <motion.div
                key="passport"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="py-6"
              >
                <div className="max-w-lg mx-auto">
                  <h2 className="text-2xl font-bold px-5 mb-4">Your Journey</h2>
                  <p className="text-white/60 text-sm px-5 mb-6">
                    Events you've attended around the world
                  </p>
                  <PassportGrid />
                </div>
              </motion.div>
            )}

            {/* Wishlist Tab */}
            {activeTab === 'wishlist' && (
              <motion.div
                key="wishlist"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="py-6"
              >
                <div className="max-w-lg mx-auto px-5">
                  <h2 className="text-2xl font-bold mb-4">Wishlist</h2>
                  <div className="bg-white/5 rounded-2xl p-12 text-center">
                    <p className="text-white/60">
                      Save events you're interested in attending
                    </p>
                    <p className="text-white/40 text-sm mt-2">Coming soon</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="py-6"
              >
                <div className="max-w-lg mx-auto">
                  <h2 className="text-2xl font-bold px-5 mb-6">Settings</h2>
                  
                  {/* Settings List - Minimal */}
                  <div className="divide-y divide-white/10">
                    <button
                      onClick={handleSignOutClick}
                      disabled={isSigningOut}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-all active:bg-white/10 disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        {isSigningOut ? (
                          <Loader2 size={20} className="text-red-400 animate-spin" />
                        ) : (
                          <LogOut size={20} className="text-red-400" />
                        )}
                        <span className="text-sm font-medium text-red-400">
                          {isSigningOut ? 'Signing out...' : 'Log Out'}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* App Version */}
                  <div className="px-5 py-6 text-center">
                    <p className="text-xs text-white/40">LCL · Version {packageJson.version}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

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

import { useState, useRef, type KeyboardEvent } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { FloatingNav } from '@/shared/components';
import { MorphingHeader } from '../components/MorphingHeader';
import { LivingPassport } from '../components/LivingPassport';
import { UpcomingBoardingPasses } from '../components/UpcomingBoardingPasses';
import { SettingsDeck } from '../components/SettingsDeck';
import { ConfirmModal } from '../components/ConfirmModal';
import { hapticImpact } from '@/shared/lib/haptics';
import { APP_VERSION, APP_NAME } from '@/lib/version';
import { useMotionPreset } from '@/hooks/useMotionPreset';
import toast from 'react-hot-toast';

/**
 * Profile Page - The Social Passport (v5.0 "Social Air" Redesign)
 * 
 * Replaces the heavy glassmorphism "Digital Sanctuary" with a clean,
 * scroll-driven, high-legibility interface using the Airbnb-inspired
 * "Physical Cardstock over Virtual Glass" aesthetic.
 * 
 * Features:
 * - MorphingHeader: Scroll-driven identity card that docks into sticky nav
 * - Pill-style tabs (Radix-style rounded-full)
 * - LivingPassport: Vertical timeline replacing the grid of thumbs
 * - SettingsDeck: iOS Settings style grouped lists
 * - Off-white background (#F7F7F7) with solid white cards
 */

type TabType = 'plans' | 'passport' | 'settings';

const Profile = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const motionPreset = useMotionPreset();

  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>('plans');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Scroll tracking for header morph
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 150], [1, 0]);
  const headerScale = useTransform(scrollY, [0, 150], [1, 0.9]);

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
      const tabs: TabType[] = ['plans', 'passport', 'settings'];
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
      {/* v5.0 Social Air Background - Clean Off-White Canvas */}
      <div
        ref={containerRef}
        className="min-h-screen bg-surface-base"
      >
        {/* Hero Section - Morphing Identity Header */}
        <div className="px-6 pt-safe-top">
          <motion.div
            className="pt-6 pb-4"
            style={{
              opacity: motionPreset.prefersReducedMotion ? 1 : headerOpacity,
              scale: motionPreset.prefersReducedMotion ? 1 : headerScale,
            }}
          >
            <MorphingHeader containerRef={containerRef} />
          </motion.div>
        </div>

        {/* Pill-Style Tabs */}
        <div className="sticky top-0 z-40 px-6 py-3 bg-surface-base">
          <div
            className="bg-surface-card shadow-card rounded-pill p-1 flex"
            role="tablist"
            aria-label="Profile sections"
          >
            <button
              onClick={() => handleTabChange('plans')}
              onKeyDown={(e) => handleKeyDown(e, 'plans')}
              role="tab"
              aria-selected={activeTab === 'plans'}
              aria-controls="plans-panel"
              id="plans-tab"
              className={`flex-1 py-2.5 px-4 rounded-pill text-sm font-semibold transition-all min-h-[44px] ${activeTab === 'plans'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              Plans
            </button>
            <button
              onClick={() => handleTabChange('passport')}
              onKeyDown={(e) => handleKeyDown(e, 'passport')}
              role="tab"
              aria-selected={activeTab === 'passport'}
              aria-controls="passport-panel"
              id="passport-tab"
              className={`flex-1 py-2.5 px-4 rounded-pill text-sm font-semibold transition-all min-h-[44px] ${activeTab === 'passport'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              Passport
            </button>
            <button
              onClick={() => handleTabChange('settings')}
              onKeyDown={(e) => handleKeyDown(e, 'settings')}
              role="tab"
              aria-selected={activeTab === 'settings'}
              aria-controls="settings-panel"
              id="settings-tab"
              className={`flex-1 py-2.5 px-4 rounded-pill text-sm font-semibold transition-all min-h-[44px] ${activeTab === 'settings'
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="px-6 pb-32 pt-4">
          <AnimatePresence mode="wait">
            {/* Plans Tab - Upcoming Events */}
            {activeTab === 'plans' && (
              <motion.div
                key="plans"
                role="tabpanel"
                id="plans-panel"
                aria-labelledby="plans-tab"
                {...(motionPreset.prefersReducedMotion ? {} : {
                  initial: { opacity: 0, x: -20 },
                  animate: { opacity: 1, x: 0 },
                  exit: { opacity: 0, x: 20 },
                  transition: { duration: 0.2 },
                })}
              >
                <h2 className="text-lg font-bold text-text-primary mb-4">
                  Boarding Passes
                </h2>
                <p className="text-text-secondary text-sm mb-6">
                  Your upcoming events and tickets
                </p>
                <UpcomingBoardingPasses />
              </motion.div>
            )}

            {/* Passport Tab - Living Timeline */}
            {activeTab === 'passport' && (
              <motion.div
                key="passport"
                role="tabpanel"
                id="passport-panel"
                aria-labelledby="passport-tab"
                {...(motionPreset.prefersReducedMotion ? {} : {
                  initial: { opacity: 0, x: -20 },
                  animate: { opacity: 1, x: 0 },
                  exit: { opacity: 0, x: 20 },
                  transition: { duration: 0.2 },
                })}
              >
                <h2 className="text-lg font-bold text-text-primary mb-4">
                  Your Journey
                </h2>
                <p className="text-text-secondary text-sm mb-6">
                  Events you've attended around the world
                </p>
                <LivingPassport />
              </motion.div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                role="tabpanel"
                id="settings-panel"
                aria-labelledby="settings-tab"
                {...(motionPreset.prefersReducedMotion ? {} : {
                  initial: { opacity: 0, x: -20 },
                  animate: { opacity: 1, x: 0 },
                  exit: { opacity: 0, x: 20 },
                  transition: { duration: 0.2 },
                })}
              >
                <h2 className="text-lg font-bold text-text-primary mb-4">
                  Settings
                </h2>
                <SettingsDeck
                  onSignOut={handleSignOutClick}
                  isSigningOut={isSigningOut}
                />

                {/* App Version */}
                <div className="py-8 text-center">
                  <p className="text-xs text-text-muted">
                    {APP_NAME} · Version {APP_VERSION}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
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

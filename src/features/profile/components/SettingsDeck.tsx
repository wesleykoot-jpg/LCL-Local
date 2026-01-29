import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Trash2, Bell, Lock, User, Loader2, ChevronRight, Settings } from 'lucide-react';
import { hapticImpact } from '@/shared/lib/haptics';
import { Switch } from '@/components/ui/switch';
import { useMotionPreset } from '@/hooks/useMotionPreset';

/**
 * SettingsDeck - iOS Settings Style Control Panel
 * 
 * Part of the v5.0 "Social Air" Design System.
 * Clean, grouped list items replacing the "Spaceship Dashboard".
 * Features standardized Switch toggles and ChevronRight icons.
 */

interface SettingsDeckProps {
  onSignOut: () => void;
  isSigningOut?: boolean;
}

/**
 * Settings Toggle Row with standardized Switch
 */
interface SettingsToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  description?: string;
}

function SettingsToggle({ enabled, onChange, label, description }: SettingsToggleProps) {
  const handleToggle = async () => {
    await hapticImpact('light');
    onChange(!enabled);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Let the Switch component handle its own keyboard events
    // Only handle Enter/Space on the container if focus is on the row
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div
      className="w-full flex items-center justify-between py-4 px-5 hover:bg-gray-50 transition-colors min-h-touch cursor-pointer focus:outline-none focus:bg-gray-50"
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="group"
      aria-label={`${label}${description ? `, ${description}` : ''}`}
    >
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && (
          <p className="text-xs text-text-secondary mt-0.5">{description}</p>
        )}
      </div>
      <Switch 
        checked={enabled} 
        onCheckedChange={onChange}
        onClick={(e) => e.stopPropagation()}
        aria-label={label}
        tabIndex={-1}
      />
    </div>
  );
}

/**
 * Settings Navigation Row with ChevronRight
 */
interface SettingsNavRowProps {
  label: string;
  description?: string;
  onClick?: () => void;
}

function SettingsNavRow({ label, description, onClick }: SettingsNavRowProps) {
  return (
    <button 
      onClick={onClick}
      className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors min-h-touch"
    >
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description && (
          <p className="text-xs text-text-secondary mt-0.5">{description}</p>
        )}
      </div>
      <ChevronRight size={20} className="text-text-muted shrink-0" />
    </button>
  );
}

export function SettingsDeck({ onSignOut, isSigningOut = false }: SettingsDeckProps) {
  const motionPreset = useMotionPreset();
  const navigate = useNavigate();
  // State for toggle switches
  const [pushNotifications, setPushNotifications] = useState(true);
  const [eventReminders, setEventReminders] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState(true);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Account Section - Solid White Card */}
      <motion.div
        className="bg-surface-card rounded-card shadow-card overflow-hidden"
        {...(motionPreset.prefersReducedMotion ? {} : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: 0.1 },
        })}
        role="region"
        aria-label="Account settings"
      >
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <User size={16} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Account</h3>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          <SettingsNavRow 
            label="Personal Information"
            description="Update your profile details"
          />
          <SettingsNavRow 
            label="Preferences"
            description="Customize your experience"
          />
        </div>
      </motion.div>

      {/* UAT Section */}
      <motion.div
        className="bg-surface-card rounded-card shadow-card overflow-hidden"
        {...(motionPreset.prefersReducedMotion ? {} : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: 0.35 },
        })}
        role="region"
        aria-label="UAT tools"
      >
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">UAT</h3>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          <SettingsNavRow
            label="Quality Dashboard"
            description="Daily source metrics"
            onClick={() => navigate('/profile/quality-dashboard')}
          />
        </div>
      </motion.div>

      {/* Notifications Section */}
      <motion.div
        className="bg-surface-card rounded-card shadow-card overflow-hidden"
        {...(motionPreset.prefersReducedMotion ? {} : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: 0.2 },
        })}
        role="region"
        aria-label="Notification settings"
      >
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Notifications</h3>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          <SettingsToggle
            enabled={pushNotifications}
            onChange={setPushNotifications}
            label="Push Notifications"
            description="Receive updates about events"
          />
          <SettingsToggle
            enabled={eventReminders}
            onChange={setEventReminders}
            label="Event Reminders"
            description="Get notified before events start"
          />
        </div>
      </motion.div>

      {/* Privacy Section */}
      <motion.div
        className="bg-surface-card rounded-card shadow-card overflow-hidden"
        {...(motionPreset.prefersReducedMotion ? {} : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: 0.3 },
        })}
        role="region"
        aria-label="Privacy settings"
      >
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Privacy</h3>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          <SettingsToggle
            enabled={locationSharing}
            onChange={setLocationSharing}
            label="Location Sharing"
            description="Share your location with events"
          />
          <SettingsToggle
            enabled={profileVisibility}
            onChange={setProfileVisibility}
            label="Public Profile"
            description="Make your profile visible to others"
          />
        </div>
      </motion.div>

      {/* Danger Zone - Red tinted card */}
      <motion.div
        className="bg-red-50 rounded-card shadow-card overflow-hidden border border-red-100"
        {...(motionPreset.prefersReducedMotion ? {} : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: 0.4 },
        })}
        role="region"
        aria-label="Danger zone - Account actions"
      >
        <div className="px-5 py-3 border-b border-red-100">
          <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wide">Danger Zone</h3>
        </div>
        <div className="divide-y divide-red-100">
          <button
            onClick={onSignOut}
            disabled={isSigningOut}
            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-red-100 transition-colors disabled:opacity-50 min-h-touch"
          >
            {isSigningOut ? (
              <Loader2 size={18} className="text-red-600 animate-spin" />
            ) : (
              <LogOut size={18} className="text-red-600" />
            )}
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-red-600">
                {isSigningOut ? 'Signing out...' : 'Log Out'}
              </p>
              <p className="text-xs text-red-500 mt-0.5">Sign out of your account</p>
            </div>
          </button>
          <button
            disabled={isSigningOut}
            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-red-100 transition-colors disabled:opacity-50 min-h-touch"
          >
            <Trash2 size={18} className="text-red-600" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-red-600">Delete Account</p>
              <p className="text-xs text-red-500 mt-0.5">Permanently delete your data</p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

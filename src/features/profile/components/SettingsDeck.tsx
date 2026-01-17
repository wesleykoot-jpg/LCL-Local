import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Trash2, Bell, Lock, User, Loader2 } from 'lucide-react';
import { hapticImpact } from '@/shared/lib/haptics';

/**
 * SettingsDeck - Control Panel Interface
 * 
 * A spaceship-style control deck with grouped glass panels for settings.
 * Features custom neon toggles, organized sections, and a danger zone.
 */

interface SettingsDeckProps {
  onSignOut: () => void;
  isSigningOut?: boolean;
}

/**
 * Custom Neon Toggle Switch
 */
interface NeonToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  description?: string;
}

function NeonToggle({ enabled, onChange, label, description }: NeonToggleProps) {
  const handleToggle = async () => {
    await hapticImpact('light');
    onChange(!enabled);
  };

  return (
    <button
      onClick={handleToggle}
      className="w-full flex items-center justify-between py-4 px-5 hover:bg-white/5 transition-all active:bg-white/10"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
    >
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && (
          <p className="text-xs text-white/60 mt-0.5">{description}</p>
        )}
      </div>
      <motion.div
        className={`relative w-12 h-7 rounded-full transition-colors ${
          enabled ? 'bg-green-500/30' : 'bg-white/10'
        }`}
        style={{
          border: enabled ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
        }}
        animate={{
          boxShadow: enabled
            ? '0 0 12px rgba(34, 197, 94, 0.4)'
            : '0 0 0 rgba(255, 255, 255, 0)',
        }}
      >
        <motion.div
          className={`absolute top-1 w-5 h-5 rounded-full ${
            enabled ? 'bg-green-400' : 'bg-white/60'
          }`}
          animate={{
            left: enabled ? '22px' : '4px',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{
            boxShadow: enabled ? '0 2px 8px rgba(34, 197, 94, 0.6)' : '0 2px 4px rgba(0, 0, 0, 0.2)',
          }}
        />
      </motion.div>
    </button>
  );
}

export function SettingsDeck({ onSignOut, isSigningOut = false }: SettingsDeckProps) {
  // State for toggle switches
  const [pushNotifications, setPushNotifications] = useState(true);
  const [eventReminders, setEventReminders] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState(true);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Account Section */}
      <motion.div
        className="glass-panel rounded-2xl overflow-hidden backdrop-blur-xl bg-white/5 border border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        role="region"
        aria-label="Account settings"
      >
        <div className="px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <User size={16} className="text-white/60" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Account</h3>
          </div>
        </div>
        <div className="divide-y divide-white/10">
          <button className="w-full px-5 py-4 text-left hover:bg-white/5 transition-all active:bg-white/10">
            <p className="text-sm font-medium text-white">Personal Information</p>
            <p className="text-xs text-white/60 mt-0.5">Update your profile details</p>
          </button>
          <button className="w-full px-5 py-4 text-left hover:bg-white/5 transition-all active:bg-white/10">
            <p className="text-sm font-medium text-white">Preferences</p>
            <p className="text-xs text-white/60 mt-0.5">Customize your experience</p>
          </button>
        </div>
      </motion.div>

      {/* Notifications Section */}
      <motion.div
        className="glass-panel rounded-2xl overflow-hidden backdrop-blur-xl bg-white/5 border border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        role="region"
        aria-label="Notification settings"
      >
        <div className="px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-white/60" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Notifications</h3>
          </div>
        </div>
        <div className="divide-y divide-white/10">
          <NeonToggle
            enabled={pushNotifications}
            onChange={setPushNotifications}
            label="Push Notifications"
            description="Receive updates about events"
          />
          <NeonToggle
            enabled={eventReminders}
            onChange={setEventReminders}
            label="Event Reminders"
            description="Get notified before events start"
          />
        </div>
      </motion.div>

      {/* Privacy Section */}
      <motion.div
        className="glass-panel rounded-2xl overflow-hidden backdrop-blur-xl bg-white/5 border border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        role="region"
        aria-label="Privacy settings"
      >
        <div className="px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-white/60" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Privacy</h3>
          </div>
        </div>
        <div className="divide-y divide-white/10">
          <NeonToggle
            enabled={locationSharing}
            onChange={setLocationSharing}
            label="Location Sharing"
            description="Share your location with events"
          />
          <NeonToggle
            enabled={profileVisibility}
            onChange={setProfileVisibility}
            label="Public Profile"
            description="Make your profile visible to others"
          />
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        className="glass-panel rounded-2xl overflow-hidden backdrop-blur-xl bg-red-500/10 border border-red-500/30"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        role="region"
        aria-label="Danger zone - Account actions"
      >
        <div className="px-5 py-3 border-b border-red-500/20">
          <h3 className="text-sm font-bold text-red-400 uppercase tracking-wide">Danger Zone</h3>
        </div>
        <div className="divide-y divide-red-500/20">
          <button
            onClick={onSignOut}
            disabled={isSigningOut}
            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-red-500/10 transition-all active:bg-red-500/20 disabled:opacity-50"
          >
            {isSigningOut ? (
              <Loader2 size={18} className="text-red-400 animate-spin" />
            ) : (
              <LogOut size={18} className="text-red-400" />
            )}
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-red-400">
                {isSigningOut ? 'Signing out...' : 'Log Out'}
              </p>
              <p className="text-xs text-red-400/60 mt-0.5">Sign out of your account</p>
            </div>
          </button>
          <button
            disabled={isSigningOut}
            className="w-full px-5 py-4 flex items-center gap-3 hover:bg-red-500/10 transition-all active:bg-red-500/20 disabled:opacity-50"
          >
            <Trash2 size={18} className="text-red-400" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-red-400">Delete Account</p>
              <p className="text-xs text-red-400/60 mt-0.5">Permanently delete your data</p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

import React, { useState, createElement } from 'react';
import { 
  MapPin, Shield, ChevronRight, Trophy, Star, Award, Users, 
  CheckCircle, Flame, LogOut, Loader2, Settings, Heart,
  Calendar, Clock, Sparkles, BadgeCheck, Edit3, Share2, Camera, Link2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { usePersonaStats, usePersonaBadges, useUserCommitments } from '../lib/hooks';
import { useGoogleCalendar } from '../hooks/useGoogleCalendar';
import toast from 'react-hot-toast';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { hapticImpact } from '@/lib/haptics';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
  Shield,
  Users,
  Trophy,
  Star,
};

// Mock profile for development mode
const MOCK_PROFILE = {
  id: '00000000-0000-0000-0000-000000000001',
  user_id: 'dev-user-001',
  full_name: 'Demo User',
  location_city: 'Meppel',
  location_country: 'Netherlands',
  verified_resident: true,
  reliability_score: 95,
  events_attended: 12,
  events_committed: 13,
  avatar_url: null,
  current_persona: 'family',
  location_coordinates: null,
  profile_complete: true,
  created_at: '2023-06-15T00:00:00Z',
  updated_at: new Date().toISOString(),
};

// Calculate member duration
const getMemberDuration = (createdAt: string) => {
  const created = new Date(createdAt);
  const now = new Date();
  const months = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30));
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year' : `${years} years`;
};

// Parse date as local date (not UTC)
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Group events by timeframe
function groupEventsByTimeframe<T extends { event_date: string }>(events: T[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  
  const groups = {
    today: [] as T[],
    thisWeek: [] as T[],
    later: [] as T[]
  };
  
  events.forEach(event => {
    const eventDate = parseLocalDate(event.event_date);
    eventDate.setHours(0, 0, 0, 0);
    
    if (eventDate.getTime() === today.getTime()) {
      groups.today.push(event);
    } else if (eventDate > today && eventDate <= endOfWeek) {
      groups.thisWeek.push(event);
    } else if (eventDate > today) {
      groups.later.push(event);
    }
  });
  
  return groups;
}

// Format event date for list view
function formatEventDate(dateString: string, timeString: string, isToday: boolean): string {
  if (isToday) {
    return timeString;
  }
  const date = parseLocalDate(dateString);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${dayName}, ${monthDay} · ${timeString}`;
}

export function ProfileView() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Use mock profile if not authenticated (for development)
  const displayProfile = profile || MOCK_PROFILE;
  const isDemoMode = !profile;

  const { stats: personaStats, loading: statsLoading } = usePersonaStats(displayProfile.id);
  const { badges: personaBadges, loading: badgesLoading } = usePersonaBadges(displayProfile.id);
  const { commitments, loading: commitmentsLoading } = useUserCommitments(displayProfile.id);
  const { isConnected: isCalendarConnected } = useGoogleCalendar();

  const memberDuration = getMemberDuration(displayProfile.created_at || new Date().toISOString());
  const groupedEvents = groupEventsByTimeframe(commitments);
  const avatarInitial = displayProfile.full_name
    ? displayProfile.full_name.charAt(0).toUpperCase()
    : 'U';
  const motionProps = (delay = 0, offset = 20) =>
    prefersReducedMotion
      ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } }
      : { initial: { opacity: 0, y: offset }, animate: { opacity: 1, y: 0 }, transition: { delay } };

  const handleSignOutClick = async () => {
    if (isDemoMode) {
      toast('Demo mode - no account to sign out from', { icon: 'ℹ️' });
      return;
    }
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

  const handleSettingsClick = async (setting: string) => {
    await hapticImpact('light');
    toast(`${setting} coming soon!`, { icon: '🚧' });
  };

  const handleNavigateToSettings = async (path: string) => {
    await hapticImpact('light');
    navigate(path);
  };

  return (
    <div
      className="min-h-screen bg-background text-foreground font-sans pb-32"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8rem)' }}
    >
      {/* Demo Mode Banner */}
      <AnimatePresence initial={!prefersReducedMotion}>
        {isDemoMode && (
          <motion.div 
            initial={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            className="bg-primary text-primary-foreground text-center py-2.5 text-sm font-medium"
          >
            Demo Mode — Sign in for your real profile
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Header - Minimal Airbnb style with safe area */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border pt-safe">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <h1 className="font-display text-xl text-foreground tracking-tight">
            Profile
          </h1>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleSettingsClick('Edit Profile')}
              aria-label="Edit profile"
              className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-[0.95]"
              title="Edit Profile"
            >
              <Edit3 size={20} />
            </button>
            <button
              onClick={() => handleSettingsClick('Settings')}
              aria-label="Open settings"
              className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-all active:scale-[0.95]"
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={handleSignOutClick}
              disabled={isSigningOut}
              aria-label="Sign out"
              className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-all disabled:opacity-50 active:scale-[0.95]"
              title="Sign Out"
            >
              {isSigningOut ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <LogOut size={20} />
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto">
        {/* Hero Profile Section - Clean centered layout */}
        <motion.section
          {...motionProps()}
          className="px-5 pt-8 pb-6 text-center"
        >
          {/* Large Avatar */}
          <div className="relative inline-block mb-4">
            <div
              role="img"
              aria-label={`Avatar of ${displayProfile.full_name || 'Demo User'}`}
              className="w-28 h-28 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-4xl font-bold shadow-lg ring-4 ring-background overflow-hidden"
            >
              {displayProfile.avatar_url ? (
                <img
                  src={displayProfile.avatar_url}
                  alt={`Avatar of ${displayProfile.full_name || 'Demo User'}`}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                avatarInitial
              )}
            </div>
            {displayProfile.verified_resident && (
              <motion.div 
                initial={prefersReducedMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.2, type: 'spring' }}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-4 border-background shadow-md"
              >
                <BadgeCheck size={16} className="text-primary-foreground" />
              </motion.div>
            )}
            <button 
              onClick={() => handleSettingsClick('Change Photo')}
              aria-label="Change profile photo"
              className="absolute bottom-0 left-0 w-10 h-10 min-h-[44px] min-w-[44px] bg-muted rounded-full flex items-center justify-center border-4 border-background shadow-md hover:bg-muted/80 transition-all active:scale-[0.95]"
            >
              <Camera size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* Name */}
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {displayProfile.full_name}
          </h2>

          {/* Reliability Score Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 rounded-full mb-3">
            <Star size={14} className="text-green-600 fill-green-600" />
            <span className="text-sm font-medium text-green-700">{displayProfile.reliability_score}% Reliable</span>
          </div>

          {/* Location */}
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-4">
            <MapPin size={14} />
            <span className="text-sm">{displayProfile.location_city}, {displayProfile.location_country}</span>
          </div>

          {/* Trust Signals Row - Simplified */}
          <div className="flex items-center justify-center gap-6 py-4 border-y border-border">
            <div className="text-center">
              <div className="text-xl font-bold text-foreground">{displayProfile.events_attended}</div>
              <div className="text-xs text-muted-foreground">Events</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <div className="text-xl font-bold text-foreground">{memberDuration}</div>
              <div className="text-xs text-muted-foreground">Member</div>
            </div>
          </div>
        </motion.section>

        {/* Verification Badges - Wrap layout */}
        <motion.section
          {...motionProps(0.1, 10)}
          className="px-5 pb-6"
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            {displayProfile.verified_resident && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-green-500/10 rounded-full border border-green-500/20">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-sm font-medium text-green-700">Verified Resident</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 rounded-full border border-primary/20">
              <Shield size={16} className="text-primary" />
              <span className="text-sm font-medium text-primary">Identity Verified</span>
            </div>
          </div>
        </motion.section>

        {/* Divider */}
        <div className="h-2 bg-muted" />

        {/* Achievements/Badges Section - Unified grid */}
        <motion.section
          {...motionProps(0.15, 10)}
          className="py-6"
        >
          <div className="flex items-center justify-between px-5 mb-4">
            <div className="flex items-center gap-2">
              <Award size={20} className="text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Achievements</h3>
            </div>
            <button className="text-sm font-medium text-primary min-h-[44px] px-3 flex items-center active:scale-[0.97] transition-transform">
              View All
            </button>
          </div>
          
          {badgesLoading ? (
            <div className="flex gap-3 px-5 overflow-x-auto">
              {[1, 2, 3].map(i => (
                <LoadingSkeleton key={i} className="w-24 h-28 rounded-2xl flex-shrink-0" />
              ))}
            </div>
          ) : personaBadges.length > 0 ? (
            <div className="flex gap-3 px-5 overflow-x-auto pb-1 scrollbar-hide">
              {personaBadges.map((badge, index) => (
                <motion.div 
                  key={badge.id}
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.15 + index * 0.1 }}
                  className="w-24 flex-shrink-0 text-center"
                >
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground mb-2 shadow-md">
                    {iconMap[badge.badge_icon] ? createElement(iconMap[badge.badge_icon], { size: 24 }) : (
                      <Trophy size={24} />
                    )}
                  </div>
                  <h4 className="font-semibold text-foreground text-xs truncate px-1">
                    {badge.badge_name}
                  </h4>
                  <p className="text-[10px] text-muted-foreground">{badge.badge_level}</p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="px-5">
              <div className="bg-muted/50 rounded-2xl p-6 text-center">
                <Sparkles size={32} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Attend events to earn badges!
                </p>
              </div>
            </div>
          )}
        </motion.section>

        {/* Divider */}
        <div className="h-2 bg-muted" />

        {/* Community Stats */}
        <motion.section
          {...motionProps(0.2, 10)}
          className="px-5 py-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Flame size={20} className="text-orange-500" />
            <h3 className="text-lg font-semibold text-foreground">Community Stats</h3>
          </div>
          
          {statsLoading ? (
            <LoadingSkeleton className="h-24 w-full rounded-2xl" />
          ) : personaStats ? (
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-foreground mb-0.5">
                  {personaStats.rallies_hosted}
                </div>
                <div className="text-xs text-muted-foreground">
                  Events Hosted
                </div>
              </div>
              <div className="bg-muted/50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-bold text-foreground mb-0.5">
                  {personaStats.newcomers_welcomed}
                </div>
                <div className="text-xs text-muted-foreground">
                  Newcomers
                </div>
              </div>
              <div className="bg-muted/50 rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Star size={16} className="text-primary fill-primary" />
                  <span className="text-2xl font-bold text-foreground">
                    {personaStats.host_rating.toFixed(1)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Host Rating
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-2xl p-6 text-center text-muted-foreground text-sm">
              Start hosting to see your stats!
            </div>
          )}
        </motion.section>

        {/* Divider */}
        <div className="h-2 bg-muted" />

        {/* Integrations Section - Elevated Google Calendar */}
        <motion.section
          {...motionProps(0.22, 10)}
          className="py-6"
        >
          <div className="flex items-center gap-2 px-5 mb-4">
            <Link2 size={20} className="text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Integrations</h3>
          </div>
          
          <div className="px-5">
            <button 
              onClick={async () => {
                await hapticImpact('light');
                navigate('/profile/calendar');
              }}
              className="w-full bg-gradient-to-r from-blue-500/5 to-green-500/5 border border-primary/20 rounded-2xl p-4 hover:border-primary/40 hover:shadow-md transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-4">
                {/* Google Calendar Icon */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center shadow-md">
                  <Calendar size={24} className="text-white" />
                </div>
                
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="font-semibold text-foreground">
                      Google Calendar
                    </h4>
                    {isCalendarConnected ? (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-600 rounded-full">
                        Connected
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isCalendarConnected 
                      ? 'Events auto-sync to your calendar' 
                      : 'Auto-sync events you join'}
                  </p>
                </div>
                
                <ChevronRight size={20} className="text-muted-foreground" />
              </div>
            </button>
          </div>
        </motion.section>

        {/* Divider */}
        <div className="h-2 bg-muted" />

        {/* My Calendar - Clean List View */}
        <motion.section
          {...motionProps(0.25, 10)}
          className="py-6"
        >
          <div className="flex items-center justify-between px-5 mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={20} className="text-primary" />
              <h3 className="text-lg font-semibold text-foreground">My Calendar</h3>
            </div>
            <span className="text-sm text-muted-foreground">
              {commitments.length} events
            </span>
          </div>
          
          <div className="px-5">
            {commitmentsLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <LoadingSkeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : commitments.length > 0 ? (
              <div className="space-y-4">
                {/* Today Section */}
                {groupedEvents.today.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Today
                    </h4>
                    <div className="space-y-2">
                      {groupedEvents.today.map((event, index) => (
                        <CalendarListItem 
                          key={event.id} 
                          event={event} 
                          index={index}
                          isToday={true}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* This Week Section */}
                {groupedEvents.thisWeek.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      This Week
                    </h4>
                    <div className="space-y-2">
                      {groupedEvents.thisWeek.map((event, index) => (
                        <CalendarListItem 
                          key={event.id} 
                          event={event} 
                          index={index}
                          isToday={false}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Later Section */}
                {groupedEvents.later.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Later
                    </h4>
                    <div className="space-y-2">
                      {groupedEvents.later.map((event, index) => (
                        <CalendarListItem 
                          key={event.id} 
                          event={event} 
                          index={index}
                          isToday={false}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {commitments.length > 3 && (
                  <button className="w-full py-3 min-h-[44px] text-sm font-medium text-primary active:scale-[0.98] transition-transform">
                    View all {commitments.length} events
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-muted/50 rounded-2xl p-6 text-center">
                <Calendar size={32} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  No upcoming events
                </p>
                <button className="px-4 py-2.5 min-h-[44px] bg-primary text-primary-foreground rounded-full text-sm font-medium active:scale-[0.97] transition-transform">
                  Explore Events
                </button>
              </div>
            )}
          </div>
        </motion.section>

        {/* Divider */}
        <div className="h-2 bg-muted" />

        {/* Settings Section - Airbnb list style */}
        <motion.section
          {...motionProps(0.3, 10)}
          className="py-6"
        >
          <div className="flex items-center gap-2 px-5 mb-4">
            <Settings size={20} className="text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">Settings</h3>
          </div>
          
          <div className="divide-y divide-border">
            {[
              { label: 'Personal Information', icon: Users, path: '/profile/personal-information' },
              { label: 'Verification & Safety', icon: Shield, path: '/profile/verification-safety' },
              { label: 'Notification Preferences', icon: Heart, path: '/profile/notification-preferences' },
              { label: 'Privacy Settings', icon: CheckCircle, path: '/profile/privacy-settings' },
              { label: 'Share Profile', icon: Share2, path: '/profile/share' },
            ].map((item) => (
              <button 
                key={item.label}
                onClick={() => handleNavigateToSettings(item.path)}
                className="w-full px-5 py-4 min-h-[44px] flex items-center justify-between hover:bg-muted/50 transition-all active:bg-muted/70"
              >
                <div className="flex items-center gap-3">
                  <item.icon size={20} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                </div>
                <ChevronRight size={18} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        </motion.section>

        {/* App Version */}
        <div className="px-5 py-6 text-center">
          <p className="text-xs text-muted-foreground">LCL · Version 1.0.0</p>
        </div>
      </div>

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
    </div>
  );
}

// Calendar List Item Component
interface CalendarListItemProps {
  event: {
    id: string;
    title: string;
    event_date: string;
    event_time: string;
    venue_name: string;
  };
  index: number;
  isToday: boolean;
}

function CalendarListItem({ event, index, isToday }: CalendarListItemProps) {
  const prefersReducedMotion = useReducedMotion();
  const handleClick = async () => {
    await hapticImpact('light');
    toast(`Viewing ${event.title}`, { icon: '📅' });
  };

  return (
    <motion.button 
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.25 + index * 0.05 }}
      onClick={handleClick}
      className="w-full bg-card rounded-xl border border-border p-3.5 min-h-[44px] flex items-center gap-3 hover:border-primary/30 hover:shadow-sm transition-all active:scale-[0.99]"
    >
      {/* Calendar Icon */}
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Calendar size={18} className="text-primary" />
      </div>

      {/* Event Info */}
      <div className="flex-1 min-w-0 text-left">
        <h4 className="font-medium text-foreground text-sm truncate mb-0.5">
          {event.title}
        </h4>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-hidden">
          <Clock size={11} className="flex-shrink-0" />
          <span className="flex-shrink-0">{formatEventDate(event.event_date, event.event_time, isToday)}</span>
          <span className="flex-shrink-0">·</span>
          <MapPin size={11} className="flex-shrink-0" />
          <span className="truncate min-w-0">{event.venue_name}</span>
        </div>
      </div>

      <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
    </motion.button>
  );
}

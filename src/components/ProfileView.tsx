import React, { useState, createElement } from 'react';
import { MapPin, Shield, Zap, ChevronRight, Trophy, Radio, Star, Award, Users, TrendingUp, CheckCircle, Ticket, Flame, LogOut, Loader2, Settings } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { usePersonaStats, usePersonaBadges, useUserCommitments } from '../lib/hooks';
import { getCategoryColor } from '../lib/utils';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

type PersonaMode = 'family' | 'gamer';

const personaModeConfig = {
  family: {
    title: 'Family Mode',
    icon: Users,
    color: 'from-blue-500 to-cyan-500',
  },
  gamer: {
    title: 'Gamer Mode',
    icon: Radio,
    color: 'from-purple-600 to-pink-600',
  }
};

const iconMap: Record<string, React.ComponentType> = {
  Shield,
  Users,
  Trophy,
  Star,
  Radio,
};

// Mock profile for development mode
const MOCK_PROFILE = {
  id: 'dev-profile-001',
  user_id: 'dev-user-001',
  full_name: 'Demo User',
  location_city: 'Amsterdam',
  location_country: 'Netherlands',
  verified_resident: true,
  reliability_score: 95,
  events_attended: 12,
  events_committed: 13,
  avatar_url: null,
  current_persona: 'family',
  location_coordinates: null,
  profile_complete: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function ProfileView() {
  const { profile, signOut } = useAuth();
  const [personaMode, setPersonaMode] = useState<PersonaMode>('family');
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Use mock profile if not authenticated (for development)
  const displayProfile = profile || MOCK_PROFILE;
  const isDemoMode = !profile;

  const { stats: personaStats, loading: statsLoading } = usePersonaStats(
    displayProfile.id,
    personaMode
  );
  const { badges: personaBadges, loading: badgesLoading } = usePersonaBadges(
    displayProfile.id,
    personaMode
  );
  const { commitments, loading: commitmentsLoading } = useUserCommitments(displayProfile.id);

  const currentPersona = personaModeConfig[personaMode];

  const handleSignOut = async () => {
    if (isDemoMode) {
      toast('Demo mode - no account to sign out from', { icon: 'ℹ️' });
      return;
    }
    setIsSigningOut(true);
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out. Please try again.');
      setIsSigningOut(false);
    }
  };

  const handleSettingsClick = (setting: string) => {
    toast(`${setting} coming soon!`, { icon: '🚧' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-32">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-amber-500/90 text-white text-center py-2 text-sm font-medium">
          Demo Mode — Sign in for your real profile
        </div>
      )}
      
      {/* Header - Clean, matching Feed style */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-md mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-foreground leading-none tracking-tight">
              Trust Passport
            </h1>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
              <MapPin size={14} />
              <span>{displayProfile.location_city}, {displayProfile.location_country}</span>
            </div>
          </div>
          
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="p-2.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Sign Out"
          >
            {isSigningOut ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <LogOut size={20} />
            )}
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Profile Card - Soft Glass */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border p-5"
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xl font-bold">
                {displayProfile.full_name.charAt(0).toUpperCase()}
              </div>
              {displayProfile.verified_resident && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-background">
                  <CheckCircle size={12} className="text-white" fill="currentColor" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate">{displayProfile.full_name}</h2>
              {displayProfile.verified_resident && (
                <span className="inline-flex px-2 py-0.5 bg-green-500/10 text-green-600 text-xs font-medium rounded-full border border-green-500/20 mt-1">
                  Verified Resident
                </span>
              )}
            </div>
          </div>

          {/* Reliability Score */}
          <div className="bg-muted/50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Reliability Score
              </span>
              <div className="flex items-center gap-1">
                <TrendingUp size={14} className="text-green-500" />
                <span className="text-xs text-green-500 font-medium">
                  {displayProfile.reliability_score >= 95 ? '+2% this month' : 'Stable'}
                </span>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-foreground">{Math.round(displayProfile.reliability_score)}%</span>
              <span className="text-muted-foreground text-sm">Attendance Rate</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle size={14} className="text-green-500" />
              <span>
                Attended{' '}
                <span className="font-semibold text-foreground">{displayProfile.events_attended} of {displayProfile.events_committed}</span>{' '}
                events
              </span>
            </div>
          </div>

          {/* Persona Switcher */}
          <div className="bg-muted/50 rounded-xl p-1.5 flex gap-1">
            <button 
              onClick={() => setPersonaMode('family')} 
              className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                personaMode === 'family' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users size={16} />
              <span>Family</span>
            </button>
            <button 
              onClick={() => setPersonaMode('gamer')} 
              className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                personaMode === 'gamer' 
                  ? 'bg-background text-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Radio size={16} />
              <span>Gamer</span>
            </button>
          </div>
        </motion.section>

        {/* Persona Badges */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-base font-semibold text-foreground mb-3 px-1 flex items-center gap-2">
            <Award size={16} className="text-primary" />
            {currentPersona.title} Badges
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {badgesLoading ? (
              <div className="col-span-3 bg-card/80 backdrop-blur-xl rounded-2xl border border-border p-6 text-center text-muted-foreground text-sm">
                Loading badges...
              </div>
            ) : personaBadges.length > 0 ? (
              personaBadges.map((badge) => (
                <div 
                  key={badge.id} 
                  className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border p-4 text-center"
                >
                  <div className={`w-10 h-10 mx-auto rounded-full bg-gradient-to-br ${currentPersona.color} flex items-center justify-center text-white mb-2`}>
                    {iconMap[badge.badge_icon] ? createElement(iconMap[badge.badge_icon], { size: 18 }) : badge.badge_icon}
                  </div>
                  <h4 className="font-semibold text-foreground text-xs mb-0.5 truncate">
                    {badge.badge_name}
                  </h4>
                  <p className="text-[10px] text-muted-foreground">{badge.badge_level}</p>
                </div>
              ))
            ) : (
              <div className="col-span-3 bg-card/80 backdrop-blur-xl rounded-2xl border border-border p-6 text-center text-muted-foreground text-sm">
                No badges yet
              </div>
            )}
          </div>
        </motion.section>

        {/* Contributor Stats */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h3 className="text-base font-semibold text-foreground mb-3 px-1 flex items-center gap-2">
            <Flame size={16} className="text-orange-500" />
            Contributor Stats
          </h3>
          {statsLoading ? (
            <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border p-6 text-center text-muted-foreground text-sm">
              Loading stats...
            </div>
          ) : personaStats ? (
            <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border p-5">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-500 mb-0.5">
                    {personaStats.rallies_hosted}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Rallies
                  </div>
                </div>
                <div className="text-center border-x border-border">
                  <div className="text-2xl font-bold text-blue-500 mb-0.5">
                    {personaStats.newcomers_welcomed}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Newcomers
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500 mb-0.5">
                    {personaStats.host_rating.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    Rating
                  </div>
                </div>
              </div>

              {/* Host Level */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {personaStats.rallies_hosted >= 10 ? 'Community Leader' : 'Organizer'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {personaStats.rallies_hosted < 10 ? `${10 - personaStats.rallies_hosted} to level up` : 'Max Level'}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-primary rounded-full transition-all" 
                    style={{ width: `${Math.min((personaStats.rallies_hosted / 10) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border p-6 text-center text-muted-foreground text-sm">
              No stats available
            </div>
          )}
        </motion.section>

        {/* Commitment Wallet */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-base font-semibold text-foreground mb-3 px-1 flex items-center gap-2">
            <Ticket size={16} className="text-primary" />
            Commitment Wallet
          </h3>
          <div className="relative">
            {commitmentsLoading ? (
              <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border p-6 text-center text-muted-foreground text-sm">
                Loading commitments...
              </div>
            ) : commitments.length > 0 ? (
              <>
                <div className="space-y-3">
                  {commitments.slice(0, 3).map((event, index) => (
                    <button 
                      key={event.id} 
                      onClick={() => toast(`Viewing ${event.title}`, { icon: '🎟️' })}
                      className="w-full bg-card/80 backdrop-blur-xl rounded-2xl border border-border overflow-hidden hover:border-primary/30 transition-all active:scale-[0.98]"
                    >
                      <div className="h-1 bg-gradient-to-r from-primary to-primary/60" />
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0 text-left">
                            <h4 className="font-semibold text-foreground text-sm truncate">
                              {event.title}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate">{event.venue_name}</p>
                          </div>
                          <div className="text-right flex-shrink-0 ml-3">
                            <div className="text-sm font-semibold text-foreground">
                              {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {event.event_time}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border border-dashed">
                          <span className="text-xs font-mono text-muted-foreground">
                            {event.ticket_number || '#PENDING'}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-green-500 font-medium">
                            <CheckCircle size={12} />
                            <span>Confirmed</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Wallet Summary */}
                <div className="mt-4 bg-primary/5 rounded-2xl p-4 border border-primary/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {commitments.length} Active Commitments
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Your reliability score depends on showing up!
                      </p>
                    </div>
                    <Zap size={20} className="text-primary" />
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border p-6 text-center text-muted-foreground text-sm">
                No upcoming commitments
              </div>
            )}
          </div>
        </motion.section>

        {/* Settings Options */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <h3 className="text-base font-semibold text-foreground mb-3 px-1 flex items-center gap-2">
            <Settings size={16} className="text-muted-foreground" />
            Account
          </h3>
          <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border divide-y divide-border overflow-hidden">
            <button 
              onClick={() => handleSettingsClick('Verification & Safety')}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">
                Verification & Safety
              </span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
            <button 
              onClick={() => handleSettingsClick('Privacy Settings')}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">
                Privacy Settings
              </span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
            <button 
              onClick={() => handleSettingsClick('Notification Preferences')}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm font-medium text-foreground">
                Notification Preferences
              </span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

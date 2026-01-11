import React, { useState, createElement } from 'react';
import { MapPin, Shield, Zap, ChevronRight, Trophy, Radio, Star, Award, Users, TrendingUp, CheckCircle, Ticket, Flame, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { usePersonaStats, usePersonaBadges, useUserCommitments } from '../lib/hooks';
import { getCategoryColor } from '../lib/utils';
import toast from 'react-hot-toast';

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
  return <div className="w-full min-h-screen bg-[#F8F9FA] pb-32">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-amber-500 text-white text-center py-2 text-sm font-medium">
          Demo Mode — Sign in for your real profile
        </div>
      )}
      
      {/* Header with Persona Switcher */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white">
        <div className="max-w-md mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Trust Passport</h1>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
              title="Sign Out"
            >
              {isSigningOut ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <LogOut size={20} />
              )}
            </button>
          </div>

          {/* Profile Info */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {displayProfile.full_name.charAt(0).toUpperCase()}
              </div>
              {displayProfile.verified_resident && (
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center border-4 border-zinc-900">
                  <CheckCircle size={14} className="text-white" fill="currentColor" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">{displayProfile.full_name}</h2>
              <div className="flex items-center gap-2 text-sm text-white/80 mt-1">
                <MapPin size={14} />
                <span>{displayProfile.location_city}, {displayProfile.location_country}</span>
                {displayProfile.verified_resident && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs font-bold rounded-full border border-green-500/30">
                    Verified Resident
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Reliability Score - PROMINENT */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-4 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white/80">
                Reliability Score
              </span>
              <div className="flex items-center gap-1">
                <TrendingUp size={14} className="text-green-400" />
                <span className="text-xs text-green-400 font-bold">
                  {displayProfile.reliability_score >= 95 ? '+2% this month' : 'Stable'}
                </span>
              </div>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold">{Math.round(displayProfile.reliability_score)}%</span>
              <span className="text-white/60 text-sm">Attendance Rate</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/80">
              <CheckCircle size={14} className="text-green-400" />
              <span>
                Attended{' '}
                <span className="font-bold text-white">{displayProfile.events_attended} of last {displayProfile.events_committed}</span>{' '}
                events
              </span>
            </div>
          </div>

          {/* Persona Switcher */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-1.5 flex gap-1 border border-white/20">
            <button onClick={() => setPersonaMode('family')} className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${personaMode === 'family' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}>
              <Users size={16} />
              <span>Family</span>
            </button>
            <button onClick={() => setPersonaMode('gamer')} className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${personaMode === 'gamer' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}>
              <Radio size={16} />
              <span>Gamer</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Persona Badges */}
        <section>
          <h3 className="text-lg font-bold text-zinc-900 mb-3 px-2 flex items-center gap-2">
            <Award size={18} className="text-purple-600" />
            {currentPersona.title} Badges
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {badgesLoading ? (
              <div className="col-span-3 text-center text-zinc-500 py-4">Loading badges...</div>
            ) : personaBadges.length > 0 ? (
              personaBadges.map((badge) => (
                <div key={badge.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-center">
                  <div className={`w-12 h-12 mx-auto rounded-full bg-gradient-to-br ${currentPersona.color} flex items-center justify-center text-white mb-2 text-xl`}>
                    {iconMap[badge.badge_icon] ? createElement(iconMap[badge.badge_icon], { size: 20 }) : badge.badge_icon}
                  </div>
                  <h4 className="font-bold text-zinc-900 text-xs mb-1">
                    {badge.badge_name}
                  </h4>
                  <p className="text-[10px] text-zinc-500">{badge.badge_level}</p>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center text-zinc-500 py-4">No badges yet</div>
            )}
          </div>
        </section>

        {/* Contributor Stats - HOST FOCUSED */}
        <section>
          <h3 className="text-lg font-bold text-zinc-900 mb-3 px-2 flex items-center gap-2">
            <Flame size={18} className="text-orange-500" />
            Contributor Stats
          </h3>
          {statsLoading ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center text-zinc-500">
              Loading stats...
            </div>
          ) : personaStats ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-orange-600 mb-1">
                    {personaStats.rallies_hosted}
                  </div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wide">
                    Rallies Hosted
                  </div>
                </div>
                <div className="text-center border-x border-gray-200">
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {personaStats.newcomers_welcomed}
                  </div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wide">
                    Newcomers
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    {personaStats.host_rating.toFixed(1)}
                  </div>
                  <div className="text-xs text-zinc-500 uppercase tracking-wide">
                    Host Rating
                  </div>
                </div>
              </div>

              {/* Host Level */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-zinc-900">
                    Host Level: {personaStats.rallies_hosted >= 10 ? 'Community Leader' : 'Organizer'}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {personaStats.rallies_hosted < 10 ? 'Next: Community Leader' : 'Max Level'}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-500 to-pink-500 rounded-full" style={{
                    width: `${Math.min((personaStats.rallies_hosted / 10) * 100, 100)}%`
                  }}></div>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  {personaStats.rallies_hosted < 10 ? `${10 - personaStats.rallies_hosted} more rallies to level up` : 'Maximum level reached!'}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center text-zinc-500">
              No stats available for this persona
            </div>
          )}
        </section>

        {/* Commitment Wallet - UPCOMING TICKETS */}
        <section>
          <h3 className="text-lg font-bold text-zinc-900 mb-3 px-2 flex items-center gap-2">
            <Ticket size={18} className="text-purple-600" />
            Commitment Wallet
          </h3>
          <div className="relative">
            {commitmentsLoading ? (
              <div className="text-center text-zinc-500 py-8">Loading commitments...</div>
            ) : commitments.length > 0 ? (
              <>
                {/* Stacked Ticket Effect */}
                <div className="space-y-3">
                  {commitments.map((event, index) => {
                    const categoryColors = getCategoryColor(event.category);
                    return (
                      <button 
                        key={event.id} 
                        onClick={() => toast(`Viewing ${event.title}`, { icon: '🎟️' })}
                        className="w-full bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden hover:scale-[1.02] transition-transform active:scale-[0.98]" 
                        style={{
                          transform: `translateY(-${index * 4}px)`,
                          zIndex: commitments.length - index
                        }}
                      >
                        <div className={`h-2 bg-gradient-to-r ${categoryColors.bg} to-${categoryColors.bg}/80`}></div>

                        <div className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h4 className="font-bold text-zinc-900 mb-1">
                                {event.title}
                              </h4>
                              <p className="text-xs text-zinc-500">{event.venue_name}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-zinc-900">
                                {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {event.event_time}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-gray-100 border-dashed">
                            <span className="text-xs font-mono text-zinc-400">
                              {event.ticket_number || '#PENDING'}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-green-600 font-bold">
                              <CheckCircle size={12} />
                              <span>Confirmed</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Wallet Summary */}
                <div className="mt-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-4 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-purple-900">
                        {commitments.length} Active Commitments
                      </p>
                      <p className="text-xs text-purple-600">
                        Your reliability score depends on showing up!
                      </p>
                    </div>
                    <Zap size={24} className="text-purple-600" />
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-zinc-500">
                No upcoming commitments
              </div>
            )}
          </div>
        </section>

        {/* Settings Options */}
        <section>
          <h3 className="text-lg font-bold text-zinc-900 mb-3 px-2">Account</h3>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            <button 
              onClick={() => handleSettingsClick('Verification & Safety')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-zinc-900">
                Verification & Safety
              </span>
              <ChevronRight size={16} className="text-zinc-400" />
            </button>
            <button 
              onClick={() => handleSettingsClick('Privacy Settings')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-zinc-900">
                Privacy Settings
              </span>
              <ChevronRight size={16} className="text-zinc-400" />
            </button>
            <button 
              onClick={() => handleSettingsClick('Notification Preferences')}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-zinc-900">
                Notification Preferences
              </span>
              <ChevronRight size={16} className="text-zinc-400" />
            </button>
          </div>
        </section>
      </div>
    </div>;
}
import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { AnchorCard } from './components/AnchorCard';
import { ForkedCard } from './components/ForkedCard';
import { NicheCard } from './components/NicheCard';
import { FloatingNav } from './components/FloatingNav';
import { ProfileView } from './components/ProfileView';
import { DebugConnection } from './components/DebugConnection';
import { LoginView } from './components/LoginView';
import { SignUpView } from './components/SignUpView';
import { ProfileSetupView } from './components/ProfileSetupView';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { useAuth } from './contexts/useAuth';
import { MapPin, Bell, Sun, Sparkles, Plus, Zap } from 'lucide-react';
import { useEvents, useJoinEvent } from './lib/hooks';
import { formatEventTime } from './lib/utils';
import toast from 'react-hot-toast';

// Lazy load heavy components for better initial load performance
const MapView = lazy(() => import('./components/MapView').then(m => ({ default: m.MapView })));
const CreateEventModal = lazy(() => import('./components/CreateEventModal').then(m => ({ default: m.CreateEventModal })));

type View = 'feed' | 'map' | 'profile';
type AuthView = 'login' | 'signup';

export function App() {
  const [activeView, setActiveView] = useState<View>('feed');
  const [authView, setAuthView] = useState<AuthView>('login');
  const { user, profile, loading: authLoading } = useAuth();
  const { events: allEvents, loading } = useEvents();
  const { handleJoinEvent, joiningEvents } = useJoinEvent(profile?.id);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalType, setCreateModalType] = useState<{
    category: 'cinema' | 'market' | 'crafts' | 'sports' | 'gaming';
    type: 'anchor' | 'fork' | 'signal';
  }>({ category: 'cinema', type: 'anchor' });

  // Compute derived data from events (must be called before any early returns)
  const localLifeEvents = useMemo(() => {
    return allEvents.filter(e => e.event_type === 'anchor' && ['cinema', 'market'].includes(e.category));
  }, [allEvents]);

  const tribeEvents = useMemo(() => {
    return allEvents.filter(e => ['crafts', 'sports', 'gaming'].includes(e.category) && e.event_type !== 'fork');
  }, [allEvents]);

  const getSidecarEvents = useCallback((parentId: string) => {
    return allEvents.filter(e => e.parent_event_id === parentId);
  }, [allEvents]);

  const getTimeOfDay = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block bg-[#B4FF39] rounded-2xl px-6 py-3 mb-4">
            <h1 className="text-3xl font-bold text-zinc-900">LCL</h1>
          </div>
          <div className="w-8 h-8 border-4 border-[#B4FF39] border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    if (authView === 'signup') {
      return <SignUpView onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <LoginView onSwitchToSignUp={() => setAuthView('signup')} />;
  }

  if (!profile?.profile_complete) {
    return <ProfileSetupView />;
  }
  // Map View
  if (activeView === 'map') {
    return <>
        <DebugConnection />
        <Suspense fallback={<LoadingSkeleton />}>
          <MapView />
        </Suspense>
        <FloatingNav activeView={activeView} onNavigate={setActiveView} />
      </>;
  }
  // Profile View
  if (activeView === 'profile') {
    return <>
        <DebugConnection />
        <ProfileView />
        <FloatingNav activeView={activeView} onNavigate={setActiveView} />
      </>;
  }

  // Feed View (default)
  return <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 pb-32 font-sans selection:bg-zinc-900 selection:text-white">
      <DebugConnection />
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#F8F9FA]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-gray-200/50">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 leading-tight">
            {getTimeOfDay()}, {profile?.full_name.split(' ')[0] || 'User'}
          </h1>
          <div className="flex items-center gap-1 text-xs font-medium text-zinc-500 mt-0.5">
            <MapPin size={12} />
            <span>{profile?.location_city || 'Unknown'}, {profile?.location_country || 'NL'}</span>
          </div>
        </div>
        <button 
          onClick={() => toast('Notifications coming soon!', { icon: '🔔' })}
          className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-zinc-600 shadow-sm hover:scale-105 transition-transform"
        >
          <Bell size={18} />
        </button>
      </header>

      <main className="px-4 max-w-md mx-auto space-y-12 pt-6">
        {/* SECTION 1: LOCAL LIFE */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded-md text-blue-600">
                <Sun size={14} />
              </div>
              <h2 className="text-lg font-bold text-zinc-900 tracking-tight">
                Local Life
              </h2>
            </div>
            <button
              onClick={() => {
                setCreateModalType({ category: 'cinema', type: 'anchor' });
                setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-zinc-900 hover:bg-gray-50 hover:scale-105 transition-all shadow-sm"
            >
              <Plus size={14} strokeWidth={3} />
              <span>Create</span>
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-zinc-500">Loading events...</div>
          ) : localLifeEvents.length > 0 ? (
            <>
              {localLifeEvents.slice(0, 1).map(event => {
                const sidecars = getSidecarEvents(event.id);
                return (
                  <AnchorCard
                    key={event.id}
                    eventId={event.id}
                    title={event.title}
                    image={event.image_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=1000'}
                    matchPercentage={event.match_percentage}
                    distance={event.venue_name}
                    category={event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                    date={formatEventTime(event.event_date, event.event_time)}
                    onCommit={handleJoinEvent}
                  >
                    {sidecars.length > 0 && (
                      <ForkedCard
                        title={sidecars[0].title}
                        parentEvent={event.title}
                        eventId={sidecars[0].id}
                        onJoin={handleJoinEvent}
                        isJoining={joiningEvents.has(sidecars[0].id)}
                        attendees={[
                          {
                            id: '1',
                            image: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&auto=format&fit=crop&q=60',
                            alt: 'User 1'
                          },
                          {
                            id: '2',
                            image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60',
                            alt: 'User 2'
                          },
                          {
                            id: '3',
                            image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=60',
                            alt: 'User 3'
                          }
                        ]}
                        extraCount={sidecars[0].attendee_count ? sidecars[0].attendee_count - 3 : 0}
                      />
                    )}
                  </AnchorCard>
                );
              })}

              {localLifeEvents.slice(1, 2).map(event => (
                <div key={event.id} className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-1">
                      {event.category}
                    </div>
                    <h3 className="font-bold text-zinc-900">
                      {event.title}
                    </h3>
                    <p className="text-xs text-zinc-500">{event.venue_name} • {formatEventTime(event.event_date, event.event_time)}</p>
                  </div>
                  <button
                    onClick={() => handleJoinEvent(event.id)}
                    disabled={joiningEvents.has(event.id)}
                    className="px-4 py-2 bg-gray-50 text-zinc-900 text-xs font-bold rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    {joiningEvents.has(event.id) ? 'Joining...' : 'Join'}
                  </button>
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-8 text-zinc-500">No local events available. Please seed the database.</div>
          )}
        </section>

        {/* SECTION 2: MY TRIBES */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 rounded-md text-purple-600">
                <Sparkles size={14} />
              </div>
              <h2 className="text-lg font-bold text-zinc-900 tracking-tight">
                My Tribes
              </h2>
            </div>
            <button
              onClick={() => {
                setCreateModalType({ category: 'gaming', type: 'signal' });
                setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full text-xs font-bold text-white hover:scale-105 transition-all shadow-lg hover:shadow-xl"
            >
              <Zap size={14} strokeWidth={3} />
              <span>Create</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-2 text-center py-8 text-zinc-500">Loading tribe events...</div>
            ) : tribeEvents.length > 0 ? (
              <>
                {tribeEvents.map((event, index) => {
                  let variant: 'crafts' | 'sports' | 'gaming' = 'crafts';
                  if (event.category === 'sports') variant = 'sports';
                  else if (event.category === 'gaming') variant = 'gaming';
                  else if (event.category === 'crafts') variant = 'crafts';

                  const colSpan = index === 0 ? 'col-span-2 sm:col-span-1' : 'col-span-1';

                  return (
                    <div key={event.id} className={colSpan}>
                      <NicheCard
                        variant={variant}
                        title={event.title}
                        venue={event.venue_name}
                        status={event.status}
                        date={new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase().replace(',', '')}
                        eventId={event.id}
                        onJoin={handleJoinEvent}
                        isJoining={joiningEvents.has(event.id)}
                      />
                    </div>
                  );
                })}

                {/* Create Card */}
                <div className="col-span-1">
                  <button
                    onClick={() => {
                      setCreateModalType({ category: 'crafts', type: 'signal' });
                      setShowCreateModal(true);
                    }}
                    className="relative w-full aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 shadow-lg group cursor-pointer border-2 border-white hover:scale-105 transition-transform duration-300"
                  >
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors"></div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6">
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Plus size={32} strokeWidth={3} />
                      </div>
                      <h3 className="text-lg font-bold text-center leading-tight">
                        Start Your Own
                      </h3>
                      <p className="text-xs opacity-90 mt-1 text-center">
                        Create a tribe event
                      </p>
                    </div>
                  </button>
                </div>
              </>
            ) : (
              <div className="col-span-2 text-center py-8 text-zinc-500">No tribe events available. Please seed the database.</div>
            )}
          </div>
        </section>
      </main>

      <FloatingNav activeView={activeView} onNavigate={setActiveView} />

      {showCreateModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"><LoadingSkeleton /></div>}>
          <CreateEventModal
            onClose={() => setShowCreateModal(false)}
            defaultCategory={createModalType.category}
            defaultEventType={createModalType.type}
          />
        </Suspense>
      )}
    </div>;
}
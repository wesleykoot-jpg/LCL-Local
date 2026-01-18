import { useState } from 'react';
import { ChevronLeft, Bell, Mail, MessageSquare, Calendar, Heart, Users, Smartphone, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export function NotificationPreferences() {
  const navigate = useNavigate();
  
  const [notifications, setNotifications] = useState({
    // Push Notifications
    pushEnabled: true,
    newEvents: true,
    eventReminders: true,
    eventUpdates: true,
    newMessages: true,
    friendRequests: true,
    eventInvites: true,
    
    // Email Notifications
    emailEnabled: true,
    weeklyDigest: true,
    eventRecommendations: true,
    communityUpdates: false,
    
    // Sound & Haptics
    soundEnabled: true,
    hapticsEnabled: true,
  });

  type NotificationKeys = keyof typeof notifications;

  const handleToggle = (key: NotificationKeys) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    toast.success('Notification preference updated');
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95  border-b border-border">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-primary" />
            <h1 className="font-display text-xl text-foreground tracking-tight">
              Notifications
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {/* Push Notifications */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-card overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-primary" />
                <h2 className="font-semibold text-foreground">Push Notifications</h2>
              </div>
              <button
                onClick={() => handleToggle('pushEnabled')}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  notifications.pushEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    notifications.pushEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
          
          {notifications.pushEnabled && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-start gap-3 flex-1">
                  <Calendar size={18} className="text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">New Events</p>
                    <p className="text-xs text-muted-foreground">When events are created near you</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle('newEvents')}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    notifications.newEvents ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.newEvents ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-start gap-3 flex-1">
                  <Bell size={18} className="text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Event Reminders</p>
                    <p className="text-xs text-muted-foreground">Reminders for your upcoming events</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle('eventReminders')}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    notifications.eventReminders ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.eventReminders ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-start gap-3 flex-1">
                  <Calendar size={18} className="text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Event Updates</p>
                    <p className="text-xs text-muted-foreground">Changes to events you're attending</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle('eventUpdates')}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    notifications.eventUpdates ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.eventUpdates ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-start gap-3 flex-1">
                  <MessageSquare size={18} className="text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Messages</p>
                    <p className="text-xs text-muted-foreground">When you receive a new message</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle('newMessages')}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    notifications.newMessages ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.newMessages ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-start gap-3 flex-1">
                  <Users size={18} className="text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Friend Requests</p>
                    <p className="text-xs text-muted-foreground">When someone wants to connect</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle('friendRequests')}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    notifications.friendRequests ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.friendRequests ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-start gap-3 flex-1">
                  <Heart size={18} className="text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Event Invites</p>
                    <p className="text-xs text-muted-foreground">When you're invited to events</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle('eventInvites')}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    notifications.eventInvites ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.eventInvites ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </motion.section>

        {/* Email Notifications */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-card overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail size={18} className="text-primary" />
                <h2 className="font-semibold text-foreground">Email Notifications</h2>
              </div>
              <button
                onClick={() => handleToggle('emailEnabled')}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  notifications.emailEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    notifications.emailEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
          
          {notifications.emailEnabled && (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Weekly Digest</p>
                  <p className="text-xs text-muted-foreground">Summary of events and updates</p>
                </div>
                <button
                  onClick={() => handleToggle('weeklyDigest')}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    notifications.weeklyDigest ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.weeklyDigest ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Event Recommendations</p>
                  <p className="text-xs text-muted-foreground">Personalized event suggestions</p>
                </div>
                <button
                  onClick={() => handleToggle('eventRecommendations')}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    notifications.eventRecommendations ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.eventRecommendations ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Community Updates</p>
                  <p className="text-xs text-muted-foreground">News and announcements</p>
                </div>
                <button
                  onClick={() => handleToggle('communityUpdates')}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    notifications.communityUpdates ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      notifications.communityUpdates ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </motion.section>

        {/* Sound & Haptics */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-card overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Volume2 size={18} className="text-primary" />
              <h2 className="font-semibold text-foreground">Sound & Feedback</h2>
            </div>
          </div>
          
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Notification Sounds</p>
                <p className="text-xs text-muted-foreground">Play sound for notifications</p>
              </div>
              <button
                onClick={() => handleToggle('soundEnabled')}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  notifications.soundEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    notifications.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Haptic Feedback</p>
                <p className="text-xs text-muted-foreground">Vibration for interactions</p>
              </div>
              <button
                onClick={() => handleToggle('hapticsEnabled')}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  notifications.hapticsEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    notifications.hapticsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </motion.section>

        {/* Privacy Notice */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-muted/50 rounded-lg p-4"
        >
          <p className="text-xs text-muted-foreground">
            <strong>Privacy:</strong> You can change these settings at any time. We respect your preferences 
            and will only send notifications you've opted into. You can also manage notification permissions 
            in your device settings.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default NotificationPreferences;

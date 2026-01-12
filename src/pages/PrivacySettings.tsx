import React, { useState } from 'react';
import { ChevronLeft, Shield, Eye, EyeOff, Lock, Database, Share2, Download, Trash2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export function PrivacySettings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    profileVisibility: 'public',
    showLocation: true,
    showEvents: true,
    allowMessaging: 'everyone',
    dataProcessing: true,
    marketingEmails: false,
    analyticsTracking: true,
  });

  type BooleanSettingKeys = 'showLocation' | 'showEvents' | 'dataProcessing' | 'marketingEmails' | 'analyticsTracking';
  
  const handleToggle = (key: BooleanSettingKeys) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    toast.success('Privacy setting updated');
  };

  const handleSelectChange = (key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    toast.success('Privacy setting updated');
  };

  const handleDataExport = () => {
    toast.success('Your data export request has been submitted. You will receive an email with your data within 30 days as required by GDPR.');
  };

  const handleDataDeletion = () => {
    toast.success('Data deletion request submitted. Your account will be deleted within 30 days.');
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-primary" />
            <h1 className="font-display text-xl text-foreground tracking-tight">
              Privacy Settings
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {/* GDPR Notice */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary/10 border border-primary/20 rounded-2xl p-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-foreground mb-1">Your Privacy Rights (GDPR)</h3>
              <p className="text-sm text-muted-foreground">
                In accordance with the General Data Protection Regulation (GDPR), you have the right to access, 
                rectify, erase, restrict processing, data portability, and object to processing of your personal data.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Profile Visibility */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-primary" />
              <h2 className="font-semibold text-foreground">Profile Visibility</h2>
            </div>
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Who can see your profile?
              </label>
              <select
                value={settings.profileVisibility}
                onChange={(e) => handleSelectChange('profileVisibility', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
              >
                <option value="public">Everyone (Public)</option>
                <option value="members">LCL Members Only</option>
                <option value="private">Private (Only You)</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Controls who can view your full profile information
              </p>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Show Location</p>
                <p className="text-xs text-muted-foreground">Display city and country on profile</p>
              </div>
              <button
                onClick={() => handleToggle('showLocation')}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.showLocation ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    settings.showLocation ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Show Events</p>
                <p className="text-xs text-muted-foreground">Display your upcoming events</p>
              </div>
              <button
                onClick={() => handleToggle('showEvents')}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.showEvents ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    settings.showEvents ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </motion.section>

        {/* Communication Preferences */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-2xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Share2 size={18} className="text-primary" />
              <h2 className="font-semibold text-foreground">Communication</h2>
            </div>
          </div>
          
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Who can message you?
              </label>
              <select
                value={settings.allowMessaging}
                onChange={(e) => handleSelectChange('allowMessaging', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground"
              >
                <option value="everyone">Everyone</option>
                <option value="members">Members Only</option>
                <option value="connections">Connections Only</option>
                <option value="none">No One</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Marketing Emails</p>
                <p className="text-xs text-muted-foreground">Receive promotional content</p>
              </div>
              <button
                onClick={() => handleToggle('marketingEmails')}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.marketingEmails ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    settings.marketingEmails ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </motion.section>

        {/* Data Processing & Analytics */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-2xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Database size={18} className="text-primary" />
              <h2 className="font-semibold text-foreground">Data Processing</h2>
            </div>
          </div>
          
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Analytics Tracking</p>
                <p className="text-xs text-muted-foreground">
                  Help improve the app with anonymous usage data
                </p>
              </div>
              <button
                onClick={() => handleToggle('analyticsTracking')}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.analyticsTracking ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    settings.analyticsTracking ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Legal Basis:</strong> We process your personal data based on your consent (Art. 6(1)(a) GDPR) 
                and for contract performance (Art. 6(1)(b) GDPR). You may withdraw consent at any time.
              </p>
            </div>
          </div>
        </motion.section>

        {/* Data Rights (GDPR) */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-2xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-primary" />
              <h2 className="font-semibold text-foreground">Your Data Rights</h2>
            </div>
          </div>
          
          <div className="p-4 space-y-3">
            <button
              onClick={handleDataExport}
              className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Download size={18} className="text-primary" />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Download Your Data</p>
                  <p className="text-xs text-muted-foreground">Export all personal information (GDPR Art. 20)</p>
                </div>
              </div>
            </button>

            <button
              onClick={handleDataDeletion}
              className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Trash2 size={18} className="text-destructive" />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Delete Your Account</p>
                  <p className="text-xs text-muted-foreground">Permanently erase all data (GDPR Art. 17)</p>
                </div>
              </div>
            </button>
          </div>
        </motion.section>

        {/* Additional Information */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-muted/50 rounded-2xl p-4"
        >
          <h3 className="font-semibold text-foreground mb-2 text-sm">Data Protection Officer</h3>
          <p className="text-xs text-muted-foreground mb-2">
            For questions about your data, contact our Data Protection Officer at:
          </p>
          <p className="text-xs text-primary font-medium">privacy@lcl-local.com</p>
          
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="font-semibold text-foreground mb-2 text-sm">Supervisory Authority</h3>
            <p className="text-xs text-muted-foreground">
              You have the right to lodge a complaint with the Dutch Data Protection Authority 
              (Autoriteit Persoonsgegevens) or your local EU supervisory authority.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="font-semibold text-foreground mb-2 text-sm">Data Retention</h3>
            <p className="text-xs text-muted-foreground">
              We retain your personal data only as long as necessary for the purposes outlined in our Privacy Policy, 
              or as required by law. Event data is retained for 2 years, account data until deletion is requested.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default PrivacySettings;

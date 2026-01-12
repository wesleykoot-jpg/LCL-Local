import React, { useState } from 'react';
import { ChevronLeft, Share2, Copy, QrCode, Mail, MessageSquare, Facebook, Twitter, Link2, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/useAuth';

export function ShareProfile() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  
  const profileUrl = `https://lcl-local.com/profile/${profile?.id || 'demo-user'}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    toast.success('Profile link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = (platform: string) => {
    const text = `Check out my profile on LCL Local!`;
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(profileUrl);
    
    let shareUrl = '';
    
    switch (platform) {
      case 'email':
        shareUrl = `mailto:?subject=${encodedText}&body=${encodedUrl}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
        break;
      default:
        toast.success(`Sharing via ${platform}`);
        return;
    }
    
    window.open(shareUrl, '_blank');
    toast.success(`Opening ${platform}...`);
  };

  const handleShowQR = () => {
    toast.success('QR Code feature coming soon!');
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
            <Share2 size={20} className="text-primary" />
            <h1 className="font-display text-xl text-foreground tracking-tight">
              Share Profile
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {/* Profile Preview */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-5 text-center"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-3xl font-bold shadow-lg mb-3">
            {profile?.full_name?.charAt(0).toUpperCase() || 'D'}
          </div>
          <h2 className="text-xl font-bold text-foreground mb-1">
            {profile?.full_name || 'Demo User'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {profile?.location_city || 'Meppel'}, {profile?.location_country || 'Netherlands'}
          </p>
        </motion.section>

        {/* Copy Link */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-4"
        >
          <label className="block text-sm font-medium text-foreground mb-2">
            Profile Link
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2.5 bg-muted rounded-lg text-sm text-muted-foreground truncate">
              {profileUrl}
            </div>
            <button
              onClick={handleCopyLink}
              className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2 flex-shrink-0"
            >
              {copied ? (
                <>
                  <CheckCircle size={16} />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copy
                </>
              )}
            </button>
          </div>
        </motion.section>

        {/* QR Code */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={handleShowQR}
            className="w-full bg-card border border-border rounded-2xl p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <QrCode size={20} className="text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">Show QR Code</p>
                <p className="text-xs text-muted-foreground">Let others scan your profile</p>
              </div>
            </div>
            <ChevronLeft size={18} className="text-muted-foreground rotate-180" />
          </button>
        </motion.section>

        {/* Share Options */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-2xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground">Share Via</h2>
          </div>
          
          <div className="divide-y divide-border">
            <button
              onClick={() => handleShare('email')}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Mail size={20} className="text-blue-600" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-foreground">Email</p>
                <p className="text-xs text-muted-foreground">Send via email</p>
              </div>
            </button>

            <button
              onClick={() => handleShare('whatsapp')}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <MessageSquare size={20} className="text-green-600" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-foreground">WhatsApp</p>
                <p className="text-xs text-muted-foreground">Share on WhatsApp</p>
              </div>
            </button>

            <button
              onClick={() => handleShare('twitter')}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-sky-500/10 flex items-center justify-center">
                <Twitter size={20} className="text-sky-600" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-foreground">Twitter</p>
                <p className="text-xs text-muted-foreground">Share on Twitter</p>
              </div>
            </button>

            <button
              onClick={() => handleShare('facebook')}
              className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center">
                <Facebook size={20} className="text-blue-700" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-foreground">Facebook</p>
                <p className="text-xs text-muted-foreground">Share on Facebook</p>
              </div>
            </button>
          </div>
        </motion.section>

        {/* Privacy Note */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-muted/50 rounded-lg p-4"
        >
          <p className="text-xs text-muted-foreground">
            <strong>Privacy Note:</strong> Only the information you've set as public in your Privacy Settings 
            will be visible to people who view your profile link. You can change your visibility settings at any time.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default ShareProfile;

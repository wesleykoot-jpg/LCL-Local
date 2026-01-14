import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { ChevronLeft, Share2, Copy, QrCode, Mail, MessageSquare, Facebook, Twitter, CheckCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/features/auth';
import { createPortal } from 'react-dom';

const QRCodeCanvas = lazy(() => import('qrcode.react').then((mod) => ({ default: mod.QRCodeCanvas })));

export function ShareProfile() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const motionProps = (delay = 0) =>
    prefersReducedMotion
      ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } }
      : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay } };
  
  const DEFAULT_BASE_URL = 'https://lcl-local.com';
  const baseUrl = import.meta.env.VITE_APP_BASE_URL || DEFAULT_BASE_URL;
  const profileUrl = `${baseUrl}/profile/${profile?.id || 'demo-user'}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success('Profile link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy link. Please try again.');
    }
  };

  const handleNativeShare = async () => {
    const text = `Check out my profile on LCL Local!`;
    const url = profileUrl;
    if (navigator.share) {
      try {
        await navigator.share({ title: profile?.full_name || 'Profile', text, url });
        toast.success('Shared!');
        return;
      } catch (e) {
        console.warn('Native share failed, falling back', e);
        // User cancelled share or share failed; fall back to copying the link, then Twitter if needed
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Profile link copied to clipboard');
    } catch {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
      toast.success('Opening share options...');
    }
  };

  const handleShare = (platform: string) => {
    if (platform === 'native') {
      handleNativeShare().catch((error) => console.error('Share failed', error));
      return;
    }
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
    setShowQr(true);
  };

  const triggerNativeShare = () => handleNativeShare().catch((error) => console.error('Share failed', error));

  return (
    <div
      className="min-h-screen bg-background text-foreground font-sans pb-8"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border pt-safe">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="w-11 h-11 min-h-[44px] min-w-[44px] -ml-2 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
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
          {...motionProps()}
          className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-5 text-center"
        >
          <div
            role="img"
            aria-label={`Avatar of ${profile?.full_name || 'Demo User'}`}
            className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-3xl font-bold shadow-lg mb-3 overflow-hidden"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`Avatar of ${profile.full_name || 'Demo User'}`}
                className="w-full h-full object-cover"
              />
            ) : (
              profile?.full_name?.charAt(0).toUpperCase() || 'D'
            )}
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
          {...motionProps(0.1)}
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
              onClick={triggerNativeShare}
              aria-label="Share profile link"
              className="px-4 py-2.5 min-h-[44px] bg-secondary text-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2 flex-shrink-0 border border-border"
            >
              <Share2 size={16} />
              Share
            </button>
            <button
              onClick={handleCopyLink}
              aria-label="Copy profile link"
              className="px-4 py-2.5 min-h-[44px] bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2 flex-shrink-0"
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
          {...motionProps(0.2)}
        >
          <button
            onClick={handleShowQR}
            aria-label="Show QR code"
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
          {...motionProps(0.3)}
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
          {...motionProps(0.4)}
          className="bg-muted/50 rounded-lg p-4"
        >
          <p className="text-xs text-muted-foreground">
            <strong>Privacy Note:</strong> Only the information you've set as public in your Privacy Settings 
            will be visible to people who view your profile link. You can change your visibility settings at any time.
          </p>
        </motion.div>

        <QrModal
          open={showQr}
          profileUrl={profileUrl}
          onClose={() => setShowQr(false)}
          onCopy={handleCopyLink}
          onShare={triggerNativeShare}
        />
      </div>
    </div>
  );
}

interface QrModalProps {
  open: boolean;
  profileUrl: string;
  onClose: () => void;
  onCopy: () => Promise<void>;
  onShare: () => Promise<void> | void;
}

function QrModal({ open, onClose, profileUrl, onCopy, onShare }: QrModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button, [href], [tabindex]:not([tabindex="-1"])'
    );

    focusable?.[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }

      if (event.key === 'Tab' && focusable && focusable.length > 0) {
        const elements = Array.from(focusable);
        const currentIndex = elements.indexOf(document.activeElement as HTMLElement);
        let nextIndex = currentIndex + (event.shiftKey ? -1 : 1);
        if (nextIndex >= elements.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = elements.length - 1;
        event.preventDefault();
        elements[nextIndex]?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-modal-title"
        className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-lg p-5 focus:outline-none"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="qr-modal-title" className="text-lg font-semibold text-foreground">
              Share QR Code
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Scan or share this code to open your profile.
            </p>
          </div>
          <button
            aria-label="Close QR modal"
            className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <Suspense
            fallback={
              <div
                className="w-56 h-56 rounded-2xl bg-muted animate-pulse"
                aria-busy="true"
                aria-label="Loading QR code"
              />
            }
          >
            <QRCodeCanvas value={profileUrl} size={224} includeMargin />
          </Suspense>
          <p className="text-xs text-muted-foreground mt-3 text-center break-words">
            {profileUrl}
          </p>
          <div className="mt-4 flex w-full gap-2">
            <button
              aria-label="Copy profile link from QR modal"
              onClick={onCopy}
              className="flex-1 min-h-[44px] rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Copy Link
            </button>
            <button
              aria-label="Share profile"
              onClick={onShare}
              className="flex-1 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Share
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ShareProfile;

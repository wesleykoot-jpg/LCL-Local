import { useState } from 'react';
import { ChevronLeft, Shield, CheckCircle, AlertTriangle, FileCheck, Camera, Phone, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '@/features/auth';

export function VerificationSafety() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [verifications] = useState({
    email: true,
    phone: false,
    identity: false,
    address: profile?.verified_resident || false,
  });

  const handleVerificationRequest = (type: string) => {
    toast.success(`${type} verification initiated. You'll receive instructions shortly.`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans pb-8">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95  border-b border-border pt-safe">
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
              Verification & Safety
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {/* Trust Score */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-foreground mb-1">Trust Level</h2>
              <p className="text-sm text-muted-foreground">
                Build trust by completing verifications
              </p>
            </div>
            <div className="text-4xl font-bold text-primary">
              {profile?.reliability_score || 85}%
            </div>
          </div>
          
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${profile?.reliability_score || 85}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-primary to-primary/80"
            />
          </div>
        </motion.section>

        {/* Verifications */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-card overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-foreground">Verification Status</h2>
          </div>
          
          <div className="divide-y divide-border">
            {/* Email Verification */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <FileCheck size={18} className="text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground">Email Address</p>
                    {verifications.email && (
                      <CheckCircle size={16} className="text-green-600" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {verifications.email ? 'Verified' : 'Verification required'}
                  </p>
                </div>
              </div>
              {!verifications.email && (
                <button
                  onClick={() => handleVerificationRequest('Email')}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-xs font-medium"
                >
                  Verify
                </button>
              )}
            </div>

            {/* Phone Verification */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className={`w-10 h-10 rounded-full ${
                  verifications.phone ? 'bg-green-500/10' : 'bg-muted'
                } flex items-center justify-center flex-shrink-0`}>
                  <Phone size={18} className={verifications.phone ? 'text-green-600' : 'text-muted-foreground'} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground">Phone Number</p>
                    {verifications.phone && (
                      <CheckCircle size={16} className="text-green-600" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {verifications.phone ? 'Verified' : 'Increases trust by 15%'}
                  </p>
                </div>
              </div>
              {!verifications.phone && (
                <button
                  onClick={() => handleVerificationRequest('Phone')}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-xs font-medium"
                >
                  Verify
                </button>
              )}
            </div>

            {/* Identity Verification */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className={`w-10 h-10 rounded-full ${
                  verifications.identity ? 'bg-green-500/10' : 'bg-muted'
                } flex items-center justify-center flex-shrink-0`}>
                  <Camera size={18} className={verifications.identity ? 'text-green-600' : 'text-muted-foreground'} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground">Government ID</p>
                    {verifications.identity && (
                      <CheckCircle size={16} className="text-green-600" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {verifications.identity ? 'Verified' : 'Upload passport or ID card'}
                  </p>
                </div>
              </div>
              {!verifications.identity && (
                <button
                  onClick={() => handleVerificationRequest('Identity')}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-xs font-medium"
                >
                  Verify
                </button>
              )}
            </div>

            {/* Address Verification */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className={`w-10 h-10 rounded-full ${
                  verifications.address ? 'bg-green-500/10' : 'bg-muted'
                } flex items-center justify-center flex-shrink-0`}>
                  <CreditCard size={18} className={verifications.address ? 'text-green-600' : 'text-muted-foreground'} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-foreground">Resident Verification</p>
                    {verifications.address && (
                      <CheckCircle size={16} className="text-green-600" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {verifications.address ? 'Verified local resident' : 'Prove you live in the area'}
                  </p>
                </div>
              </div>
              {!verifications.address && (
                <button
                  onClick={() => handleVerificationRequest('Address')}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-full text-xs font-medium"
                >
                  Verify
                </button>
              )}
            </div>
          </div>
        </motion.section>

        {/* Safety Tips */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-card p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-amber-500" />
            <h2 className="font-semibold text-foreground">Safety Tips</h2>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Always meet in public places for first-time meetups
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Check event host verification status before attending
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Never share personal financial information
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Report suspicious behavior immediately
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Trust your instincts - if something feels wrong, it probably is
              </p>
            </div>
          </div>
        </motion.section>

        {/* Report Issue */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={() => toast.success('Report form opened')}
            className="w-full px-6 py-3.5 bg-destructive/10 text-destructive rounded-full font-semibold hover:bg-destructive/20 transition-colors"
          >
            Report a Safety Issue
          </button>
        </motion.div>

        {/* Additional Information */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-muted/50 rounded-lg p-4"
        >
          <p className="text-xs text-muted-foreground">
            <strong>Your Security:</strong> All verification data is encrypted and processed securely. 
            We comply with EU data protection standards (GDPR) and never share your verification 
            documents with other users or third parties.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default VerificationSafety;

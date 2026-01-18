import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, MapPin, Check, Loader2, Navigation, Shield, AlertCircle } from 'lucide-react';
import { CATEGORIES, type CategoryConfig } from '@/shared/lib/categories';
import { cn } from '@/shared/lib/utils';
import { useGeolocation, type UserLocation } from '@/features/location/hooks/useGeolocation';
import { useLocation } from '@/features/location';
import toast from 'react-hot-toast';

interface OnboardingWizardProps {
  onComplete: (selectedCategories: string[], zone: string, coordinates?: UserLocation) => void;
  onClose: () => void;
}

/**
 * Reverse geocode coordinates to get city name using BigDataCloud API
 * @param lat Latitude
 * @param lng Longitude
 * @returns City name or null if failed
 */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    
    if (!response.ok) {
      console.warn('[OnboardingWizard] Reverse geocode failed:', response.statusText);
      return null;
    }
    
    const data = await response.json();
    
    // Prefer city, then locality, then principalSubdivision
    const cityName = data.city || data.locality || data.principalSubdivision || null;
    
    return cityName;
  } catch (error) {
    console.warn('[OnboardingWizard] Reverse geocode error:', error);
    return null;
  }
}

export function OnboardingWizard({ onComplete, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [zone, setZone] = useState('');
  const [coordinates, setCoordinates] = useState<UserLocation | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  // Use geolocation hook for getting position
  const { getCurrentPosition, requestPermission, permissionState } = useGeolocation();
  
  // Use location context to update global location state
  const { setManualZone } = useLocation();

  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  /**
   * Handle "Use Current Location" button click
   * Gets GPS coordinates and reverse geocodes to city name
   */
  const handleUseCurrentLocation = useCallback(async () => {
    setIsGettingLocation(true);
    
    try {
      // Request permission if needed
      if (permissionState === 'prompt' || permissionState === 'unknown') {
        const granted = await requestPermission();
        if (!granted) {
          toast.error('Please enable location services or type your city manually.');
          setIsGettingLocation(false);
          return;
        }
      } else if (permissionState === 'denied') {
        toast.error('Please enable location services or type your city manually.');
        setIsGettingLocation(false);
        return;
      }
      
      // Get current position
      const position = await getCurrentPosition();
      
      if (!position) {
        toast.error('Unable to get your location. Please type your city manually.');
        setIsGettingLocation(false);
        return;
      }
      
      // Store coordinates
      setCoordinates(position);
      
      // Reverse geocode to get city name
      const cityName = await reverseGeocode(position.lat, position.lng);
      
      if (cityName) {
        setZone(cityName);
        toast.success(`Location set to ${cityName}`);
      } else {
        // If reverse geocoding fails, just use coordinates display
        setZone(`${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}`);
        toast.success('Location detected successfully');
      }
    } catch (error) {
      console.error('[OnboardingWizard] Error getting location:', error);
      toast.error('Please enable location services or type your city manually.');
    } finally {
      setIsGettingLocation(false);
    }
  }, [permissionState, requestPermission, getCurrentPosition]);

  const handleNext = () => {
    if (step === 1 && selectedCategories.size > 0) {
      setStep(2);
    } else if (step === 2 && zone.trim()) {
      setStep(3);
    } else if (step === 3 && agreedToTerms) {
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleFinish = () => {
    const trimmedZone = zone.trim();
    
    // Update global location context with the zone and coordinates
    // Only set if we have both valid zone and coordinates
    if (coordinates && trimmedZone) {
      setManualZone(trimmedZone, coordinates);
    }
    
    // Call onComplete with coordinates if available
    onComplete(Array.from(selectedCategories), trimmedZone, coordinates || undefined);
  };

  const canProceed = step === 1 
    ? selectedCategories.size > 0 
    : step === 2 
    ? zone.trim().length > 0 
    : step === 3
    ? agreedToTerms
    : true;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 "
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-lg bg-background rounded-t-card sm:rounded-card overflow-hidden max-h-[90vh] flex flex-col"
        style={{
          boxShadow: '0 -8px 40px -8px rgba(0, 0, 0, 0.2)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-4">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
              >
                <ChevronRight size={20} className="rotate-180 text-foreground" />
              </button>
            )}
            <div>
              <p className="text-[13px] text-muted-foreground font-medium">
                Step {step} of 4
              </p>
              <h2 className="text-[20px] font-bold text-foreground">
                {step === 1 && 'What are you interested in?'}
                {step === 2 && 'Where are you located?'}
                {step === 3 && 'Terms & Safety'}
                {step === 4 && 'All set!'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X size={16} className="text-foreground" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: '25%' }}
            animate={{ width: `${(step / 4) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-2 gap-3"
              >
                {CATEGORIES.map((cat: CategoryConfig) => {
                  const isSelected = selectedCategories.has(cat.id);
                  
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={cn(
                        'relative p-4 rounded-card transition-all text-left min-h-[80px]',
                        'hover:scale-[1.02] active:scale-[0.98]',
                        'border-2',
                        isSelected
                          ? 'bg-primary/5 border-primary'
                          : 'bg-card border-border hover:border-muted-foreground/30'
                      )}
                    >
                      {/* Check mark for selected */}
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check size={14} className="text-primary-foreground" />
                        </div>
                      )}
                      
                      {/* Color dot indicator */}
                      <div className="flex items-center gap-3 mb-2">
                        <span className={cn('w-3 h-3 rounded-full', cat.dotClass)} />
                      </div>
                      
                      {/* Label */}
                      <div className={cn(
                        'text-[15px] font-semibold transition-colors',
                        isSelected ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {cat.label}
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <MapPin size={36} className="text-primary" />
                </div>
                
                {/* Use Current Location Button */}
                <div className="w-full max-w-sm mb-4">
                  <button
                    onClick={handleUseCurrentLocation}
                    disabled={isGettingLocation}
                    className={cn(
                      'w-full py-4 rounded-xl font-semibold text-[16px] transition-all',
                      'flex items-center justify-center gap-2',
                      'bg-primary/10 border-2 border-primary text-primary',
                      'hover:bg-primary/20 active:scale-[0.98]',
                      isGettingLocation && 'opacity-70 cursor-not-allowed'
                    )}
                  >
                    {isGettingLocation ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        <span>Getting location...</span>
                      </>
                    ) : (
                      <>
                        <Navigation size={20} />
                        <span>📍 Use Current Location</span>
                      </>
                    )}
                  </button>
                </div>
                
                {/* Divider */}
                <div className="w-full max-w-sm flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[13px] text-muted-foreground font-medium">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                
                <div className="w-full max-w-sm">
                  <label className="block text-[13px] text-muted-foreground font-medium mb-2">
                    City or postcode
                  </label>
                  <input
                    type="text"
                    value={zone}
                    onChange={(e) => {
                      setZone(e.target.value);
                      // Clear coordinates if user manually types
                      if (coordinates) {
                        setCoordinates(null);
                      }
                    }}
                    placeholder="e.g., Amsterdam, 1012 AB"
                    className="w-full px-4 py-4 bg-card border-2 border-border rounded-xl text-foreground placeholder:text-muted-foreground text-[16px] focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                
                {/* Success indicator when coordinates are set */}
                {coordinates && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 mt-3 text-[13px] text-green-600 font-medium"
                  >
                    <Check size={16} />
                    <span>Location coordinates captured</span>
                  </motion.div>
                )}
                
                <p className="text-muted-foreground text-[13px] mt-4 text-center">
                  We'll show events happening near this location
                </p>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center justify-center py-8 px-4"
              >
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Shield size={36} className="text-primary" />
                </div>
                
                <h3 className="text-[22px] font-bold text-foreground mb-2 text-center">
                  Safety & Terms
                </h3>
                <p className="text-muted-foreground text-[15px] max-w-md mb-6 text-center">
                  Before you join LCL, please review and accept our terms
                </p>

                <div className="w-full max-w-md space-y-4">
                  {/* Terms Checkbox */}
                  <div className="bg-card border-2 border-border rounded-xl p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-1 w-5 h-5 rounded border-2 border-border text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0 cursor-pointer"
                      />
                      <div className="flex-1">
                        <p className="text-[15px] text-foreground font-medium mb-2">
                          I agree to the Terms of Service and EULA
                        </p>
                        <p className="text-[13px] text-muted-foreground leading-relaxed">
                          I understand that LCL does not tolerate objectionable content, harassment, or illegal activity. 
                          I agree to follow community guidelines and acknowledge that violations may result in account suspension.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Links to legal documents */}
                  <div className="flex flex-wrap gap-3 justify-center text-[13px]">
                    <a 
                      href="/terms" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      Terms of Service
                    </a>
                    <span className="text-muted-foreground">•</span>
                    <a 
                      href="/eula" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      End User License Agreement
                    </a>
                    <span className="text-muted-foreground">•</span>
                    <a 
                      href="/privacy" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      Privacy Policy
                    </a>
                  </div>

                  {/* Safety highlights */}
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-foreground text-[14px] mb-1">Community Safety</h4>
                        <p className="text-[13px] text-muted-foreground">
                          Objectionable content including hate speech, harassment, violence, or illegal activity 
                          will result in immediate action. We maintain a safe, inclusive environment for all users.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
                  className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6"
                >
                  <Check size={40} className="text-green-600" />
                </motion.div>
                <h3 className="text-[24px] font-bold text-foreground mb-2">Perfect!</h3>
                <p className="text-muted-foreground text-[15px] max-w-xs mb-6">
                  Your personalized feed is ready with {selectedCategories.size} categories near {zone}
                </p>
                
                {/* Smart Feed Explainer */}
                <div className="max-w-md px-4 py-4 mb-6 bg-primary/5 border border-primary/10 rounded-card">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">✨</span>
                    </div>
                    <div className="text-left">
                      <h4 className="text-[15px] font-semibold text-foreground mb-1">Smart Feed Learning</h4>
                      <p className="text-[13px] text-muted-foreground">
                        Your feed will learn from your interests as you explore events. Switch between Family and Social modes anytime to get perfectly tailored recommendations.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                  {Array.from(selectedCategories).slice(0, 5).map(catId => {
                    const cat = CATEGORIES.find(c => c.id === catId);
                    if (!cat) return null;
                    return (
                      <span 
                        key={catId} 
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-[13px] font-medium text-foreground"
                      >
                        <span className={cn('w-2 h-2 rounded-full', cat.dotClass)} />
                        {cat.label}
                      </span>
                    );
                  })}
                  {selectedCategories.size > 5 && (
                    <span className="px-3 py-1.5 rounded-full text-[13px] font-medium bg-muted text-muted-foreground">
                      +{selectedCategories.size - 5} more
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border pb-safe">
          <button
            onClick={step === 4 ? handleFinish : handleNext}
            disabled={!canProceed}
            className={cn(
              'w-full py-4 rounded-xl font-semibold text-[16px] transition-all min-h-[52px]',
              'flex items-center justify-center gap-2',
              canProceed
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            <span>{step === 4 ? 'Start Exploring' : 'Continue'}</span>
            {step !== 4 && <ChevronRight size={18} />}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

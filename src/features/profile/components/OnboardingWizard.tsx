import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, MapPin, Check } from 'lucide-react';
import { CATEGORIES, type CategoryConfig } from '@/shared/lib/categories';
import { cn } from '@/shared/lib/utils';

interface OnboardingWizardProps {
  onComplete: (selectedCategories: string[], zone: string) => void;
  onClose: () => void;
}

export function OnboardingWizard({ onComplete, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [zone, setZone] = useState('');

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

  const handleNext = () => {
    if (step === 1 && selectedCategories.size > 0) {
      setStep(2);
    } else if (step === 2 && zone.trim()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleFinish = () => {
    onComplete(Array.from(selectedCategories), zone.trim());
  };

  const canProceed = step === 1 
    ? selectedCategories.size > 0 
    : step === 2 
    ? zone.trim().length > 0 
    : true;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative w-full max-w-lg bg-background rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[90vh] flex flex-col"
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
                Step {step} of 3
              </p>
              <h2 className="text-[20px] font-bold text-foreground">
                {step === 1 && 'What are you interested in?'}
                {step === 2 && 'Where are you located?'}
                {step === 3 && 'All set!'}
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
            initial={{ width: '33%' }}
            animate={{ width: `${(step / 3) * 100}%` }}
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
                        'relative p-4 rounded-2xl transition-all text-left min-h-[80px]',
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
                <div className="w-full max-w-sm">
                  <label className="block text-[13px] text-muted-foreground font-medium mb-2">
                    City or postcode
                  </label>
                  <input
                    type="text"
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    placeholder="e.g., Amsterdam, 1012 AB"
                    className="w-full px-4 py-4 bg-card border-2 border-border rounded-xl text-foreground placeholder:text-muted-foreground text-[16px] focus:outline-none focus:border-primary transition-colors"
                    autoFocus
                  />
                </div>
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
                <div className="max-w-md px-4 py-4 mb-6 bg-primary/5 border border-primary/10 rounded-2xl">
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
            onClick={step === 3 ? handleFinish : handleNext}
            disabled={!canProceed}
            className={cn(
              'w-full py-4 rounded-xl font-semibold text-[16px] transition-all min-h-[52px]',
              'flex items-center justify-center gap-2',
              canProceed
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            <span>{step === 3 ? 'Start Exploring' : 'Continue'}</span>
            {step !== 3 && <ChevronRight size={18} />}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

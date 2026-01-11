import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, MapPin, Check } from 'lucide-react';
import { CATEGORIES, type CategoryConfig } from '@/lib/categories';
import { cn } from '@/lib/utils';

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">
              {step === 1 && 'Curate Your Feed'}
              {step === 2 && 'Set Your Zone'}
              {step === 3 && 'You\'re All Set!'}
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              {step === 1 && 'Select the categories you\'re interested in'}
              {step === 2 && 'Enter your city or postcode'}
              {step === 3 && 'Your personalized feed is ready'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 flex gap-2">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                s <= step ? 'bg-white' : 'bg-white/20'
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-6 min-h-[400px]">
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
                  const Icon = cat.icon;
                  
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={cn(
                        'relative p-4 rounded-2xl border transition-all text-left',
                        'hover:scale-[1.02] active:scale-[0.98]',
                        isSelected
                          ? 'bg-white/10 border-white/40'
                          : 'bg-white/5 border-white/10 hover:border-white/20'
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                          <Check size={12} className="text-zinc-900" />
                        </div>
                      )}
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', cat.bgClass)}>
                        <Icon size={20} className={cat.textClass} />
                      </div>
                      <div className="text-sm font-semibold text-white">{cat.label}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{cat.emoji}</div>
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
                className="flex flex-col items-center justify-center h-[360px]"
              >
                <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center mb-6">
                  <MapPin size={40} className="text-white" />
                </div>
                <input
                  type="text"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  placeholder="Enter city or postcode..."
                  className="w-full max-w-sm px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-zinc-500 text-center text-lg font-medium focus:outline-none focus:border-white/30 transition-colors"
                  autoFocus
                />
                <p className="text-zinc-500 text-sm mt-4">
                  We'll show events near this location
                </p>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center justify-center h-[360px] text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
                  className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6"
                >
                  <Check size={48} className="text-emerald-400" />
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-2">Perfect!</h3>
                <p className="text-zinc-400 max-w-xs">
                  Your feed will now show {selectedCategories.size} categories near {zone}
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-sm">
                  {Array.from(selectedCategories).slice(0, 5).map(catId => {
                    const cat = CATEGORIES.find(c => c.id === catId);
                    if (!cat) return null;
                    return (
                      <span key={catId} className={cn('px-3 py-1.5 rounded-full text-xs font-medium', cat.bgClass, cat.textClass)}>
                        {cat.emoji} {cat.label}
                      </span>
                    );
                  })}
                  {selectedCategories.size > 5 && (
                    <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white">
                      +{selectedCategories.size - 5} more
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10">
          <button
            onClick={step === 3 ? handleFinish : handleNext}
            disabled={!canProceed}
            className={cn(
              'w-full py-4 rounded-2xl font-semibold text-base transition-all',
              'flex items-center justify-center gap-2',
              canProceed
                ? 'bg-white text-zinc-900 hover:bg-zinc-100 active:scale-[0.98]'
                : 'bg-white/10 text-zinc-500 cursor-not-allowed'
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

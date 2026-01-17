/**
 * Pull to Refresh Component
 * 
 * Native-feeling pull-to-refresh for mobile web.
 * Works on iOS and Android browsers.
 */

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { hapticImpact } from '@/shared/lib/haptics';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  disabled?: boolean;
  pullDownThreshold?: number;
}

export function PullToRefresh({ 
  onRefresh, 
  children, 
  disabled = false,
  pullDownThreshold = 80 
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canRefresh, setCanRefresh] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isDragging = useRef(false);
  
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      isDragging.current = true;
    }
  }, [disabled, isRefreshing]);
  
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging.current || disabled || isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;
    
    if (distance > 0) {
      // Apply rubber band effect - diminishing returns as you pull further
      const adjustedDistance = Math.min(distance * 0.5, pullDownThreshold * 1.5);
      setPullDistance(adjustedDistance);
      
      if (adjustedDistance >= pullDownThreshold && !canRefresh) {
        setCanRefresh(true);
        hapticImpact('medium').catch(() => {});
      } else if (adjustedDistance < pullDownThreshold && canRefresh) {
        setCanRefresh(false);
      }
      
      // Prevent page scroll while pulling
      if (distance > 10) {
        e.preventDefault();
      }
    }
  }, [disabled, isRefreshing, pullDownThreshold, canRefresh]);
  
  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return;
    
    isDragging.current = false;
    
    if (canRefresh && !isRefreshing) {
      setIsRefreshing(true);
      await hapticImpact('light').catch(() => {});
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          setCanRefresh(false);
        }, 500);
      }
    } else {
      setPullDistance(0);
      setCanRefresh(false);
    }
  }, [canRefresh, isRefreshing, onRefresh]);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);
  
  const indicatorRotation = isRefreshing 
    ? 360 
    : Math.min((pullDistance / pullDownThreshold) * 360, 360);
  
  return (
    <div ref={containerRef} className="relative">
      {/* Pull-to-refresh indicator */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ 
              opacity: Math.min(pullDistance / 40, 1),
              y: Math.min(pullDistance * 0.5, 60)
            }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div className={`
              px-4 py-2 rounded-full backdrop-blur-xl border
              ${canRefresh || isRefreshing 
                ? 'bg-primary/10 border-primary/30' 
                : 'bg-muted/80 border-border'
              }
            `}>
              <motion.div
                animate={{ 
                  rotate: isRefreshing ? [0, 360] : indicatorRotation 
                }}
                transition={isRefreshing ? { 
                  duration: 1, 
                  repeat: Infinity, 
                  ease: 'linear' 
                } : { 
                  duration: 0.1 
                }}
              >
                <RefreshCw 
                  size={20} 
                  className={canRefresh || isRefreshing ? 'text-primary' : 'text-muted-foreground'} 
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Content */}
      <motion.div
        animate={{
          y: isRefreshing ? 60 : pullDistance > 0 ? pullDistance * 0.3 : 0
        }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

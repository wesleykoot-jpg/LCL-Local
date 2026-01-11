import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';

interface SlideToCommitProps {
  label: string;
  onCommit: () => void;
}

export function SlideToCommit({
  label,
  onCommit
}: SlideToCommitProps) {
  const [committed, setCommitted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [containerWidth, setContainerWidth] = useState(0);
  
  const handleWidth = 56;
  const threshold = 0.8;

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
  }, []);

  const maxDrag = containerWidth - handleWidth - 8;
  
  const backgroundOpacity = useTransform(x, [0, maxDrag * 0.5], [1, 0]);
  const successOpacity = useTransform(x, [maxDrag * 0.7, maxDrag], [0, 1]);

  const handleDragEnd = useCallback(() => {
    if (committed) return;
    
    const currentX = x.get();
    const thresholdX = maxDrag * threshold;
    
    if (currentX > thresholdX) {
      setCommitted(true);
      animate(x, maxDrag, { type: "spring", stiffness: 300, damping: 30 });
      onCommit();
    } else {
      animate(x, 0, { type: "spring", stiffness: 400, damping: 25 });
    }
  }, [committed, maxDrag, onCommit, x]);

  return (
    <div 
      ref={containerRef} 
      className={`relative h-[64px] rounded-full overflow-hidden select-none transition-colors duration-300 ${
        committed 
          ? 'bg-gradient-to-r from-orange-400 to-rose-400' 
          : 'glass-dark border border-white/25'
      }`}
    >
      {/* Background Text */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-center font-bold tracking-wide text-white text-sm"
        style={{ opacity: backgroundOpacity }}
      >
        {label}
      </motion.div>

      {/* Success Text */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-center font-bold tracking-wide text-white text-sm"
        style={{ opacity: successOpacity }}
      >
        YOU'RE IN!
      </motion.div>

      {/* Draggable Handle */}
      <motion.div
        drag={committed ? false : "x"}
        dragConstraints={{ left: 0, right: maxDrag }}
        dragElastic={0}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={`absolute top-1 left-1 w-[56px] h-[56px] rounded-full flex items-center justify-center shadow-apple-md cursor-grab active:cursor-grabbing ${
          committed 
            ? 'bg-white text-orange-500' 
            : 'bg-white text-zinc-900'
        }`}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        {committed ? <Check size={24} strokeWidth={3} /> : <ArrowRight size={24} strokeWidth={2.5} />}
      </motion.div>
    </div>
  );
}

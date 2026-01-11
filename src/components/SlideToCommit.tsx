import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowRight, Check } from 'lucide-react';
interface SlideToCommitProps {
  label: string;
  onCommit: () => void;
}
export function SlideToCommit({
  label,
  onCommit
}: SlideToCommitProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(0);
  const [committed, setCommitted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleEnd = useCallback(() => {
    if (committed) return;
    setIsDragging(false);
    if (containerRef.current) {
      const threshold = containerRef.current.offsetWidth * 0.8; // 80% to commit
      if (position > threshold) {
        setCommitted(true);
        setPosition(containerRef.current.offsetWidth - 56); // Snap to end (minus handle width)
        onCommit();
      } else {
        setPosition(0); // Snap back
      }
    }
  }, [committed, position, onCommit]);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging || committed || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left - 28, rect.width - 56)); // 28 is half handle width
    setPosition(x);
  }, [isDragging, committed]);

  const handleStart = () => {
    if (committed) return;
    setIsDragging(true);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX);
    const onMouseUp = () => handleEnd();
    const onTouchEnd = () => handleEnd();
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchend', onTouchEnd);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, committed, handleEnd, handleMove]);
  return <div ref={containerRef} className={`relative h-16 rounded-full overflow-hidden select-none transition-colors duration-300 ${committed ? 'bg-emerald-500' : 'bg-white/20 backdrop-blur-md border border-white/30'}`}>
      {/* Background Text */}
      <div className={`absolute inset-0 flex items-center justify-center font-bold tracking-wide transition-opacity duration-300 ${committed ? 'opacity-0' : 'opacity-100 text-white'}`} style={{
      opacity: Math.max(0, 1 - position / 150)
    }}>
        {label}
      </div>

      {/* Success Text */}
      <div className={`absolute inset-0 flex items-center justify-center font-bold tracking-wide text-white transition-opacity duration-300 ${committed ? 'opacity-100' : 'opacity-0'}`}>
        YOU'RE IN!
      </div>

      {/* Slider Handle */}
      <div onMouseDown={handleStart} onTouchStart={handleStart} className={`absolute top-1 bottom-1 w-14 rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing transition-transform duration-75 ${committed ? 'bg-white text-emerald-600' : 'bg-white text-black'}`} style={{
      transform: `translateX(${position}px)`
    }}>
        {committed ? <Check size={24} strokeWidth={3} /> : <ArrowRight size={24} />}
      </div>
    </div>;
}
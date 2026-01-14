import { memo } from 'react';
import { Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { hapticImpact } from '@/shared/lib/haptics';

interface CategorySubscribeCardProps {
  categoryLabel: string;
}

export const CategorySubscribeCard = memo(function CategorySubscribeCard({
  categoryLabel,
}: CategorySubscribeCardProps) {
  const handleSubscribe = async () => {
    await hapticImpact('light');
    toast.success(`You'll be notified about new ${categoryLabel} events!`, {
      icon: '🔔',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mx-4 my-4"
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl p-5">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Want more <span className="font-semibold">{categoryLabel}</span> events?
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Get notified when new events are posted
              </p>
            </div>
          </div>
          
          <Button
            size="sm"
            variant="outline"
            onClick={handleSubscribe}
            className="shrink-0 rounded-full border-primary/20 hover:bg-primary/10 hover:border-primary/30"
          >
            <Bell className="w-4 h-4 mr-1.5" />
            Notify Me
          </Button>
        </div>
      </div>
    </motion.div>
  );
});

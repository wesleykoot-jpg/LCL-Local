import { motion } from 'framer-motion';
import { Mail, Check, X, Calendar } from 'lucide-react';
import { ItineraryItem } from '../hooks/useUnifiedItinerary';
import { hapticImpact } from '@/shared/lib/haptics';

interface PendingInvitesRailProps {
    invites: ItineraryItem[];
    onRespond: (id: string, response: 'accept' | 'decline') => void;
}

/**
 * PendingInvitesRail
 * 
 * Displays pending event invitations in a horizontal scroll rail.
 * Part of v5.0 "Social Air" design system.
 */
export function PendingInvitesRail({ invites, onRespond }: PendingInvitesRailProps) {
    if (invites.length === 0) return null;

    return (
        <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-2 px-6 mb-3">
                <div className="w-5 h-5 rounded-full bg-brand-primary/10 flex items-center justify-center">
                    <Mail size={12} className="text-brand-primary" />
                </div>
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                    Pending Invites ({invites.length})
                </h3>
            </div>

            <div className="flex overflow-x-auto px-6 pb-4 -mx-0 scrollbar-hide snap-x gap-3">
                {invites.map((invite) => (
                    <InviteCard
                        key={invite.id}
                        invite={invite}
                        onRespond={onRespond}
                    />
                ))}
            </div>
        </div>
    );
}

function InviteCard({ invite, onRespond }: { invite: ItineraryItem; onRespond: any }) {
    const handleAction = async (response: 'accept' | 'decline') => {
        await hapticImpact(response === 'accept' ? 'medium' : 'light');
        onRespond(invite.id, response);
    };

    return (
        <motion.div
            className="flex-shrink-0 w-[260px] bg-surface-card rounded-card shadow-card p-3 border border-border snap-center"
            whileTap={{ scale: 0.96 }}
        >
            <div className="flex items-start gap-3 mb-3">
                {/* Date Box */}
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-surface-base flex flex-col items-center justify-center border border-border/50">
                    <span className="text-[10px] uppercase font-bold text-text-secondary">
                        {invite.startTime.toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="text-lg font-bold text-text-primary leading-none">
                        {invite.startTime.getDate()}
                    </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-text-primary line-clamp-2 leading-tight mb-1">
                        {invite.title}
                    </h4>
                    <p className="text-xs text-text-secondary truncate">
                        {invite.location}
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-text-muted">
                        <Calendar size={10} />
                        <span>{invite.startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <button
                    onClick={() => handleAction('decline')}
                    className="flex-1 py-2 rounded-lg bg-surface-base text-text-secondary text-xs font-semibold hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
                >
                    <X size={14} />
                    Decline
                </button>
                <button
                    onClick={() => handleAction('accept')}
                    className="flex-1 py-2 rounded-lg bg-brand-primary text-white text-xs font-semibold hover:bg-brand-secondary transition-colors flex items-center justify-center gap-1"
                >
                    <Check size={14} />
                    Accept
                </button>
            </div>
        </motion.div>
    );
}

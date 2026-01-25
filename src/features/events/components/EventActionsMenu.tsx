import { useState, lazy, Suspense } from 'react';
import { MoreVertical, Flag, Ban, Loader2, GitFork } from 'lucide-react';
import type { EventWithAttendees } from '../hooks/hooks';

const CreateEventModal = lazy(() => import('./CreateEventModal').then(m => ({ default: m.CreateEventModal })));
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { hapticImpact } from '@/shared/lib/haptics';

// PostgreSQL error codes
const PG_ERROR_UNIQUE_VIOLATION = '23505';

interface EventActionsMenuProps {
  eventId?: string;
  hostUserId?: string;
  currentUserProfileId?: string;
  onBlock?: () => void;
  event?: EventWithAttendees;
}

const REPORT_REASONS = [
  { id: 'offensive', label: '🚫 Offensive or Inappropriate' },
  { id: 'spam', label: '📧 Spam or Misleading' },
  { id: 'illegal', label: '⚖️ Illegal Activity' },
  { id: 'harassment', label: '😠 Harassment or Bullying' },
  { id: 'other', label: '❓ Other' },
];

export function EventActionsMenu({
  eventId,
  hostUserId,
  currentUserProfileId,
  onBlock,
  event,
}: EventActionsMenuProps) {
  const queryClient = useQueryClient();
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showForkModal, setShowForkModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Don't show menu if user is not authenticated or is the host
  if (!currentUserProfileId || currentUserProfileId === hostUserId) {
    return null;
  }

  const handleReport = async () => {
    if (!selectedReason) {
      toast.error('Please select a reason');
      return;
    }

    setIsSubmitting(true);
    await hapticImpact('medium');

    try {
      const reportData: {
        reporter_id: string;
        reason: string;
        event_id?: string;
        reported_user_id?: string;
      } = {
        reporter_id: currentUserProfileId,
        reason: selectedReason,
      };

      // Add event_id if reporting an event
      if (eventId) {
        reportData.event_id = eventId;
      }

      // Add reported_user_id if reporting a user
      if (hostUserId) {
        reportData.reported_user_id = hostUserId;
      }

      const { error } = await supabase
        .from('content_reports')
        .insert(reportData);

      if (error) throw error;

      toast.success('Report submitted. Our team will review it shortly.');
      setShowReportDialog(false);
      setSelectedReason('');
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlock = async () => {
    if (!hostUserId) {
      toast.error('Unable to block user');
      return;
    }

    setIsSubmitting(true);
    await hapticImpact('heavy');

    try {
      const { error } = await supabase
        .from('user_blocks')
        .insert({
          blocker_id: currentUserProfileId,
          blocked_id: hostUserId,
        });

      if (error) {
        // Check if already blocked (unique constraint violation)
        if (error.code === PG_ERROR_UNIQUE_VIOLATION) {
          toast.error('User is already blocked');
        } else {
          throw error;
        }
      } else {
        toast.success('User blocked. You won\'t see their content anymore.');

        // Invalidate feed queries to remove blocked content immediately
        queryClient.invalidateQueries({ queryKey: ['events'] });

        if (onBlock) {
          onBlock();
        }
      }

      setShowBlockDialog(false);
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-2 rounded-full hover:bg-muted/50 transition-colors"
            aria-label="More options"
            onClick={(e) => {
              e.stopPropagation();
              hapticImpact('light');
            }}
          >
            <MoreVertical size={20} className="text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {event && (
            <>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setShowForkModal(true);
                  hapticImpact('light');
                }}
                className="cursor-pointer font-medium"
              >
                <GitFork className="mr-2 h-4 w-4 text-brand-primary" />
                <span>Host a Fork</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setShowReportDialog(true);
              hapticImpact('light');
            }}
            className="cursor-pointer"
          >
            <Flag className="mr-2 h-4 w-4 text-amber-500" />
            <span>Report</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setShowBlockDialog(true);
              hapticImpact('light');
            }}
            className="cursor-pointer text-destructive focus:text-destructive"
          >
            <Ban className="mr-2 h-4 w-4" />
            <span>Block User</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report Content</DialogTitle>
            <DialogDescription>
              Help us keep LCL safe by reporting inappropriate content or behavior.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {REPORT_REASONS.map((reason) => (
              <button
                key={reason.id}
                onClick={() => setSelectedReason(reason.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${selectedReason === reason.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
                  }`}
              >
                <span className="text-sm font-medium">{reason.label}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowReportDialog(false);
                setSelectedReason('');
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReport}
              disabled={!selectedReason || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Report'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block this user?</AlertDialogTitle>
            <AlertDialogDescription>
              You won't see events or content from this user anymore. They won't be notified.
              You can unblock them later from your privacy settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlock}
              disabled={isSubmitting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Blocking...
                </>
              ) : (
                'Block User'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fork Creation Modal */}
      {showForkModal && event && (
        <Suspense fallback={null}>
          <CreateEventModal
            isOpen={showForkModal}
            onClose={() => setShowForkModal(false)}
            initialParentEvent={event}
          />
        </Suspense>
      )}
    </>
  );
}

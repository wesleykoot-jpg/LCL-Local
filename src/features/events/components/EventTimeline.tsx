// REPLACE existing handleJoin with this:
const handleJoin = async (e: React.MouseEvent) => {
  e.stopPropagation();
  try {
    setIsJoining(true);
    await eventService.joinEvent(event.id, user.id);
    toast.success("You're on the list!");
    
    // CRITICAL: Update both feeds immediately
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['my-events'] });
  } catch (error) {
    toast.error("Failed to join");
  } finally {
    setIsJoining(false);
  }
};

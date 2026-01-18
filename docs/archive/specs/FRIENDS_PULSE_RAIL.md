# Friends Pulse Rail - Implementation Documentation

## Overview

The Friends Pulse Rail is an Instagram Stories-style feature that displays friends' real-time activity status at the top of the event feed. It shows which friends are attending events now or soon, enabling spontaneous social connections.

## Architecture

### Database Layer

#### `user_relationships` Table
```sql
CREATE TABLE user_relationships (
  id UUID PRIMARY KEY,
  follower_id UUID REFERENCES profiles(id),
  following_id UUID REFERENCES profiles(id),
  status TEXT ('pending' | 'accepted'),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(follower_id, following_id)
);
```

**Purpose**: Stores the social graph (who follows whom)

**Constraints**:
- Prevents self-following
- Ensures unique relationships
- Cascades deletes when profiles are removed

**Indexes**:
- `idx_user_relationships_follower` - Fast lookups by follower
- `idx_user_relationships_following` - Fast lookups by following
- `idx_user_relationships_status` - Filter by relationship status

#### `get_friends_pulse(current_user_id UUID)` RPC Function

**Purpose**: Efficiently fetch friends' event activity in a single query

**Logic**:
1. Find all accepted following relationships for the current user
2. Join with `event_attendees` to get friends' events
3. Join with `events` to get event details
4. Classify events as 'live' (happening now) or 'upcoming' (next 24 hours)
5. Sort by priority: live first, then upcoming, then by date

**Returns**: JSON array of friend activities
```typescript
[
  {
    user: { id: string, avatar_url: string, first_name: string },
    status: 'live' | 'upcoming',
    event: { id: string, title: string, category: string }
  }
]
```

**Performance**: O(1) database round-trip instead of N+1 queries

### Frontend Layer

#### `FriendsPulseRail` Component

**Location**: `src/features/events/components/FriendsPulseRail.tsx`

**Features**:
- Horizontal scrollable container (no visible scrollbar)
- Circular avatars with status rings
- Category-specific icons as badges
- Smooth animations and haptic feedback
- Auto-hides when no activities

**Visual States**:
- **Live Now** 🟢: Green pulsing ring + green badge with category icon
- **Upcoming** 🔵: Solid blue ring + blue badge with category icon
- **No Plans**: Does not appear in the rail

**Interactions**:
- Click avatar → Opens event detail modal
- If no event → Shows toast: "Sarah is free tonight. Invite her?"

#### `useFriendsPulse` Hook

**Location**: `src/features/events/hooks/useFriendsPulse.ts`

**Purpose**: Fetch and manage friends' activity data

**Features**:
- Uses React Query for caching and state management
- Auto-refetches every minute for real-time feel
- Gracefully handles errors and loading states
- Returns empty array when no user ID provided

**Query Configuration**:
```typescript
{
  staleTime: 2 minutes,
  refetchInterval: 60 seconds,
  refetchOnWindowFocus: true,
}
```

## Integration

The `FriendsPulseRail` is integrated into the main Feed component:

```tsx
// src/features/events/Feed.tsx
<>
  {/* Featured Hero */}
  <FeaturedEventHero ... />
  
  {/* Friends Pulse Rail */}
  <FriendsPulseRail
    currentUserProfileId={profile?.id}
    onEventClick={handleEventClick}
  />
  
  {/* Trending Carousel */}
  <HorizontalEventCarousel ... />
</>
```

## Security

### Row-Level Security (RLS) Policies

All policies use `profiles.user_id = auth.uid()` to ensure users can only:
- View their own relationships
- Create relationships where they are the follower
- Delete relationships where they are the follower
- Update relationships where they are the following (to accept/reject)

**Policy**: "Users can view their own relationships"
```sql
SELECT * FROM user_relationships
WHERE follower_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
   OR following_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
```

**Policy**: "Users can follow other users"
```sql
INSERT INTO user_relationships (follower_id, ...)
WHERE follower_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
```

## Performance Considerations

### Database
- **Indexes**: All foreign keys and frequently queried columns are indexed
- **RPC Function**: Single query instead of N+1 pattern
- **Query Optimization**: Uses JOIN instead of subqueries where possible

### Frontend
- **React Query**: Caches results to minimize network requests
- **Memoization**: Component uses `React.memo` to prevent unnecessary renders
- **Conditional Rendering**: Component only renders when there are activities
- **Virtual Scrolling**: Not needed (horizontal rail with limited items)

### Network
- **Refetch Interval**: 60 seconds (balance between real-time and server load)
- **Stale Time**: 2 minutes (prevents redundant fetches)
- **Auto-hide**: Component doesn't render when empty (saves bandwidth)

## Category Icon Mapping

The component maps event categories to lucide-react icons:

| Category | Icon | Badge Color |
|----------|------|-------------|
| music, nightlife | Music | Green/Blue |
| sports, active, wellness | Dumbbell | Green/Blue |
| gaming | Gamepad2 | Green/Blue |
| food, foodie, market | UtensilsCrossed | Green/Blue |
| arts, crafts, workshops | Palette | Green/Blue |
| cinema, entertainment | Film | Green/Blue |
| outdoors | Trees | Green/Blue |
| family | Baby | Green/Blue |
| community, social | Users | Green/Blue |
| default | Sparkles | Green/Blue |

Badge color depends on status:
- **Live**: Green background (`bg-green-500`)
- **Upcoming**: Blue background (`bg-blue-500`)

## Testing

### Unit Tests

**FriendsPulseRail Component**:
- ✅ Does not render when no activities
- ✅ Does not render when no user ID
- ✅ Renders correctly with activities (requires mock data)

**useFriendsPulse Hook**:
- ✅ Returns empty array when no user ID
- ✅ Calls RPC with correct parameters
- ✅ Handles errors gracefully
- ✅ Returns empty array when RPC returns null

### Manual Testing Checklist

- [ ] Horizontal scroll works smoothly on mobile
- [ ] Status rings animate (live events pulse)
- [ ] Category icons match event types
- [ ] Clicking avatar opens event detail modal
- [ ] Toast appears for friends with no plans
- [ ] Component auto-hides when no activities
- [ ] Real-time updates work (events change status)
- [ ] Performance is acceptable with many friends

## Future Enhancements

1. **Push Notifications**: Notify when friends join events
2. **Activity Filtering**: Filter by category or time
3. **Direct Invites**: Invite friends directly from the rail
4. **Status Messages**: Let friends add custom status
5. **Mutual Friends**: Show mutual friends attending events
6. **Privacy Controls**: Let users hide their activity
7. **Grouping**: Group friends by event or category

## Migration Instructions

To apply this feature to a Supabase project:

1. Run the migration:
   ```bash
   supabase migration up 20260117100000_social_graph
   ```

2. Verify the migration:
   ```sql
   SELECT * FROM user_relationships LIMIT 1;
   SELECT get_friends_pulse('your-user-id');
   ```

3. Test RLS policies:
   ```sql
   -- As authenticated user
   INSERT INTO user_relationships (follower_id, following_id, status)
   VALUES ('your-profile-id', 'friend-profile-id', 'accepted');
   ```

## Troubleshooting

### Component not showing
- Check if `currentUserProfileId` is provided
- Verify RPC function returns data: `SELECT get_friends_pulse('user-id');`
- Check browser console for errors

### RPC function errors
- Ensure `event_attendees` table has data
- Verify foreign key relationships are correct
- Check RLS policies allow reading relationships

### Performance issues
- Add more indexes if queries are slow
- Consider pagination for users with many friends
- Adjust refetch interval if too frequent

## References

- Migration: `supabase/migrations/20260117100000_social_graph.sql`
- Component: `src/features/events/components/FriendsPulseRail.tsx`
- Hook: `src/features/events/hooks/useFriendsPulse.ts`
- Types: `src/integrations/supabase/types.ts`
- Tests: `src/features/events/components/__tests__/FriendsPulseRail.test.tsx`

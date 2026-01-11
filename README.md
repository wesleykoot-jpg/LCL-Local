# LCL - Local Social Events App

A modern, iOS-optimized social events platform built with React, TypeScript, and Supabase. Discover, create, and join local events in your community.

Original design by [Magic Patterns](https://www.magicpatterns.com/c/8f2shdlz13fzkpqwd74ds3)

## Features

- 🎉 **Event Discovery** - Browse local events and tribe gatherings
- ➕ **Create Events** - Host your own events with image uploads
- 📱 **iOS-Optimized** - Native haptics, gestures, and smooth animations
- ⚡ **Real-time Updates** - Live event changes via Supabase Realtime
- 🔐 **Secure Auth** - Email/password authentication with Supabase
- 📸 **Image Upload** - Automatic compression and optimization
- 🗺️ **Interactive Map** - Visualize events in your area
- 🎯 **Smart Matching** - Personalized event recommendations
- 💬 **Toast Notifications** - Clear user feedback for all actions
- 🎨 **Beautiful UI** - Modern design with smooth animations
- 📅 **Calendar Sync** - Sync joined events to Google Calendar & Outlook

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite with optimized production build
- **Mobile**: Capacitor (iOS native features)
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Styling**: Tailwind CSS
- **State**: React Context + Hooks
- **Animations**: Framer Motion + Native Haptics

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Xcode (for iOS development)
- Supabase account

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
# Copy .env.example to .env and add your Supabase credentials

# Run development server
npm run dev
```

### Building for Production

```bash
# Build web assets
npm run build

# Sync to iOS
npx cap sync ios

# Open in Xcode
npx cap open ios
```

## Project Structure

```
src/
├── components/        # React components
├── contexts/         # React Context providers
├── lib/             # Utilities and services
│   ├── eventService.ts
│   ├── storageService.ts
│   ├── haptics.ts
│   └── supabase.ts
├── App.tsx          # Main app component
└── index.tsx        # Entry point
```

## Key Services

### Event Service (`src/lib/eventService.ts`)
- Create, update, delete events
- Join/leave events
- Get attendee lists
- Check attendance status

### Storage Service (`src/lib/storageService.ts`)
- Image upload with compression
- Public URL generation
- File deletion

### Haptics (`src/lib/haptics.ts`)
- Impact feedback
- Notification feedback
- Selection feedback

### Calendar Sync (`src/lib/calendar/`)
- Google Calendar integration
- Microsoft Outlook/365 integration
- OAuth token management
- Event create/update/delete sync

## Calendar Sync Setup

The app supports syncing joined events to Google Calendar and Microsoft Outlook. This feature is optional and requires OAuth credentials.

### Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or select existing)
3. Enable the Google Calendar API
4. Configure OAuth consent screen:
   - User Type: External
   - Add scopes: `calendar.events`, `userinfo.email`, `userinfo.profile`, `openid`
5. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:5173/calendar/callback/google` (dev)
6. Copy Client ID and Client Secret to your `.env` file

### Microsoft Outlook Setup

1. Go to [Azure Portal App Registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps)
2. Create a new registration:
   - Supported account types: Accounts in any organizational directory and personal Microsoft accounts
   - Redirect URI: Web - `http://localhost:5173/calendar/callback/microsoft`
3. Configure API permissions:
   - Microsoft Graph: `Calendars.ReadWrite`, `User.Read`, `offline_access`
4. Create a client secret under "Certificates & secrets"
5. Copy Application (client) ID and client secret to your `.env` file

### Environment Variables for Calendar Sync

```env
# Google Calendar
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_CLIENT_SECRET=your-google-client-secret
VITE_GOOGLE_OAUTH_REDIRECT_URL=http://localhost:5173/calendar/callback/google

# Microsoft Outlook
VITE_MICROSOFT_CLIENT_ID=your-microsoft-client-id
VITE_MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
VITE_MICROSOFT_OAUTH_REDIRECT_URL=http://localhost:5173/calendar/callback/microsoft
```

### Database Migration

Run the calendar sync migration to create the required tables:

```sql
-- Located at: supabase/migrations/20260111210000_add_calendar_sync_tables.sql
```

This creates:
- `user_calendar_accounts` - Stores connected calendar accounts
- `event_calendar_mappings` - Maps LCL events to calendar events

## Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Complete iOS App Store deployment guide
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md) - Detailed feature list
- [Backend Setup](./BACKEND_SETUP.md) - Database configuration

## Performance

- **Bundle Size**: 471 KB gzipped
- **Code Split**: 3 vendor bundles
- **Build Time**: ~17 seconds
- **Lighthouse Ready**: Optimized for 90+ score

## Environment Variables

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## iOS Deployment

1. Build the app: `npm run build`
2. Sync to iOS: `npx cap sync ios`
3. Open Xcode: `npx cap open ios`
4. Configure signing & capabilities
5. Build and archive for App Store

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete instructions.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

Private - All rights reserved

## Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ following 2025-2026 best practices

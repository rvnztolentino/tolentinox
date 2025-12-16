# RVNZCOMM - Family Real-Time Messaging App

Private, real-time messaging application for approved family members only. Built with React, TypeScript, Supabase, and Socket.IO.

## Features

- 🔒 **Whitelist-Based Authentication**: Only approved email addresses can access
- 💬 **Real-Time Messaging**: Instant messaging using Socket.IO
- 👤 **User Profiles**: Custom name and profile picture
- 🗑️ **Auto-Expiring Messages**: Messages automatically delete after 3 days (TTL)
- 📱 **Responsive Design**: Works on desktop and mobile
- ⚡ **Fast & Modern**: Built with Vite, React, and TypeScript

## Tech Stack

- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Backend**: Socket.IO + Express
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with whitelist validation
- **Storage**: Supabase Storage (profile pictures)
- **Real-Time**: Socket.IO

## Setup Instructions

### 1. Prerequisites

- Node.js 18+ installed
- Supabase account ([signup here](https://supabase.com))

### 2. Supabase Setup

1. Create a new Supabase project
2. Go to SQL Editor and run the schema from `supabase/schema.sql`
3. Go to Storage and verify that `profile-pictures` bucket is created
4. Copy your project URL and anon key from Settings > API

### 3. Configure Whitelist

Edit `src/config/whitelist.ts` and add your family's email addresses:

```typescript
export const APPROVED_EMAILS = [
  'family1@example.com',
  'family2@example.com',
  // Add your family emails here
];
```

### 4. Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your-supabase-project-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_SOCKET_URL=http://localhost:3001
   ```

### 5. Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend (Socket.IO Server):**
```bash
npm install express socket.io cors
npm install -D @types/express @types/cors tsx
```

### 6. Run the Application

**Terminal 1 - Start Backend (Socket.IO Server):**
```bash
npx tsx watch src/backend/index.ts
```

**Terminal 2 - Start Frontend:**
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Usage

### Sign Up

1. Navigate to `/signup`
2. Enter your name, email (must be whitelisted), and password
3. Optionally upload a profile picture
4. Click "Sign Up"

### Sign In

1. Navigate to `/login`
2. Enter your email and password
3. If your email is whitelisted, you'll be redirected to the chat

### Chat

- Send messages in real-time
- See who's online
- View typing indicators
- Messages auto-delete after 3 days

## Message TTL (Time-To-Live)

Messages are automatically deleted after 3 days to save storage:

- **Automatic**: Trigger runs on every new message insert
- **Manual**: Call `cleanup_messages()` function in Supabase SQL Editor

To adjust the TTL period, edit the interval in `supabase/schema.sql`:
```sql
WHERE created_at < NOW() - INTERVAL '3 days'
```

## Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Backend (Heroku/Railway/Render)

1. Deploy Socket.IO server separately
2. Update `VITE_SOCKET_URL` to production URL
3. Ensure CORS is configured for your frontend domain

---

Original Vite Template Information Below

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

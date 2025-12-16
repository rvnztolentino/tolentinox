# RVNZCOMM Setup Checklist

Follow these steps to get your family messaging app running:

## ✅ Setup Checklist

### 1. Supabase Configuration

- [ ] Create a Supabase project at https://supabase.com
- [ ] Run the SQL schema from `supabase/schema.sql` in SQL Editor
- [ ] Verify `profile-pictures` storage bucket exists
- [ ] Copy your Project URL and Anon Key from Settings > API

### 2. Environment Configuration

- [ ] Copy `.env.example` to `.env`
- [ ] Add your `VITE_SUPABASE_URL`
- [ ] Add your `VITE_SUPABASE_ANON_KEY`
- [ ] Verify `VITE_SOCKET_URL=http://localhost:3001`

### 3. Whitelist Configuration

- [ ] Edit `src/config/whitelist.ts`
- [ ] Add family email addresses to `APPROVED_EMAILS` array
- [ ] Save the file

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Application

Open two terminals:

**Terminal 1 - Backend:**
```bash
npm run backend
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### 6. Test the Application

- [ ] Navigate to `http://localhost:5173`
- [ ] Try signing up with a whitelisted email
- [ ] Upload a profile picture (optional)
- [ ] Sign in and test messaging
- [ ] Open in another browser/incognito to test real-time messaging

## 🔧 Troubleshooting

**Backend won't start:**
- Make sure port 3001 is not in use
- Check that express, socket.io, and cors are installed

**Supabase errors:**
- Verify your `.env` credentials
- Check that SQL schema was run successfully
- Ensure RLS policies are enabled

**Authentication errors:**
- Confirm email is in whitelist
- Check Supabase Auth settings
- Verify email confirmation is disabled (or handle it)

**Messages not appearing:**
- Check Socket.IO server is running in Terminal 1
- Verify `VITE_SOCKET_URL` in `.env`
- Check browser console for WebSocket errors

## 🚀 Next Steps

Once everything works:

1. **Add more family members** to the whitelist
2. **Customize styling** in components
3. **Deploy frontend** to Vercel
4. **Deploy backend** to Railway/Render/Heroku
5. **Update `.env`** with production Socket.IO URL

## 📝 Important Notes

- Messages auto-delete after 3 days
- Only whitelisted emails can access
- Profile pictures stored in Supabase Storage
- Real-time updates via Socket.IO

Enjoy your private family chat! 💬

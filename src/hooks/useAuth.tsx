import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import supabase from '@/services/supabaseClient';
import type { User, AuthState } from '@/types';

interface AuthContextType extends AuthState {
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  uploadProfilePicture: (file: File, userId: string) => Promise<{ url: string | null; error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const approvedEmailCache = new Map<string, boolean>();
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const verifyApprovedEmail = async (email: string) => {
    const normalized = (email || '').toLowerCase();
    if (!normalized) {
      return { ok: false, error: 'Email is required.' } as const;
    }

    if (approvedEmailCache.has(normalized)) {
      return { ok: approvedEmailCache.get(normalized) === true, error: approvedEmailCache.get(normalized) ? null : 'Email not approved.' } as const;
    }

    const { data, error } = await supabase
      .from('approved_emails')
      .select('email')
      .eq('email', normalized)
      .maybeSingle();

    if (error) {
      console.error('Error checking approved email:', error);
      return { ok: false, error: 'Unable to verify email approval right now. Please try again.' } as const;
    }

    const ok = !!data?.email;
    approvedEmailCache.set(normalized, ok);

    return { ok, error: ok ? null : 'Email not approved. Contact admin to add your email.' } as const;
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout - force loading to clear fairly quickly
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('Auth loading timeout - forcing clear');
        setState((prev) => ({ ...prev, loading: false }));
      }
    }, 3000);

    // Check active session
    const initAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          if (mounted) {
            setState({ user: null, loading: false, error: null });
          }
          return;
        }

        if (!mounted) return;

        if (session?.user) {
          // Verify approved email from DB (security check on restore)
          const approved = await verifyApprovedEmail(session.user.email || '');
          if (!approved.ok) {
            await supabase.auth.signOut();
            if (mounted) {
              setState({ user: null, loading: false, error: approved.error });
            }
            return;
          }

          // Immediately expose a lightweight user from auth so UI is usable
          const baseUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.email?.split('@')[0] || 'User',
            profile_picture_url: undefined,
            created_at: session.user.created_at,
          };

          setState({ user: baseUser, loading: false, error: null });

          // Fetch full profile in the background (no impact on loading)
          (async () => {
            try {
              const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();

              if (!mounted || !profile) {
                if (profileError) {
                  console.warn('Profile fetch after init failed:', profileError);
                }
                return;
              }

              setState((prev) => ({
                ...prev,
                user: {
                  id: profile.id,
                  email: profile.email,
                  name: profile.name,
                  profile_picture_url: profile.profile_picture_url,
                  created_at: profile.created_at,
                },
              }));
            } catch (err) {
              console.error('Profile fetch (background) error:', err);
            }
          })();
        } else {
          setState({ user: null, loading: false, error: null });
        }
      } catch (error) {
        console.error('Auth init error:', error);
        if (mounted) {
          setState({ user: null, loading: false, error: null });
        }
      } finally {
        clearTimeout(safetyTimeout);
      }
    };

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      try {
        if (event === 'SIGNED_IN' && session) {
          // On interactive sign-in we already verified the email in signIn(),
          // so we can trust the session and expose the user immediately.
          const baseUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.email?.split('@')[0] || 'User',
            profile_picture_url: undefined,
            created_at: session.user.created_at,
          };

          setState({ user: baseUser, loading: false, error: null });

          // Fetch full profile in the background and merge when ready
          (async () => {
            try {
              const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();

              if (!mounted || !profile) {
                if (profileError) {
                  console.warn('Profile fetch on sign in failed:', profileError);
                }
                return;
              }

              setState((prev) => ({
                ...prev,
                user: {
                  id: profile.id,
                  email: profile.email,
                  name: profile.name,
                  profile_picture_url: profile.profile_picture_url,
                  created_at: profile.created_at,
                },
              }));
            } catch (err) {
              console.error('Profile fetch (background) error on sign in:', err);
            }
          })();
        } else if (event === 'SIGNED_OUT') {
          setState({ user: null, loading: false, error: null });
        } else if (event === 'INITIAL_SESSION') {
          // Let initAuth handle it
        } else {
          // Token refresh, user update, etc - ensure loading clears
          setState((prev) => ({ ...prev, loading: false }));
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        if (mounted) {
          setState({ user: null, loading: false, error: null });
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    // Check approved_emails table
    const approved = await verifyApprovedEmail(email);
    if (!approved.ok) {
      return { error: approved.error };
    }

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        return { error: authError.message };
      }

      // Ensure we have a user id (email confirmation flows may defer availability)
      let userId = authData.user?.id || null;

      // Poll for user id if not immediately available
      if (!userId) {
        for (let i = 0; i < 5; i++) {
          const { data: userResp } = await supabase.auth.getUser();
          if (userResp?.user?.id) {
            userId = userResp.user.id;
            break;
          }
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      if (!userId) {
        // Let the UI instruct user to verify email then sign in
        return { error: 'Account created. Please check your email to confirm before signing in.' };
      }

      // Try to upsert user profile using exact auth user id to satisfy FK
      const profilePayload = {
        id: userId,
        email: email,
        name: name,
        created_at: new Date().toISOString(),
      } as const;

      // Retry on transient FK violations (e.g., replication delay)
      const maxRetries = 5;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const { error: profileError } = await supabase
          .from('users')
          .upsert(profilePayload, { onConflict: 'id' });

        if (!profileError) {
          return { error: null };
        }

        // Postgres FK violation code 23503; wait then retry once or twice
        const isFkViolation =
          (profileError as any)?.code === '23503' ||
          /foreign key/i.test(profileError.message || '');

        if (!isFkViolation) {
          return { error: profileError.message };
        }

        // exponential-ish backoff before retry
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }

      // Final existence check in case a DB trigger already populated the row
      const { data: existingProfile } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (existingProfile?.id) {
        return { error: null };
      }

      return { error: 'Signup succeeded, but profile creation is delayed. Please try signing in shortly.' };
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  };

  const signIn = async (email: string, password: string) => {
    // Validate inputs
    if (!email || !password) {
      return { error: 'Please enter both email and password.' };
    }

    // Check approved_emails table
    const approved = await verifyApprovedEmail(email);
    if (!approved.ok) {
      return { error: approved.error };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        
        // Provide user-friendly error messages
        if (error.message.includes('Invalid login credentials') || error.message.includes('Invalid')) {
          return { error: 'Incorrect email or password. Please check and try again.' };
        }
        if (error.message.includes('Email not confirmed')) {
          return { error: 'Please confirm your email address before signing in.' };
        }
        if (error.message.includes('User not found')) {
          return { error: 'No account found with this email. Please sign up first.' };
        }
        return { error: error.message || 'Sign in failed. Please try again.' };
      }

      if (!data.user) {
        return { error: 'Sign in failed. No user data received.' };
      }

      console.log('Sign in successful');
      return { error: null };
    } catch (error: any) {
      console.error('Sign in exception:', error);
      return { error: error?.message || 'An unexpected error occurred. Please try again.' };
    }
  };

  const signOut = async () => {
    // Optimistically update state so UI doesn't get stuck
    setState({ user: null, loading: false, error: null });

    try {
      // Always clear local session so refresh/open won't restore a stale token
      await supabase.auth.signOut({ scope: 'local' });

      // Attempt global revoke (optional) but don't block UX on failure
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.error('Supabase signOut (global) error:', error);
      }
    } catch (err) {
      console.error('Supabase signOut error:', err);
    }
  };

  const uploadProfilePicture = async (file: File, userId: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file);

      if (uploadError) {
        return { url: null, error: uploadError.message };
      }

      // Get public URL
      const { data } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_picture_url: data.publicUrl })
        .eq('id', userId);

      if (updateError) {
        return { url: null, error: updateError.message };
      }

      return { url: data.publicUrl, error: null };
    } catch (error) {
      return { url: null, error: 'Failed to upload profile picture' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signUp,
        signIn,
        signOut,
        uploadProfilePicture,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

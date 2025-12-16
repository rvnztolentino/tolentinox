import { useEffect, useState, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';
import type { Message } from '@/types';
import supabase from '@/services/supabaseClient';
import { Button } from '@/components/ui/button';
import { Send, RefreshCw } from 'lucide-react';

// Helper function to convert URLs in text to clickable links
const renderMessageWithLinks = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline hover:text-blue-300 break-all"
        >
          {part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

export default function ChatRoomPage() {
  const { user, loading, signOut, uploadProfilePicture } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [profile, setProfile] = useState(user);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Keep local editable profile in sync with auth user
  useEffect(() => {
    if (user) {
      setProfile(user);
    }
  }, [user]);

  // Load initial messages from Supabase
  useEffect(() => {
    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (data && !error) {
        setMessages(data);
        console.log(`[ChatRoom] Initial messages loaded. Total messages: ${data.length}`);
      }
    };

    loadMessages();
  }, []);

  // Socket.IO connection
  useEffect(() => {
    if (!user) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    const newSocket = io(socketUrl);

    newSocket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      // Join the chat
      newSocket.emit('user:join', {
        userId: user.id,
        userName: user.name,
        userAvatar: user.profile_picture_url,
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
    });

    newSocket.io.on('reconnect', (attempt) => {
      console.log('Socket reconnected', attempt);
      // Re-join to refresh presence
      newSocket.emit('user:join', {
        userId: user.id,
        userName: user.name,
        userAvatar: user.profile_picture_url,
      });
    });

    // Listen for new messages
    newSocket.on('message:received', (message: Message) => {
      setMessages((prev) => {
        const updated = [...prev, message];
        console.log(`[ChatRoom] New message received. Total messages: ${updated.length}`);
        return updated;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // Ensure socket reconnects and presence re-sent when tab becomes visible again
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && socket && !socket.connected) {
        try { socket.connect(); } catch {}
      }
      if (document.visibilityState === 'visible' && socket && socket.connected && user) {
        socket.emit('user:join', {
          userId: user.id,
          userName: user.name,
          userAvatar: user.profile_picture_url,
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [socket, user]);

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    const effectiveProfile = profile ?? user;

    const messageData: Message = {
      id: crypto.randomUUID(),
      user_id: user.id,
      user_name: effectiveProfile.name,
      user_avatar: effectiveProfile.profile_picture_url,
      content: newMessage.trim(),
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Save to Supabase
    const { error } = await supabase.from('messages').insert({
      id: messageData.id,
      user_id: messageData.user_id,
      user_name: messageData.user_name,
      user_avatar: messageData.user_avatar,
      content: messageData.content,
      created_at: messageData.created_at,
    });

    if (!error) {
      // Enforce maximum of 50 messages in the table by deleting the oldest
      try {
        const { data: allMessages, error: listError } = await supabase
          .from('messages')
          .select('id, created_at')
          .order('created_at', { ascending: true });

        if (!listError && allMessages && allMessages.length > 50) {
          const idsToDelete = allMessages
            .slice(0, allMessages.length - 50)
            .map((m: { id: string }) => m.id);

          if (idsToDelete.length > 0) {
            await supabase
              .from('messages')
              .delete()
              .in('id', idsToDelete);
          }
        }
      } catch (cleanupError) {
        console.error('Failed to clean up old messages:', cleanupError);
      }

      // Emit to Socket.IO
      if (socket?.connected) {
        socket.emit('message:send', messageData);
      }
      setNewMessage('');
      console.log(`[ChatRoom] Message sent. Total messages: ${messages.length + 1}`);
    }
  };

  const handleRefresh = () => {
    try {
      window.location.reload();
    } catch (err) {
      console.error('Failed to refresh page', err);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const openProfileEditor = () => {
    if (!user) return;
    const effectiveProfile = profile ?? user;
    setEditName(effectiveProfile.name);
    setEditFile(null);
    setEditPreview(effectiveProfile.profile_picture_url ?? null);
    setEditError(null);
    setIsProfileOpen(true);
  };

  const handleProfileFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditFile(file);
    setEditPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const effectiveProfile = profile ?? user;

    setEditSaving(true);
    setEditError(null);

    try {
      let newAvatarUrl: string | undefined = effectiveProfile.profile_picture_url;

      if (editFile) {
        const { url, error } = await uploadProfilePicture(editFile, user.id);
        if (error || !url) {
          throw new Error(error || 'Failed to upload profile picture');
        }
        newAvatarUrl = url;
      }

      if (editName !== effectiveProfile.name) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ name: editName })
          .eq('id', user.id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      }

      const updatedProfile = {
        ...effectiveProfile,
        name: editName,
        profile_picture_url: newAvatarUrl,
      };

      setProfile(updatedProfile);
      setIsProfileOpen(false);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update profile');
    } finally {
      setEditSaving(false);
    }
  };

  // While auth is restoring (e.g., after refresh or returning to the tab),
  // wait instead of forcing the user back to the login screen.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Restoring your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const effectiveProfile = profile ?? user;

  return (
    <div className="min-h-screen bg-white text-black/90 font-inter flex justify-center items-start md:items-center">
      <div className="flex flex-col h-screen md:h-[90vh] w-full bg-card md:w-[60vw] md:max-w-[1000px] md:aspect-[4/3] md:rounded-xl md:shadow-lg md:overflow-hidden">
      
      {/* Header */}
      <header className="border-b border-border p-4 flex items-center justify-between bg-card">
        <div>
          <img src="/logo.svg" alt="RVNZCOMM" className="w-8 h-8 ml-4 block" />
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={openProfileEditor}
            className="flex items-center gap-2 focus:outline-none hover:opacity-90"
          >
            {effectiveProfile.profile_picture_url ? (
              <img
                src={effectiveProfile.profile_picture_url}
                alt={effectiveProfile.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm">
                  {effectiveProfile.name[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-sm font-medium">{effectiveProfile.name}</span>
          </button>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isOwnMessage = message.user_id === user.id;
          return (
            <div
              key={message.id}
              className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              {message.user_avatar ? (
                <img
                  src={message.user_avatar}
                  alt={message.user_name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">{message.user_name[0].toUpperCase()}</span>
                </div>
              )}

              {/* Message content */}
              <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-muted-foreground mb-1">
                  {isOwnMessage ? 'You' : message.user_name}
                </span>
                <div
                  className={`px-4 py-2 rounded-lg max-w-md ${
                    isOwnMessage
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {renderMessageWithLinks(message.content)}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground mt-1">
                  {new Date(message.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          );
        })}
        
        {/* Typing indicator */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 pt-4 pb-12 bg-card">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button onClick={handleRefresh} variant="ghost" title="Refresh" aria-label="Refresh page">
            <RefreshCw size={16} />
          </Button>
          <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
            <Send size={16} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send
        </p>
      </div>

      {/* Profile Editor Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Edit Profile</h2>

            <div className="flex flex-col items-center mb-4">
              {editPreview ? (
                <img
                  src={editPreview}
                  alt="Preview"
                  className="w-20 h-20 rounded-full object-cover mb-2"
                />
              ) : effectiveProfile.profile_picture_url ? (
                <img
                  src={effectiveProfile.profile_picture_url}
                  alt={effectiveProfile.name}
                  className="w-20 h-20 rounded-full object-cover mb-2"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-2">
                  <span className="text-2xl">
                    {effectiveProfile.name[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleProfileFileChange}
                className="text-xs text-black/60 ml-26 hover:underline cursor-pointer"
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={effectiveProfile.email}
                  readOnly
                  className="w-full px-3 py-2 border border-border rounded-md bg-muted text-muted-foreground cursor-not-allowed"
                />
              </div>

              {editError && (
                <p className="text-sm text-destructive mt-1">{editError}</p>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsProfileOpen(false)}
                disabled={editSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveProfile}
                disabled={editSaving || !editName.trim()}
              >
                {editSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

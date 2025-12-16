export interface User {
  id: string;
  email: string;
  name: string;
  profile_picture_url?: string;
  created_at: string;
}

export interface Message {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  content: string;
  timestamp: string;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  timestamp: Date;
}

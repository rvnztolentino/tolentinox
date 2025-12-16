import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const { user, loading } = useAuth();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is already authenticated, redirect to chat
  if (user) {
    return <Navigate to="/chat" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-black/90 font-inter p-4">
      <div className="text-center max-w-2xl">
        <div className="flex items-center justify-center mb-8">
          <img src="/logo.svg" alt="RVNZCOMM" className="w-28 h-28 block" />
        </div>

        <h1 className="text-4xl font-bold mb-4">Welcome</h1>
        
        <p className="text-md text-black/60 mb-2">
          Private messaging for approved members only
        </p>

        <div className="flex flex-wrap justify-center gap-4 mt-4 mb-8">
          <Link to="/login">
            <Button size="lg">Sign In</Button>
          </Link>
          <Link to="/signup">
            <Button variant="outline" size="lg">Sign Up</Button>
          </Link>
        </div>

        <p className="inline font-mono text-yellow-600 bg-red-50 text-xs border border-red-200 rounded px-2 py-1">
          now in beta - invite only
        </p>
      </div>
    </div>
  );
}
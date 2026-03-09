import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Skull } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const ok = await login(password);
      if (ok) navigate('/dashboard');
      else setError('Invalid password');
    } catch {
      setError('Invalid password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Skull className="text-brand mx-auto mb-3" size={48} />
          <h1 className="text-2xl font-bold text-white">Dead Man's Switch</h1>
          <p className="text-gray-400 mt-1 text-sm">Enter your password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-light border border-border rounded-xl p-6 space-y-4">
          <Input
            type="password"
            placeholder="Master password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={loading || !password}>
            {loading ? 'Authenticating...' : 'Unlock'}
          </Button>
        </form>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getRecipient, testDelivery } from '../services/api.js';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit, Send, Mail, MessageCircle, Globe } from 'lucide-react';

export default function RecipientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipient, setRecipient] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    getRecipient(id).then(setRecipient).catch(() => toast.error('Failed to load'));
  }, [id]);

  const handleTest = async () => {
    setTesting(true);
    try {
      const results = await testDelivery(id);
      const failed = results.filter(r => r.status === 'failed');
      if (failed.length) toast.error(`Some deliveries failed: ${failed.map(f => f.method).join(', ')}`);
      else toast.success('Test delivery sent!');
    } catch { toast.error('Test failed'); }
    finally { setTesting(false); }
  };

  if (!recipient) return <p className="text-gray-400">Loading...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/recipients')}><ArrowLeft size={16} /></Button>
        <h2 className="text-2xl font-bold text-white">{recipient.name}</h2>
      </div>

      <Card className="space-y-3">
        <h3 className="font-medium text-gray-300">Delivery Methods</h3>
        {recipient.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail size={14} className="text-blue-400" />
            <span className="text-gray-200">{recipient.email}</span>
          </div>
        )}
        {recipient.telegram_chat_id && (
          <div className="flex items-center gap-2 text-sm">
            <MessageCircle size={14} className="text-blue-400" />
            <span className="text-gray-200">{recipient.telegram_chat_id}</span>
          </div>
        )}
        {recipient.webhook_url && (
          <div className="flex items-center gap-2 text-sm">
            <Globe size={14} className="text-blue-400" />
            <span className="text-gray-200 break-all">{recipient.webhook_url}</span>
          </div>
        )}
      </Card>

      <Card className="space-y-2">
        <h3 className="font-medium text-gray-300">Assigned Items ({recipient.items?.length || 0})</h3>
        {recipient.items?.length ? recipient.items.map(item => (
          <div key={item.id} className="flex items-center justify-between py-1">
            <Link to={`/vault/${item.id}`} className="text-gray-200 hover:text-white">{item.name}</Link>
            <Badge>{item.type}</Badge>
          </div>
        )) : <p className="text-gray-500 text-sm">No items assigned</p>}
      </Card>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={handleTest} disabled={testing}>
          <Send size={16} /> {testing ? 'Sending...' : 'Test Delivery'}
        </Button>
        <Link to={`/recipients/${id}/edit`}>
          <Button variant="outline"><Edit size={16} /> Edit</Button>
        </Link>
      </div>
    </div>
  );
}

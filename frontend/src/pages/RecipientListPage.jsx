import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRecipients, deleteRecipient } from '../services/api.js';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import toast from 'react-hot-toast';
import { Plus, Trash2, Eye, Mail, MessageCircle, Globe, Users } from 'lucide-react';

export default function RecipientListPage() {
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setRecipients(await getRecipients()); }
    catch { toast.error('Failed to load recipients'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete recipient "${name}"?`)) return;
    try {
      await deleteRecipient(id);
      toast.success('Recipient deleted');
      load();
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Recipients</h2>
        <Link to="/recipients/new"><Button><Plus size={16} /> Add Recipient</Button></Link>
      </div>

      {loading ? <p className="text-gray-400">Loading...</p> : recipients.length === 0 ? (
        <Card className="text-center py-12">
          <Users className="mx-auto text-gray-600 mb-3" size={48} />
          <p className="text-gray-400">No recipients yet</p>
          <Link to="/recipients/new" className="text-brand text-sm hover:underline mt-2 inline-block">Add your first recipient</Link>
        </Card>
      ) : (
        <div className="grid gap-3">
          {recipients.map(r => (
            <Card key={r.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white">{r.name}</p>
                <div className="flex gap-2 mt-1">
                  {r.email && <Badge variant="info"><Mail size={10} className="mr-1" /> Email</Badge>}
                  {r.telegram_chat_id && <Badge variant="info"><MessageCircle size={10} className="mr-1" /> Telegram</Badge>}
                  {r.webhook_url && <Badge variant="info"><Globe size={10} className="mr-1" /> Webhook</Badge>}
                  <Badge variant="default">{r.item_count} items</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/recipients/${r.id}`}>
                  <Button variant="ghost" size="sm"><Eye size={14} /></Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id, r.name)}>
                  <Trash2 size={14} className="text-red-400" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

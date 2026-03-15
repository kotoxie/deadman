import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createRecipient, getRecipient, updateRecipient, getVaultItems, assignItems } from '../services/api.js';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import toast from 'react-hot-toast';
import { FileText, KeyRound, Bitcoin, File, Layers } from 'lucide-react';

const typeIcons = { note: FileText, password: KeyRound, wallet: Bitcoin, file: File, custom: Layers };
const typeColors = { note: 'text-blue-400', password: 'text-yellow-400', wallet: 'text-orange-400', file: 'text-green-400', custom: 'text-purple-400' };

export default function RecipientFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [autoAssign, setAutoAssign] = useState(false);
  const [vaultItems, setVaultItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getVaultItems().then(setVaultItems).catch(() => {});
    if (isEdit) {
      getRecipient(id).then(r => {
        setName(r.name);
        setEmail(r.email || '');
        setTelegramChatId(r.telegram_chat_id || '');
        setWebhookUrl(r.webhook_url || '');
        setAutoAssign(!!r.auto_assign);
        setSelectedItems(r.items?.map(i => i.id) || []);
      }).catch(() => toast.error('Failed to load recipient'));
    }
  }, [id, isEdit]);

  const toggleItem = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId) ? prev.filter(i => i !== itemId) : [...prev, itemId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required');
    if (!email && !telegramChatId && !webhookUrl) return toast.error('At least one delivery method is required');
    setSaving(true);

    try {
      let recipientId;
      if (isEdit) {
        await updateRecipient(id, { name, email, telegramChatId, webhookUrl, autoAssign });
        recipientId = parseInt(id);
      } else {
        const r = await createRecipient({ name, email, telegramChatId, webhookUrl, autoAssign });
        recipientId = r.id;
      }

      await assignItems(recipientId, selectedItems);
      toast.success(isEdit ? 'Recipient updated' : 'Recipient created');
      navigate('/recipients');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold text-white">{isEdit ? 'Edit' : 'New'} Recipient</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" />

        <Card className="space-y-3">
          <h3 className="font-medium text-gray-300 text-sm">Delivery Methods</h3>
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" />
          <Input label="Telegram Chat ID" value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)} placeholder="123456789" />
          <Input label="Webhook URL" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://hooks.example.com/notify" />
        </Card>

        <Card>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoAssign}
              onChange={e => setAutoAssign(e.target.checked)}
              className="rounded border-gray-600"
            />
            <div>
              <span className="text-gray-200 text-sm">Auto-assign future vault items</span>
              <p className="text-xs text-gray-500">New vault items will be automatically assigned to this recipient</p>
            </div>
          </label>
        </Card>

        {vaultItems.length > 0 && (
          <Card className="space-y-1">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-gray-300 text-sm">Vault Items</h3>
                {selectedItems.length > 0 && (
                  <span className="text-xs bg-brand/20 text-brand px-2 py-0.5 rounded-full">
                    {selectedItems.length}/{vaultItems.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedItems(
                  selectedItems.length === vaultItems.length ? [] : vaultItems.map(i => i.id)
                )}
                className="text-xs text-brand hover:text-brand/80 transition-colors font-medium"
              >
                {selectedItems.length === vaultItems.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="space-y-1 pt-1">
              {vaultItems.map(item => {
                const Icon = typeIcons[item.type] || Layers;
                const checked = selectedItems.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      checked ? 'bg-brand/10 border border-brand/25' : 'hover:bg-surface-lighter border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(item.id)}
                      className="rounded border-gray-600 accent-brand"
                    />
                    <Icon size={16} className={typeColors[item.type] || 'text-gray-400'} />
                    <span className="text-gray-200 text-sm flex-1">{item.name}</span>
                    <span className="text-xs text-gray-500 capitalize bg-surface-lighter px-2 py-0.5 rounded">{item.type}</span>
                  </label>
                );
              })}
            </div>
          </Card>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}</Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/recipients')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

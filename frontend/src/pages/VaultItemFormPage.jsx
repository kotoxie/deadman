import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createVaultItem, getVaultItem, updateVaultItem } from '../services/api.js';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import toast from 'react-hot-toast';
import { useEffect } from 'react';

const TYPES = ['note', 'password', 'wallet', 'file', 'custom'];

export default function VaultItemFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [type, setType] = useState('note');
  const [name, setName] = useState('');
  const [content, setContent] = useState({});
  const [file, setFile] = useState(null);
  const [customFields, setCustomFields] = useState([{ key: '', value: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) {
      getVaultItem(id).then(item => {
        setType(item.type);
        setName(item.name);
        if (item.type === 'custom' && Array.isArray(item.content?.fields)) {
          setCustomFields(item.content.fields);
        } else if (item.content && typeof item.content === 'object') {
          setContent(item.content);
        } else if (typeof item.content === 'string') {
          setContent({ text: item.content });
        }
      }).catch(() => toast.error('Failed to load item'));
    }
  }, [id, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required');
    setSaving(true);

    try {
      let data;
      if (type === 'file') {
        if (!isEdit && !file) return toast.error('File is required');
        data = new FormData();
        data.append('type', type);
        data.append('name', name);
        if (file) data.append('file', file);
      } else {
        let itemContent;
        if (type === 'note') itemContent = { text: content.text || '' };
        else if (type === 'password') itemContent = { site: content.site || '', username: content.username || '', password: content.password || '' };
        else if (type === 'wallet') itemContent = { name: content.walletName || '', seedPhrase: content.seedPhrase || '', notes: content.notes || '' };
        else if (type === 'custom') itemContent = { fields: customFields.filter(f => f.key.trim()) };

        data = { type, name, content: JSON.stringify(itemContent) };
      }

      if (isEdit) await updateVaultItem(id, data);
      else await createVaultItem(data);

      toast.success(isEdit ? 'Item updated' : 'Item created');
      navigate('/vault');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold text-white">{isEdit ? 'Edit' : 'New'} Vault Item</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">Type</label>
            <div className="flex gap-2">
              {TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                    type === t ? 'bg-brand text-white' : 'bg-surface-lighter text-gray-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., My Bitcoin Wallet" />

        <Card className="space-y-3">
          {type === 'note' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">Note Content</label>
              <textarea
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-gray-100 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-brand/50"
                value={content.text || ''}
                onChange={e => setContent({ ...content, text: e.target.value })}
                placeholder="Your secret note..."
              />
            </div>
          )}

          {type === 'password' && (
            <>
              <Input label="Site / Service" value={content.site || ''} onChange={e => setContent({ ...content, site: e.target.value })} placeholder="https://example.com" />
              <Input label="Username" value={content.username || ''} onChange={e => setContent({ ...content, username: e.target.value })} />
              <Input label="Password" type="password" value={content.password || ''} onChange={e => setContent({ ...content, password: e.target.value })} />
            </>
          )}

          {type === 'wallet' && (
            <>
              <Input label="Wallet Name" value={content.walletName || ''} onChange={e => setContent({ ...content, walletName: e.target.value })} placeholder="e.g., Ledger Main" />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">Seed Phrase / Private Key</label>
                <textarea
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-gray-100 min-h-[80px] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                  value={content.seedPhrase || ''}
                  onChange={e => setContent({ ...content, seedPhrase: e.target.value })}
                  placeholder="word1 word2 word3..."
                />
              </div>
              <Input label="Notes" value={content.notes || ''} onChange={e => setContent({ ...content, notes: e.target.value })} placeholder="Optional notes" />
            </>
          )}

          {type === 'file' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">File</label>
              <input
                type="file"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-surface-lighter file:text-gray-300 hover:file:bg-gray-600"
              />
              {file && <p className="text-xs text-gray-500">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
            </div>
          )}

          {type === 'custom' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Custom Fields</label>
              {customFields.map((field, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder="Key"
                    value={field.key}
                    onChange={e => {
                      const updated = [...customFields];
                      updated[i] = { ...field, key: e.target.value };
                      setCustomFields(updated);
                    }}
                  />
                  <Input
                    placeholder="Value"
                    value={field.value}
                    onChange={e => {
                      const updated = [...customFields];
                      updated[i] = { ...field, value: e.target.value };
                      setCustomFields(updated);
                    }}
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => {
                    setCustomFields(customFields.filter((_, j) => j !== i));
                  }}>x</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setCustomFields([...customFields, { key: '', value: '' }])}>
                + Add Field
              </Button>
            </div>
          )}
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}</Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/vault')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

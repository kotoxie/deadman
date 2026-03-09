import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getVaultItem } from '../services/api.js';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import toast from 'react-hot-toast';
import { Copy, Edit, ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function VaultItemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    getVaultItem(id)
      .then(setItem)
      .catch(() => toast.error('Failed to load item'));
  }, [id]);

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (!item) return <p className="text-gray-400">Loading...</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/vault')}>
          <ArrowLeft size={16} />
        </Button>
        <h2 className="text-2xl font-bold text-white">{item.name}</h2>
        <Badge>{item.type}</Badge>
      </div>

      <Card className="space-y-4">
        {item.type === 'note' && (
          <div>
            <label className="text-sm text-gray-400">Content</label>
            <p className="text-gray-100 mt-1 whitespace-pre-wrap">{item.content?.text || item.content}</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => copyToClipboard(item.content?.text || String(item.content), 'Note')}>
              <Copy size={14} /> Copy
            </Button>
          </div>
        )}

        {item.type === 'password' && (
          <div className="space-y-3">
            <Field label="Site" value={item.content?.site} onCopy={copyToClipboard} />
            <Field label="Username" value={item.content?.username} onCopy={copyToClipboard} />
            <div>
              <label className="text-sm text-gray-400">Password</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-gray-100 font-mono bg-surface px-2 py-1 rounded">
                  {showSecrets ? item.content?.password : '••••••••••'}
                </code>
                <button onClick={() => setShowSecrets(!showSecrets)} className="text-gray-400 hover:text-white">
                  {showSecrets ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button onClick={() => copyToClipboard(item.content?.password, 'Password')} className="text-gray-400 hover:text-white">
                  <Copy size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {item.type === 'wallet' && (
          <div className="space-y-3">
            <Field label="Wallet" value={item.content?.name} onCopy={copyToClipboard} />
            <div>
              <label className="text-sm text-gray-400">Seed Phrase</label>
              <div className="mt-1">
                <code className="text-gray-100 font-mono text-sm bg-surface px-3 py-2 rounded block whitespace-pre-wrap">
                  {showSecrets ? item.content?.seedPhrase : '•••• •••• •••• •••• •••• ••••'}
                </code>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setShowSecrets(!showSecrets)} className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
                    {showSecrets ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Show</>}
                  </button>
                  <button onClick={() => copyToClipboard(item.content?.seedPhrase, 'Seed phrase')} className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
                    <Copy size={14} /> Copy
                  </button>
                </div>
              </div>
            </div>
            {item.content?.notes && <Field label="Notes" value={item.content.notes} onCopy={copyToClipboard} />}
          </div>
        )}

        {item.type === 'file' && (
          <div>
            <p className="text-gray-300">File: <span className="text-white font-medium">{item.file_name}</span></p>
            <p className="text-gray-500 text-sm">{item.file_mime_type} - {(item.file_size / 1024).toFixed(1)} KB</p>
            {item.content && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => {
                const binary = atob(item.content);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], { type: item.file_mime_type });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = item.file_name; a.click();
                URL.revokeObjectURL(url);
              }}>
                Download
              </Button>
            )}
          </div>
        )}

        {item.type === 'custom' && item.content?.fields && (
          <div className="space-y-2">
            {item.content.fields.map((f, i) => (
              <Field key={i} label={f.key} value={f.value} onCopy={copyToClipboard} />
            ))}
          </div>
        )}
      </Card>

      <Link to={`/vault/${id}/edit`}>
        <Button variant="outline"><Edit size={16} /> Edit</Button>
      </Link>
    </div>
  );
}

function Field({ label, value, onCopy }) {
  return (
    <div>
      <label className="text-sm text-gray-400">{label}</label>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-gray-100">{value}</span>
        {value && (
          <button onClick={() => onCopy(value, label)} className="text-gray-400 hover:text-white">
            <Copy size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

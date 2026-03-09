import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getVaultItems, deleteVaultItem } from '../services/api.js';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Badge from '../components/ui/Badge.jsx';
import toast from 'react-hot-toast';
import { Plus, FileText, KeyRound, Bitcoin, File, Layers, Trash2, Eye } from 'lucide-react';

const typeIcons = {
  note: FileText,
  password: KeyRound,
  wallet: Bitcoin,
  file: File,
  custom: Layers,
};

const typeColors = {
  note: 'text-blue-400',
  password: 'text-yellow-400',
  wallet: 'text-orange-400',
  file: 'text-green-400',
  custom: 'text-purple-400',
};

export default function VaultListPage() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await getVaultItems();
      setItems(data);
    } catch { toast.error('Failed to load vault'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await deleteVaultItem(id);
      toast.success('Item deleted');
      load();
    } catch { toast.error('Delete failed'); }
  };

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Vault</h2>
        <Link to="/vault/new">
          <Button><Plus size={16} /> Add Item</Button>
        </Link>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'note', 'password', 'wallet', 'file', 'custom'].map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
              filter === t ? 'bg-brand text-white' : 'bg-surface-lighter text-gray-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12">
          <Shield className="mx-auto text-gray-600 mb-3" size={48} />
          <p className="text-gray-400">No vault items yet</p>
          <Link to="/vault/new" className="text-brand text-sm hover:underline mt-2 inline-block">Add your first item</Link>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(item => {
            const Icon = typeIcons[item.type] || Layers;
            return (
              <Card key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={typeColors[item.type]} size={20} />
                  <div>
                    <p className="font-medium text-white">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.type} {item.file_size ? `- ${(item.file_size / 1024).toFixed(1)}KB` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{item.type}</Badge>
                  <Link to={`/vault/${item.id}`}>
                    <Button variant="ghost" size="sm"><Eye size={14} /></Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id, item.name)}>
                    <Trash2 size={14} className="text-red-400" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Shield(props) {
  return <Layers {...props} />;
}

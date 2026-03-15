import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../services/api.js';
import toast from 'react-hot-toast';

export function useSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then(s => { setSettings(s); setLoading(false); })
      .catch(() => toast.error('Failed to load settings'));
  }, []);

  const update = (key, value) => setSettings(s => ({ ...s, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings(settings);
      toast.success('Settings saved');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  return { settings, loading, saving, update, save };
}

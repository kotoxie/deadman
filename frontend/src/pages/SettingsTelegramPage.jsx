import { useState } from 'react';
import { Save, Send, MessageCircle } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import { useSettings } from '../hooks/useSettings.js';
import { testTelegram } from '../services/api.js';
import toast from 'react-hot-toast';

export default function SettingsTelegramPage() {
  const { settings, loading, saving, update, save } = useSettings();
  const [testTgChatId, setTestTgChatId] = useState('');

  if (loading) return <p className="text-gray-400">Loading…</p>;

  const handleTestTelegram = async () => {
    try {
      await testTelegram(testTgChatId);
      toast.success('Test message sent!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Test failed');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand/15 flex items-center justify-center">
          <MessageCircle size={18} className="text-brand" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">Telegram Bot</h2>
          <p className="text-xs text-gray-500">Configure Telegram for notifications and vault delivery</p>
        </div>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Bot Configuration</span>
        </div>

        <div className="space-y-1.5">
          <Input
            label="Bot Token"
            type="password"
            value={settings.telegram_bot_token || ''}
            onChange={e => update('telegram_bot_token', e.target.value)}
            placeholder="123456:ABC-DEF…"
          />
          <p className="text-xs text-gray-500">
            Create a bot via{' '}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              @BotFather
            </a>{' '}
            on Telegram to obtain a token.
          </p>
        </div>

        <hr className="border-border" />

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Test Connection</span>
        </div>

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              label="Send Test Message to Chat ID"
              value={testTgChatId}
              onChange={e => setTestTgChatId(e.target.value)}
              placeholder="123456789"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestTelegram}
            disabled={!testTgChatId}
          >
            <Send size={14} /> Send Test
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          To find your Chat ID, message{' '}
          <a
            href="https://t.me/userinfobot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            @userinfobot
          </a>{' '}
          on Telegram.
        </p>
      </Card>

      <Button onClick={save} disabled={saving} size="lg">
        <Save size={16} /> {saving ? 'Saving…' : 'Save Settings'}
      </Button>
    </div>
  );
}

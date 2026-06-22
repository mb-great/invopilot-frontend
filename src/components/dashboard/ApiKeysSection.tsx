'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import { Plus, Trash2, Key, Copy, Check } from 'lucide-react';
import PremiumBadge from '@/components/ui/PremiumBadge';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  created_at: string;
}

interface ApiKeysSectionProps {
  workspaceId: string;
  hasAccess: boolean; // True if Business tier
}

export default function ApiKeysSection({ workspaceId, hasAccess }: ApiKeysSectionProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (hasAccess && workspaceId) {
      fetchKeys();
    } else {
      setLoading(false);
    }
  }, [workspaceId, hasAccess]);

  const fetchKeys = async () => {
    try {
      const res = await fetch(`/api/workspaces/api-keys?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error('Failed to fetch API keys');
      const { data } = await res.json();
      setKeys(data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) return toast.error('Please enter a key name');
    try {
      const res = await fetch('/api/workspaces/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName, workspaceId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setKeys([data.data, ...keys]);
      setRawKey(data.rawKey);
      setIsAdding(false);
      setNewKeyName('');
      toast.success('API Key created');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This will break any integrations using it.')) return;
    try {
      const res = await fetch(`/api/workspaces/api-keys?id=${id}&workspaceId=${workspaceId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete key');
      setKeys(keys.filter(k => k.id !== id));
      toast.success('API Key revoked');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCopy = async () => {
    if (rawKey) {
      await copyToClipboard(rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard');
    }
  };

  if (!hasAccess) {
    return (
      <section className="glass-card p-8 bg-white border border-ink-100 shadow-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="flex items-center justify-between mb-6 relative">
          <div>
            <h3 className="text-xl font-bold text-ink-900 flex items-center gap-2">
              Developer API
              <PremiumBadge type="biz" />
            </h3>
            <p className="text-sm text-ink-500 mt-1">Automate invoice generation via our REST API.</p>
          </div>
        </div>
        <div className="bg-ink-50 p-6 rounded-xl border border-ink-100 text-center">
          <Key className="w-8 h-8 text-brand-500 mx-auto mb-3 opacity-50" />
          <h4 className="font-semibold text-ink-900 mb-2">API Access is a Business Tier Feature</h4>
          <p className="text-sm text-ink-500 mb-4 max-w-sm mx-auto">Upgrade your plan to generate API keys and integrate InvoPilot into your own applications and workflows.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="glass-card p-8 bg-white border border-ink-100 shadow-sm relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-ink-900 flex items-center gap-2">
            Developer API Keys
            <PremiumBadge type="biz" />
          </h3>
          <p className="text-sm text-ink-500 mt-1">Manage API keys for accessing the InvoPilot REST API.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          disabled={isAdding || rawKey !== null}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all hover:shadow-md disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Generate Key
        </button>
      </div>

      {rawKey && (
        <div className="mb-6 p-5 bg-brand-50 border border-brand-200 rounded-xl">
          <h4 className="font-bold text-brand-900 mb-2">Save your API Key</h4>
          <p className="text-sm text-brand-700 mb-4">Please copy this key and store it securely. For security reasons, you will <strong>never be able to see it again</strong>.</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 p-3 bg-white border border-brand-200 rounded-lg text-sm font-mono text-ink-900 break-all select-all">
              {rawKey}
            </code>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-sm"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button 
            onClick={() => setRawKey(null)}
            className="mt-4 text-sm font-semibold text-brand-600 hover:text-brand-800 underline"
          >
            I have saved it securely
          </button>
        </div>
      )}

      {isAdding && !rawKey && (
        <div className="mb-6 p-5 bg-ink-50 border border-ink-200 rounded-xl">
          <h4 className="font-semibold text-ink-900 mb-3">New API Key</h4>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="e.g. Zapier Integration"
              className="flex-1 input-standard"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              autoFocus
            />
            <button
              onClick={handleCreate}
              className="px-5 py-2 bg-ink-900 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-black transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => { setIsAdding(false); setNewKeyName(''); }}
              className="px-5 py-2 bg-white border border-ink-200 text-ink-700 text-sm font-semibold rounded-lg hover:bg-ink-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-6 text-ink-400 text-sm animate-pulse">Loading API keys...</div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8 bg-ink-50 rounded-xl border border-ink-100 border-dashed">
            <Key className="w-6 h-6 text-ink-300 mx-auto mb-2" />
            <p className="text-sm text-ink-500 font-medium">No API keys generated yet.</p>
          </div>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between p-4 bg-white border border-ink-200 rounded-xl hover:border-ink-300 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink-900">{key.name}</p>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-ink-500 font-medium">
                  <span className="font-mono bg-ink-50 px-2 py-0.5 rounded text-ink-600">{key.prefix}</span>
                  <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
                  <span>Last used: {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}</span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(key.id)}
                className="p-2 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Revoke Key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

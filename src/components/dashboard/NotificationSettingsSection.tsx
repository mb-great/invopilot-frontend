'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function NotificationSettingsSection({ 
  profile 
}: { 
  profile: any 
}) {
  const [loading, setLoading] = useState(false);
  const prefs = profile?.notification_preferences || { promotional: true, dues: true, recurring: true };
  const [promotional, setPromotional] = useState(prefs.promotional ?? true);
  const [dues, setDues] = useState(prefs.dues ?? true);
  const [recurring, setRecurring] = useState(prefs.recurring ?? true);

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/billing/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promotional,
          dues,
          recurring
        })
      });

      if (!response.ok) throw new Error('Failed to update preferences');
      toast.success('Notification preferences updated successfully.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass-card p-8 bg-white border border-ink-100 shadow-sm mt-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-ink-900 mb-2">Email Notifications</h2>
        <p className="text-ink-500 text-sm">Control which emails you receive from InvoPilot. We never spam.</p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">Overdue Reminders</Label>
            <p className="text-sm text-ink-500">Get a compact daily summary if you have overdue invoices.</p>
          </div>
          <Switch 
            checked={dues}
            onCheckedChange={setDues}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">Recurring Templates</Label>
            <p className="text-sm text-ink-500">Get notified when it's time to generate a recurring invoice.</p>
          </div>
          <Switch 
            checked={recurring}
            onCheckedChange={setRecurring}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">Promotional & Updates</Label>
            <p className="text-sm text-ink-500">Occasional tips, feature updates, and InvoPilot news.</p>
          </div>
          <Switch 
            checked={promotional}
            onCheckedChange={setPromotional}
          />
        </div>

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSave} disabled={loading} className="bg-brand-500 hover:bg-brand-600">
            {loading ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </div>
    </section>
  );
}

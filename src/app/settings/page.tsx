'use client';
import { useState, useEffect } from 'react';
import { useRealtimeData } from '@/hooks/useRealtimeData';
import { updateItem, setItem } from '@/lib/firebaseHelpers';
import { SystemConfig, User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { objectToArray } from '@/lib/firebaseHelpers';
import { toast } from 'sonner';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  const { data: configRaw, loading } = useRealtimeData<SystemConfig>('/config');
  const { data: usersRaw } = useRealtimeData<Record<string, User>>('/users');
  const { adminName } = useAuth();

  const admins = objectToArray<User>(usersRaw).filter((u) => u.role === 'admin');

  const [config, setConfig] = useState<SystemConfig>({
    announcement_banner: '',
    maintenance_mode: false,
    tracking_interval: 5,
    geofence_radius_default: 300,
    max_eta_display: 120,
    sos_helpline: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (configRaw) {
      setConfig({ ...config, ...configRaw });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configRaw]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setItem('/config', config as Record<string, unknown>);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Admin Users */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <SettingsIcon size={15} />
            Admin Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 mb-1">Current admins</p>
            <div className="space-y-1">
              {admins.length === 0 ? (
                <p className="text-sm text-gray-400">No admin users found</p>
              ) : admins.map((admin) => (
                <div key={admin.id} className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded text-sm">
                  <span className="font-medium">{admin.name || '—'}</span>
                  <span className="text-gray-400">{admin.phone}</span>
                  <Badge variant="outline" className="text-xs ml-auto">Admin</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-gray-400 border rounded p-2 bg-blue-50 text-blue-700">
            Logged in as: <strong>{adminName}</strong>. To add admin users, create a Firebase Auth user and set their role to &quot;admin&quot; in /users/.
          </div>
        </CardContent>
      </Card>

      {/* System Configuration */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">System Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <>
              <div className="space-y-1">
                <Label>Announcement Banner</Label>
                <Textarea
                  value={config.announcement_banner || ''}
                  onChange={(e) => setConfig({ ...config, announcement_banner: e.target.value })}
                  placeholder="Leave empty for no announcement..."
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <Label>Maintenance Mode</Label>
                  <p className="text-xs text-gray-400">Disables the driver app</p>
                </div>
                <Switch
                  checked={!!config.maintenance_mode}
                  onCheckedChange={(v) => setConfig({ ...config, maintenance_mode: v })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tracking Interval (seconds)</Label>
                  <Input
                    type="number"
                    value={config.tracking_interval || 5}
                    onChange={(e) => setConfig({ ...config, tracking_interval: +e.target.value })}
                    min={1} max={60}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Default Geofence Radius (m)</Label>
                  <Input
                    type="number"
                    value={config.geofence_radius_default || 300}
                    onChange={(e) => setConfig({ ...config, geofence_radius_default: +e.target.value })}
                    min={50}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Max ETA Display (minutes)</Label>
                  <Input
                    type="number"
                    value={config.max_eta_display || 120}
                    onChange={(e) => setConfig({ ...config, max_eta_display: +e.target.value })}
                    min={1}
                  />
                </div>
                <div className="space-y-1">
                  <Label>SOS Helpline Number</Label>
                  <Input
                    type="tel"
                    value={config.sos_helpline || ''}
                    onChange={(e) => setConfig({ ...config, sos_helpline: e.target.value })}
                    placeholder="+91XXXXXXXXXX"
                  />
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#1976d2] hover:bg-[#1565c0] text-white"
              >
                <Save size={14} className="mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Firebase Config Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Firebase Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-2">Environment variables required (set in .env.local):</p>
          <div className="bg-gray-900 text-green-400 rounded p-3 text-xs font-mono space-y-0.5">
            {[
              'NEXT_PUBLIC_FIREBASE_API_KEY',
              'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
              'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
              'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
              'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
              'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
              'NEXT_PUBLIC_FIREBASE_APP_ID',
            ].map((v) => (
              <div key={v} className="flex items-center gap-2">
                <span className="text-yellow-400">{v}</span>
                <span className="text-gray-500">=</span>
                <span className="text-green-400 italic">your_value_here</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

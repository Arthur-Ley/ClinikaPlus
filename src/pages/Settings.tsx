import { useMemo, useState } from 'react';
import { Save, ShieldCheck, Bell, UserCog } from 'lucide-react';

export default function Settings() {
  const [displayName, setDisplayName] = useState('Clinic Admin');
  const [email, setEmail] = useState('admin@clinikapluss.local');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [savedAt, setSavedAt] = useState('');

  const canSave = useMemo(() => displayName.trim() && email.trim(), [displayName, email]);

  function handleSave() {
    if (!canSave) return;
    setSavedAt(new Date().toLocaleString('en-US'));
  }

  return (
    <div className="space-y-5">
      <section className="space-y-5 rounded-2xl bg-gray-300/80 p-5">
        <article className="rounded-2xl border border-gray-200 bg-gray-100 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-700">
            <UserCog className="h-5 w-5 text-blue-600" />
            Profile Preferences
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-gray-700">
              Display Name
              <input
                className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <label className="text-sm text-gray-700">
              Email
              <input
                className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-gray-100 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-700">
            <Bell className="h-5 w-5 text-blue-600" />
            Notification Preferences
          </h2>
          <div className="space-y-3 text-sm text-gray-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={alertsEnabled}
                onChange={(event) => setAlertsEnabled(event.target.checked)}
              />
              Enable critical inventory alerts
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefreshEnabled}
                onChange={(event) => setAutoRefreshEnabled(event.target.checked)}
              />
              Enable dashboard auto-refresh
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-gray-200 bg-gray-100 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-700">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            Session
          </h2>
          <p className="text-sm text-gray-600">This demo session uses local in-browser state for account/session actions.</p>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            Save Settings
          </button>
          {savedAt && <p className="mt-2 text-xs text-green-700">Saved on {savedAt}</p>}
        </article>
      </section>
    </div>
  );
}

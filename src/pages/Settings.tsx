import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Loader2, LockKeyhole, Mail, MonitorCog, Save, Send, ShieldCheck, User, UserCog } from 'lucide-react';

type SettingsTab = 'user' | 'system';
type SystemMode = 'integrated' | 'standalone';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('user');
  const [fullName, setFullName] = useState('Clinic Admin');
  const [email, setEmail] = useState('admin@clinikapluss.local');
  const [password, setPassword] = useState('password123');
  const role = 'Pharmacist';
  const [showEmailUpdateForm, setShowEmailUpdateForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailAuthPassword, setEmailAuthPassword] = useState('');
  const [emailUpdateError, setEmailUpdateError] = useState('');
  const [emailUpdateNotice, setEmailUpdateNotice] = useState('');
  const [showPasswordUpdateForm, setShowPasswordUpdateForm] = useState(false);
  const [currentPasswordForChange, setCurrentPasswordForChange] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordUpdateError, setPasswordUpdateError] = useState('');
  const [passwordUpdateNotice, setPasswordUpdateNotice] = useState('');
  const [tabLoading, setTabLoading] = useState(true);
  const [isTabContentVisible, setIsTabContentVisible] = useState(true);
  const [systemMode, setSystemMode] = useState<SystemMode>('integrated');
  const [isModeSwitching, setIsModeSwitching] = useState(false);
  const [targetSystemMode, setTargetSystemMode] = useState<SystemMode | null>(null);
  const [savedAt, setSavedAt] = useState('');

  const canSave = useMemo(
    () => fullName.trim() && email.trim() && password.trim(),
    [email, fullName, password],
  );

  function handleSave() {
    if (!canSave) return;
    setSavedAt(new Date().toLocaleString('en-US'));
  }

  function handleSendEmailVerificationLink() {
    const nextEmail = newEmail.trim().toLowerCase();
    const currentEmail = email.trim().toLowerCase();

    setEmailUpdateError('');
    setEmailUpdateNotice('');

    if (!nextEmail) {
      setEmailUpdateError('Please enter a new email address.');
      return;
    }

    if (nextEmail === currentEmail) {
      setEmailUpdateError('New email must be different from your current email.');
      return;
    }

    if (!emailAuthPassword.trim()) {
      setEmailUpdateError('Please enter your password to verify this change.');
      return;
    }

    // Frontend-only feedback until backend endpoint is wired.
    setEmailUpdateNotice(`Verification link sent to ${nextEmail}. Complete verification to finalize your email change.`);
  }

  function handleChangePassword() {
    setPasswordUpdateError('');
    setPasswordUpdateNotice('');

    if (!currentPasswordForChange.trim()) {
      setPasswordUpdateError('Please enter your current password.');
      return;
    }

    if (!newPassword.trim()) {
      setPasswordUpdateError('Please enter a new password.');
      return;
    }

    if (newPassword.trim().length < 8) {
      setPasswordUpdateError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordUpdateError('New password and confirmation do not match.');
      return;
    }

    if (newPassword === currentPasswordForChange) {
      setPasswordUpdateError('New password must be different from your current password.');
      return;
    }

    // Frontend-only feedback until backend endpoint is wired.
    setPassword(newPassword);
    setCurrentPasswordForChange('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordUpdateNotice('Password updated successfully. A security notification will be sent to your email.');
  }

  function handleSystemModeChange(nextMode: SystemMode) {
    if (isModeSwitching || nextMode === systemMode) {
      return;
    }

    setIsModeSwitching(true);
    setTargetSystemMode(nextMode);

    window.setTimeout(() => {
      setSystemMode(nextMode);
      setIsModeSwitching(false);
      setTargetSystemMode(null);
    }, 1800);
  }

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof UserCog }> = [
    { id: 'user', label: 'User Settings', icon: UserCog },
    { id: 'system', label: 'System Settings', icon: MonitorCog },
  ];

  useEffect(() => {
    setTabLoading(true);
    setIsTabContentVisible(false);

    const fadeTimer = window.setTimeout(() => {
      setIsTabContentVisible(true);
    }, 180);

    const timer = window.setTimeout(() => {
      setTabLoading(false);
    }, 700);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(timer);
    };
  }, [activeTab]);

  return (
    <div className="flex h-full min-h-0 flex-col pb-4">
      <section className="flex flex-1 min-h-0 flex-col rounded-2xl bg-gray-300/80 p-5">
        <article className="flex min-h-0 flex-1 flex-col rounded-2xl bg-gray-100 p-4 md:p-5">
          <div className="flex items-center justify-start">
            <div className="relative inline-grid w-full grid-cols-2 rounded-xl border border-gray-200 bg-white p-1 md:w-[420px]">
              <span
                aria-hidden
                className={`pointer-events-none absolute left-1 top-1 h-[calc(100%-0.5rem)] w-[calc(50%-0.25rem)] rounded-lg bg-blue-600 shadow-sm transition-transform duration-300 ease-out ${
                  activeTab === 'user' ? 'translate-x-0' : 'translate-x-full'
                }`}
              />
              {tabs.map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors duration-300 ${
                      isActive ? 'text-white' : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={`mt-4 min-h-0 flex-1 overflow-y-auto rounded-xl transition-opacity duration-700 ease-in-out ${
              isTabContentVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {activeTab === 'user' ? (
              <div className="h-full w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
                {tabLoading ? (
                  <div>
                    <div className="mb-4 h-7 w-44 animate-pulse rounded-md bg-gray-200" />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                        <div className="mt-1 h-10 animate-pulse rounded-lg bg-gray-100" />
                      </div>
                      <div>
                        <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                        <div className="mt-1 h-10 animate-pulse rounded-lg bg-gray-100" />
                      </div>
                      <div>
                        <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                        <div className="mt-1 h-10 animate-pulse rounded-lg bg-gray-100" />
                      </div>
                      <div>
                        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                        <div className="mt-1 h-10 animate-pulse rounded-lg bg-gray-100" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-700">
                      <UserCog className="h-5 w-5 text-blue-600" />
                      User Settings
                    </h2>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="text-sm text-gray-700">
                        <span className="flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-600" />
                          Full Name
                        </span>
                        <div className="mt-1 flex h-10 items-center rounded-lg border border-gray-300 bg-white px-3 focus-within:ring-2 focus-within:ring-blue-300">
                          <User className="h-4 w-4 text-gray-400" />
                          <input
                            className="h-full w-full bg-transparent px-2 outline-none"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                          />
                        </div>
                      </label>

                      <label className="text-sm text-gray-700">
                        <span className="flex items-center gap-2">
                          <BadgeCheck className="h-4 w-4 text-blue-600" />
                          Role
                        </span>
                        <div className="mt-1 flex h-10 items-center px-1">
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">
                            {role}
                          </span>
                        </div>
                      </label>

                      <label className="text-sm text-gray-700">
                        <span className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-blue-600" />
                          Email
                        </span>
                        <div className="mt-1 flex h-10 items-center rounded-lg border border-gray-300 bg-white px-3 focus-within:ring-2 focus-within:ring-blue-300">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <input
                            className="h-full w-full bg-transparent px-2 outline-none"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setShowEmailUpdateForm((prev) => !prev);
                              setEmailUpdateError('');
                              setEmailUpdateNotice('');
                            }}
                            className="ml-2 whitespace-nowrap rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700 transition hover:bg-blue-100"
                          >
                            {showEmailUpdateForm ? 'Cancel' : 'Change Email'}
                          </button>
                        </div>
                      </label>

                      {showEmailUpdateForm ? (
                        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 md:col-span-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                            <ShieldCheck className="h-4 w-4" />
                            Secure Email Update
                          </div>
                          <p className="mt-1 text-xs text-blue-700">
                            For account security, confirm your password and send a verification link to your new email.
                          </p>

                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <label className="text-sm text-gray-700">
                              <span className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-blue-600" />
                                New Email
                              </span>
                              <div className="mt-1 flex h-10 items-center rounded-lg border border-gray-300 bg-white px-3 focus-within:ring-2 focus-within:ring-blue-300">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <input
                                  type="email"
                                  className="h-full w-full bg-transparent px-2 outline-none"
                                  value={newEmail}
                                  onChange={(event) => setNewEmail(event.target.value)}
                                  placeholder="new-email@domain.com"
                                />
                              </div>
                            </label>

                            <label className="text-sm text-gray-700">
                              <span className="flex items-center gap-2">
                                <LockKeyhole className="h-4 w-4 text-blue-600" />
                                Input Password
                              </span>
                              <div className="mt-1 flex h-10 items-center rounded-lg border border-gray-300 bg-white px-3 focus-within:ring-2 focus-within:ring-blue-300">
                                <LockKeyhole className="h-4 w-4 text-gray-400" />
                                <input
                                  type="password"
                                  className="h-full w-full bg-transparent px-2 outline-none"
                                  value={emailAuthPassword}
                                  onChange={(event) => setEmailAuthPassword(event.target.value)}
                                  placeholder="Enter current password"
                                />
                              </div>
                            </label>
                          </div>

                          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <button
                              type="button"
                              onClick={handleSendEmailVerificationLink}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                              <Send className="h-4 w-4" />
                              Send Verification Link
                            </button>
                            <p className="text-xs text-gray-600">No OTP needed. Link-based verification confirms ownership of the new email.</p>
                          </div>

                          {emailUpdateError ? <p className="mt-2 text-xs font-semibold text-red-600">{emailUpdateError}</p> : null}
                          {emailUpdateNotice ? <p className="mt-2 text-xs font-semibold text-green-700">{emailUpdateNotice}</p> : null}
                        </div>
                      ) : null}

                      <label className="text-sm text-gray-700">
                        <span className="flex items-center gap-2">
                          <LockKeyhole className="h-4 w-4 text-blue-600" />
                          Password
                        </span>
                        <div className="mt-1 flex h-10 items-center rounded-lg border border-gray-300 bg-white px-3 focus-within:ring-2 focus-within:ring-blue-300">
                          <LockKeyhole className="h-4 w-4 text-gray-400" />
                          <input
                            type="password"
                            className="h-full w-full bg-transparent px-2 outline-none"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setShowPasswordUpdateForm((prev) => !prev);
                              setPasswordUpdateError('');
                              setPasswordUpdateNotice('');
                            }}
                            className="ml-2 whitespace-nowrap rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700 transition hover:bg-blue-100"
                          >
                            {showPasswordUpdateForm ? 'Cancel' : 'Change Password'}
                          </button>
                        </div>
                      </label>

                      {showPasswordUpdateForm ? (
                        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 md:col-span-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                            <ShieldCheck className="h-4 w-4" />
                            Secure Password Update
                          </div>
                          <p className="mt-1 text-xs text-blue-700">
                            Confirm your current password and set a new strong password.
                          </p>

                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                            <label className="text-sm text-gray-700">
                              <span className="flex items-center gap-2">
                                <LockKeyhole className="h-4 w-4 text-blue-600" />
                                Current Password
                              </span>
                              <div className="mt-1 flex h-10 items-center rounded-lg border border-gray-300 bg-white px-3 focus-within:ring-2 focus-within:ring-blue-300">
                                <LockKeyhole className="h-4 w-4 text-gray-400" />
                                <input
                                  type="password"
                                  className="h-full w-full bg-transparent px-2 outline-none"
                                  value={currentPasswordForChange}
                                  onChange={(event) => setCurrentPasswordForChange(event.target.value)}
                                  placeholder="Current password"
                                />
                              </div>
                            </label>

                            <label className="text-sm text-gray-700">
                              <span className="flex items-center gap-2">
                                <LockKeyhole className="h-4 w-4 text-blue-600" />
                                New Password
                              </span>
                              <div className="mt-1 flex h-10 items-center rounded-lg border border-gray-300 bg-white px-3 focus-within:ring-2 focus-within:ring-blue-300">
                                <LockKeyhole className="h-4 w-4 text-gray-400" />
                                <input
                                  type="password"
                                  className="h-full w-full bg-transparent px-2 outline-none"
                                  value={newPassword}
                                  onChange={(event) => setNewPassword(event.target.value)}
                                  placeholder="At least 8 characters"
                                />
                              </div>
                            </label>

                            <label className="text-sm text-gray-700">
                              <span className="flex items-center gap-2">
                                <LockKeyhole className="h-4 w-4 text-blue-600" />
                                Confirm Password
                              </span>
                              <div className="mt-1 flex h-10 items-center rounded-lg border border-gray-300 bg-white px-3 focus-within:ring-2 focus-within:ring-blue-300">
                                <LockKeyhole className="h-4 w-4 text-gray-400" />
                                <input
                                  type="password"
                                  className="h-full w-full bg-transparent px-2 outline-none"
                                  value={confirmNewPassword}
                                  onChange={(event) => setConfirmNewPassword(event.target.value)}
                                  placeholder="Re-enter new password"
                                />
                              </div>
                            </label>
                          </div>

                          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <button
                              type="button"
                              onClick={handleChangePassword}
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                            >
                              <Send className="h-4 w-4" />
                              Update Password
                            </button>
                            <p className="text-xs text-gray-600">Password changes require current-password confirmation for security.</p>
                          </div>

                          {passwordUpdateError ? <p className="mt-2 text-xs font-semibold text-red-600">{passwordUpdateError}</p> : null}
                          {passwordUpdateNotice ? <p className="mt-2 text-xs font-semibold text-green-700">{passwordUpdateNotice}</p> : null}
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="h-full w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
                {tabLoading ? (
                  <div>
                    <div className="mb-4 h-7 w-48 animate-pulse rounded-md bg-gray-200" />
                    <div className="rounded-2xl border border-gray-200 bg-[#F5F7FA] p-5">
                      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                        <div className="w-full space-y-3 md:max-w-[70%]">
                          <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                          <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
                          <div className="h-3 w-5/6 animate-pulse rounded bg-gray-200" />
                        </div>
                        <div className="h-12 w-full animate-pulse rounded-xl bg-gray-200 md:w-64" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-gray-700">
                      <MonitorCog className="h-5 w-5 text-blue-600" />
                      System Settings
                    </h2>

                    <div className="rounded-2xl border border-gray-200 bg-[#F5F7FA] p-5">
                      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-blue-600" />
                            <p className="text-sm font-semibold text-gray-700">Mode</p>
                          </div>
                          <p className="text-sm text-gray-600">
                            Integrated mode is for use with connected modules. Standalone mode is for using this subsystem on its own.
                          </p>
                        </div>

                        {isModeSwitching ? (
                          <div className="inline-flex h-[42px] w-[220px] items-center justify-center rounded-xl border border-gray-200 bg-white">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.3s]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600 [animation-delay:-0.15s]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-blue-600" />
                            </div>
                          </div>
                        ) : (
                          <div className="relative inline-grid grid-cols-2 rounded-xl border border-gray-200 bg-white p-1">
                            <span
                              aria-hidden
                              className={`pointer-events-none absolute left-1 top-1 h-[calc(100%-0.5rem)] w-[calc(50%-0.25rem)] rounded-lg bg-blue-600 shadow-sm transition-transform duration-300 ease-out ${
                                systemMode === 'integrated' ? 'translate-x-0' : 'translate-x-full'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => handleSystemModeChange('integrated')}
                              className={`relative z-10 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-300 ${
                                systemMode === 'integrated' ? 'text-white' : 'text-gray-600 hover:text-gray-800'
                              }`}
                            >
                              Integrated
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSystemModeChange('standalone')}
                              className={`relative z-10 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-300 ${
                                systemMode === 'standalone' ? 'text-white' : 'text-gray-600 hover:text-gray-800'
                              }`}
                            >
                              Standalone
                            </button>
                          </div>
                        )}
                      </div>

                      {isModeSwitching ? (
                        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
                          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Applying {targetSystemMode || systemMode} mode. Please wait...
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
                            <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-600" />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
            <p>This page currently uses frontend-only state and is not wired to backend settings yet.</p>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              Save Settings
            </button>
          </div>
          {savedAt ? <p className="mt-2 text-xs text-green-700">Saved on {savedAt}</p> : null}
        </article>
      </section>
    </div>
  );
}

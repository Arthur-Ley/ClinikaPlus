import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/auth/AuthShell';
import AuthTextField from '../components/auth/AuthTextField';
import Button from '../components/ui/Button';

type SignInErrors = {
  identifier?: string;
  password?: string;
};

export default function SignInPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<SignInErrors>({});
  const [formMessage, setFormMessage] = useState('');

  function validate() {
    const nextErrors: SignInErrors = {};

    if (!identifier.trim()) {
      nextErrors.identifier = 'Email or username is required.';
    }

    if (!password.trim()) {
      nextErrors.password = 'Password is required.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage('');

    if (!validate()) return;

    window.localStorage.setItem('isLoggedIn', 'true');
    setFormMessage('Sign in successful. Redirecting to the dashboard...');
    navigate('/dashboard');
  }

  return (
    <AuthShell
      title="Sign In"
      footer={
        <p className="text-center text-sm text-gray-600">
          <span>Don&apos;t have an account? </span>
          <Link to="/signup" className="font-semibold text-blue-600 hover:text-blue-700">
            Create an account
          </Link>
        </p>
      }
    >
      <div>
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <AuthTextField
            label="Email or Username"
            value={identifier}
            onChange={(value) => {
              setIdentifier(value);
              if (errors.identifier) setErrors((current) => ({ ...current, identifier: undefined }));
            }}
            placeholder="doctor@clinikaplus.com or frontdesk01"
            autoComplete="username"
            error={errors.identifier}
          />

          <AuthTextField
            label="Password"
            type="password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              if (errors.password) setErrors((current) => ({ ...current, password: undefined }));
            }}
            placeholder="Enter your password"
            autoComplete="current-password"
            error={errors.password}
          />

          {formMessage ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              {formMessage}
            </div>
          ) : null}

          <Button type="submit" className="w-full rounded-md py-2.5 text-sm font-semibold shadow-none">
            Sign In
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}

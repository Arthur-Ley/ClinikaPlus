import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/auth/AuthShell';
import AuthTextField from '../components/auth/AuthTextField';
import Button from '../components/ui/Button';

type SignUpErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export default function SignUpPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [formMessage, setFormMessage] = useState('');

  function validate() {
    const nextErrors: SignUpErrors = {};

    if (!fullName.trim()) {
      nextErrors.fullName = 'Full name is required.';
    }

    if (!email.trim()) {
      nextErrors.email = 'Email is required.';
    }

    if (!password.trim()) {
      nextErrors.password = 'Password is required.';
    }

    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage('');

    if (!validate()) return;

    window.localStorage.setItem(
      'clinikaplusSignupDraft',
      JSON.stringify({
        fullName: fullName.trim(),
        email: email.trim(),
      }),
    );

    setFormMessage('Account created successfully. Redirecting to sign in...');
    navigate('/signin');
  }

  return (
    <AuthShell
      title="Create Account"
      footer={
        <p className="text-center text-sm text-gray-600">
          <span>Already have an account? </span>
          <Link to="/signin" className="font-semibold text-blue-600 hover:text-blue-700">
            Sign In
          </Link>
        </p>
      }
    >
      <div>
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <AuthTextField
            label="Full Name"
            value={fullName}
            onChange={(value) => {
              setFullName(value);
              if (errors.fullName) setErrors((current) => ({ ...current, fullName: undefined }));
            }}
            placeholder="Maria Santos"
            autoComplete="name"
            error={errors.fullName}
          />

          <AuthTextField
            label="Email"
            type="email"
            value={email}
            onChange={(value) => {
              setEmail(value);
              if (errors.email) setErrors((current) => ({ ...current, email: undefined }));
            }}
            placeholder="maria@clinikaplus.com"
            autoComplete="email"
            error={errors.email}
          />

          <AuthTextField
            label="Password"
            type="password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              if (errors.password || errors.confirmPassword) {
                setErrors((current) => ({ ...current, password: undefined, confirmPassword: undefined }));
              }
            }}
            placeholder="Create a password"
            autoComplete="new-password"
            error={errors.password}
          />

          <AuthTextField
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value);
              if (errors.confirmPassword) setErrors((current) => ({ ...current, confirmPassword: undefined }));
            }}
            placeholder="Confirm your password"
            autoComplete="new-password"
            error={errors.confirmPassword}
          />

          {formMessage ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              {formMessage}
            </div>
          ) : null}

          <Button type="submit" className="w-full rounded-md py-2.5 text-sm font-semibold shadow-none">
            Create Account
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}

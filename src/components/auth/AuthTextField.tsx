import { Eye, EyeOff } from 'lucide-react';
import { useId, useState } from 'react';

type AuthTextFieldProps = {
  label: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
};

export default function AuthTextField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
}: AuthTextFieldProps) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;

  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm font-semibold text-gray-700">{label}</span>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`w-full rounded-md border bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 ${
            error
              ? 'border-red-300 ring-2 ring-red-100'
              : 'border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
          } ${isPassword ? 'pr-12' : ''}`}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-md p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : null}
      </div>
      {error ? <span className="mt-2 block text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

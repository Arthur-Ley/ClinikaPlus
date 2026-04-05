import type { ReactNode } from 'react';
import { HeartPulse } from 'lucide-react';

type AuthShellProps = {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AuthShell({ title, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA] px-4 py-8 text-gray-800">
      <div className="w-full max-w-[440px] rounded-xl border border-gray-200 bg-white p-8">
        <div className="mb-6">
          <div className="mb-5 flex items-center gap-2.5 text-blue-600">
            <HeartPulse size={24} />
            <span className="text-lg font-bold tracking-tight">CLINIKA+</span>
          </div>
          <div className="mb-4 h-1 w-16 rounded-full bg-blue-600" />
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
        </div>

        <div>
          {children}
          {footer ? <div className="mt-5">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

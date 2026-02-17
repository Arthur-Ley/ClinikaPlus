import { Search, CircleUserRound } from 'lucide-react';

export default function Header() {
  return (
    <header className="relative z-20 h-16 bg-[#F5F7FA] px-5 flex items-center justify-end">
      <div className="flex items-center gap-3">
        <div className="relative w-[320px] max-w-[50vw]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
          <input
            type="text"
            placeholder="Search for anything"
            className="w-full h-10 rounded-lg border border-blue-100 bg-blue-100 px-9 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <button type="button" className="text-blue-600">
          <CircleUserRound size={26} />
        </button>
      </div>
    </header>
  );
}

import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.tsx';
import Header from '../components/Header.tsx';

export default function MainLayout() {
  return (
    <div className="fixed inset-0 flex bg-[#F5F7FA] text-gray-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="relative isolate z-0 flex-1 overflow-y-auto bg-[#F5F7FA] px-5 pb-0 pt-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

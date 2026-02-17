import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar.tsx';
import Header from '../components/Header.tsx';

export default function MainLayout() {
  return (
    <div className="flex h-screen bg-[#F5F7FA] overflow-hidden text-gray-800">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="relative isolate z-0 flex-1 overflow-auto p-5 bg-[#F5F7FA]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

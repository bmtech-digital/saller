import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  LogOut,
  Menu,
  X,
  Bug,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [influencersOpen, setInfluencersOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Items under "משפיענים" dropdown
  const influencersItems = [
    { path: '/', icon: LayoutDashboard, label: 'ההצעות שלי' },
    { path: '/proposals/new', icon: FileText, label: 'הצעה חדשה' },
  ];

  const navItems = [
    { path: '/customers', icon: Users, label: 'לקוחות' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <header className="lg:hidden bg-white border-b border-dark-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-dark-100"
        >
          <Menu className="w-6 h-6" />
        </button>
        <img src="/logo/logo.png" alt="לוגו" className="h-10" />
        <div className="w-10" />
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full w-64 bg-dark-900 text-white z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        } lg:right-0`}
      >
        <div className="p-6 flex items-center justify-between">
          <img src="/logo/logo-white.png" alt="לוגו" className="h-12" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-dark-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="px-4 space-y-1">
          {/* משפיענים Dropdown */}
          <div>
            <button
              onClick={() => setInfluencersOpen(!influencersOpen)}
              className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors ${
                influencersItems.some(item => location.pathname === item.path)
                  ? 'bg-dark-800 text-white'
                  : 'text-dark-300 hover:bg-dark-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5" />
                <span>משפיענים</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${influencersOpen ? 'rotate-180' : ''}`} />
            </button>

            {influencersOpen && (
              <div className="mt-1 mr-4 space-y-1">
                {influencersItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary-500 text-white'
                          : 'text-dark-400 hover:bg-dark-800 hover:text-white'
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Other nav items */}
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-500 text-white'
                    : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-dark-800">
          <div className="px-4 py-2 mb-2 text-sm text-dark-400">
            {user?.email}
          </div>
          <Link
            to="/logs"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 w-full px-4 py-2 rounded-lg text-dark-400 hover:bg-dark-800 hover:text-red-400 transition-colors mb-2"
          >
            <Bug className="w-4 h-4" />
            <span className="text-sm">לוגים</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-dark-300 hover:bg-dark-800 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>התנתק</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:mr-64 min-h-screen">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

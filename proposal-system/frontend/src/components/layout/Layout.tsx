import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  LogOut,
  Menu,
  X,
  Bug,
  ChevronDown
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { PROJECT_TYPES, type ProjectTypeId } from '../../config/projectTypes';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openTypeId, setOpenTypeId] = useState<ProjectTypeId | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentTypeFromQuery = (() => {
    const params = new URLSearchParams(location.search);
    return params.get('type') as ProjectTypeId | null;
  })();

  const isProposalRoute = location.pathname === '/' || location.pathname === '/proposals/new';

  const isActiveTypeDropdown = (typeId: ProjectTypeId) =>
    isProposalRoute && currentTypeFromQuery === typeId;

  const isActiveSubItem = (typeId: ProjectTypeId, path: string) =>
    location.pathname === path && currentTypeFromQuery === typeId;

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
          {/* One dropdown per project type */}
          {PROJECT_TYPES.map((type) => {
            const TypeIcon = type.icon;
            const isOpen = openTypeId === type.id;
            const isActive = isActiveTypeDropdown(type.id);

            return (
              <div key={type.id}>
                <button
                  onClick={() => setOpenTypeId(isOpen ? null : type.id)}
                  className={`flex items-center justify-between w-full px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-dark-800 text-white'
                      : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TypeIcon className="w-5 h-5" />
                    <span>{type.label}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="mt-1 mr-4 space-y-1">
                    <Link
                      to={`/?type=${type.id}`}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                        isActiveSubItem(type.id, '/')
                          ? 'bg-primary-500 text-white'
                          : 'text-dark-400 hover:bg-dark-800 hover:text-white'
                      }`}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span className="text-sm">ההצעות שלי</span>
                    </Link>
                    <Link
                      to={`/proposals/new?type=${type.id}`}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                        isActiveSubItem(type.id, '/proposals/new')
                          ? 'bg-primary-500 text-white'
                          : 'text-dark-400 hover:bg-dark-800 hover:text-white'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">הצעה חדשה</span>
                    </Link>
                  </div>
                )}
              </div>
            );
          })}

          {/* Customers (single entry, filter happens on the page) */}
          <Link
            to="/customers"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              location.pathname === '/customers'
                ? 'bg-primary-500 text-white'
                : 'text-dark-300 hover:bg-dark-800 hover:text-white'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>לקוחות</span>
          </Link>
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

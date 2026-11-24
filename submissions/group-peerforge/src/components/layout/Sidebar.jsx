import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarCheck2,
  User,
  LogOut,
  Settings,
  X,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import SettingsModal from './SettingsModal';

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const accountMenuRef = useRef(null);

  // Close account popover on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'PF';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const navItems = [
    {
      label: 'Overview',
      path: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Matchmaking',
      path: '/lobby',
      icon: Users,
    },
    {
      label: 'Interviews',
      path: '/interviews',
      icon: CalendarCheck2,
    },
    {
      label: 'Developer Profile',
      path: '/profile',
      icon: User,
    },
  ];

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-neutral-950 border-r border-neutral-800/80 text-neutral-300 font-sans">
      {/* Top: Logo & Nav items */}
      <div>
        <div className="h-14 px-5 border-b border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-white text-black font-mono font-bold flex items-center justify-center text-xs tracking-tight shadow-sm">
              PF
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-tight text-white leading-none">
                PeerForge
              </span>
              <span className="text-[10px] text-neutral-400 font-sans mt-0.5">
                Mock Interview Platform
              </span>
            </div>
          </div>

          {/* Close button on mobile drawer */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Primary Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose ? onClose : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-neutral-900 text-white border border-neutral-800 shadow-sm font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-xs" />
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom: Consolidated Account Section with Popup Menu */}
      <div className="p-3 border-t border-neutral-800/80 relative" ref={accountMenuRef}>
        {/* Floating Account Popup Menu */}
        {accountMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 p-1.5 rounded-xl border border-neutral-800 bg-neutral-900/95 backdrop-blur-md shadow-2xl space-y-0.5 text-xs z-50 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-2 border-b border-neutral-800/80 mb-1">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[11px] text-neutral-400 truncate">{user?.email}</p>
            </div>

            <button
              onClick={() => {
                setAccountMenuOpen(false);
                if (onClose) onClose();
                navigate('/profile');
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer text-left"
            >
              <User className="w-3.5 h-3.5 text-neutral-400" />
              <span>Developer Profile</span>
            </button>

            <button
              onClick={() => {
                setAccountMenuOpen(false);
                setSettingsOpen(true);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer text-left"
            >
              <Settings className="w-3.5 h-3.5 text-neutral-400" />
              <span>Settings</span>
            </button>

            <div className="border-t border-neutral-800/80 my-1 pt-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-neutral-400 hover:text-red-400 hover:bg-neutral-800/60 transition-colors cursor-pointer text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Account Trigger Button */}
        <button
          onClick={() => setAccountMenuOpen(!accountMenuOpen)}
          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-neutral-900/70 border border-transparent hover:border-neutral-800 transition-colors cursor-pointer group text-left"
          aria-expanded={accountMenuOpen}
          aria-label="Account options"
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700/80 flex items-center justify-center text-white text-xs font-mono font-semibold overflow-hidden shrink-0">
              {user?.profile?.avatarUrl ? (
                <img
                  src={user.profile.avatarUrl}
                  alt={user?.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                getInitials(user?.name)
              )}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-medium text-white truncate group-hover:text-neutral-200">
                {user?.name || 'Developer'}
              </div>
              <div className="text-[11px] text-neutral-400 truncate">
                {user?.email}
              </div>
            </div>
          </div>

          <ChevronUp
            className={`w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-300 shrink-0 transition-transform duration-150 ${
              accountMenuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

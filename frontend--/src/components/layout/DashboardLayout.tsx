import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, User, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { DashboardSidebar } from './DashboardSidebar';
import NotificationBell from '@/components/common/NotificationBell';
import { useIsMobile } from '@/hooks/use-mobile';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleColor = (role: UserRole) => {
    const colors = {
      customer: 'bg-customer text-customer-foreground',
      optometrist: 'bg-optometrist text-optometrist-foreground',
      staff: 'bg-staff text-staff-foreground',
      admin: 'bg-admin text-admin-foreground'
    };
    return colors[role];
  };

  if (!user) {
    console.log('DashboardLayout: No user found, showing loading...');
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const displayName = (user.name || user.email || '').toString();
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Mobile Menu Button */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="mr-2"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 truncate">
            Optical Clinic Management
          </h1>
          <Badge className={getRoleColor(user.role)}>
            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
          </Badge>
        </div>

        <div className="flex items-center space-x-4">
          {/* Notifications - Same for all roles */}
          <NotificationBell />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar} alt={displayName} />
                  <AvatarFallback>
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                  {user.branch && (
                    <p className="text-xs leading-none text-muted-foreground">
                      Branch: {user.branch.name}
                    </p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <DashboardSidebar 
          isMobile={isMobile}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-4 md:p-5 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>

    </div>
  );
};

export default DashboardLayout;

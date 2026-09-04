// Header dropdown for switching between the demo persona roles defined in
// config/roles. Role drives navigation visibility and entitlements via the
// auth store; there is no real sign-in in this release.
import { Check, MapPin, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import { useUserLookup, useUsers } from '@/lib/db/hooks/use-users';
import { roles } from '@/config/roles';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function RoleSwitcher() {
  const { currentRole, currentUser, switchRole } = useAuthStore();
  // The directory record carries the location; the auth store's user does not.
  useUsers();
  const lookupUser = useUserLookup();
  const location = lookupUser(currentUser.id)?.country;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-navy-800 text-white text-xs font-medium">
              {currentUser.initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start">
            <span className="text-sm font-medium text-text-primary leading-tight">
              {currentUser.name}
            </span>
            {/* Role and location together: the location drives country-based
                routing and is the requester's default "requesting from", so it
                belongs where they can see it without opening a form. */}
            <span className="flex items-center gap-1 text-[11px] text-text-muted leading-tight">
              {roles.find((r) => r.id === currentRole)?.label}
              {location && (
                <>
                  <span aria-hidden>·</span>
                  <MapPin className="size-2.5" aria-hidden />
                  {location}
                </>
              )}
            </span>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-2">
          <p className="text-sm font-medium text-text-primary">{currentUser.name}</p>
          <p className="text-xs text-text-muted">{currentUser.email}</p>
          {location && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-text-muted">
              <MapPin className="size-3" aria-hidden />
              {location}
            </p>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/settings" className="flex items-center gap-2">
            <Settings className="size-3.5" />
            Profile &amp; settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Switch Role
          </p>
        </div>
        <DropdownMenuSeparator />
        {roles.map((role) => (
          <DropdownMenuItem
            key={role.id}
            onClick={() => switchRole(role.id)}
            className="flex items-start gap-2 py-2 cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">
                {role.label}
              </p>
              <p className="text-xs text-text-muted">{role.description}</p>
            </div>
            {currentRole === role.id && (
              <Check className="h-4 w-4 text-status-success shrink-0 mt-0.5" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { Check } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
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
            <span className="text-[11px] text-text-muted leading-tight">
              {roles.find((r) => r.id === currentRole)?.label}
            </span>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
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

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  FileText,
  CheckSquare,
  ListTodo,
  GitBranch,
  BarChart3,
  Package,
  Building2,
  FileCheck,
  ShoppingCart,
  Receipt,
  PieChart,
  Settings,
  Shield,
  Bot,
  HelpCircle,
  Bell,
  Users,
  Workflow,
  Target,
  FolderOpen,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Filter,
  LayoutGrid,
  List,
  Calendar,
  Sparkles,
  MessageSquare,
  Upload,
  Download,
  ExternalLink,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  ArrowRight,
  ArrowLeft,
  Clock,
  Flag,
  Zap,
  BookOpen,
  Headphones,
  Scale,
  Activity,
  Database,
  Lock,
  Globe,
  Award,
  FileSpreadsheet,
  Briefcase,
  CheckCircle,
  FilePlus,
  UserCheck,
  UserPlus,
  ShieldCheck,
  FileSignature,
  PackageCheck,
  GitMerge,
  CreditCard,
  Timer,
  FileBarChart,
  CalendarClock,
  Route,
  Link,
  PenTool,
  ScrollText,
  History,
  Monitor,
  LayoutTemplate,
  Files,
  CalendarPlus,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { navigation, type NavItem, type NavGroup } from '@/config/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const iconMap: Record<string, LucideIcon> = {
  Home,
  FileText,
  CheckSquare,
  ListTodo,
  GitBranch,
  BarChart3,
  Package,
  Building2,
  FileCheck,
  ShoppingCart,
  Receipt,
  PieChart,
  Settings,
  Shield,
  Bot,
  HelpCircle,
  Bell,
  Users,
  Workflow,
  Target,
  FolderOpen,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  Search,
  Plus,
  Filter,
  LayoutGrid,
  List,
  Calendar,
  Sparkles,
  MessageSquare,
  Upload,
  Download,
  ExternalLink,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  ArrowRight,
  ArrowLeft,
  Clock,
  Flag,
  Zap,
  BookOpen,
  Headphones,
  Scale,
  Activity,
  Database,
  Lock,
  Globe,
  Award,
  FileSpreadsheet,
  Briefcase,
  CheckCircle,
  FilePlus,
  UserCheck,
  UserPlus,
  ShieldCheck,
  FileSignature,
  PackageCheck,
  GitMerge,
  CreditCard,
  Timer,
  FileBarChart,
  CalendarClock,
  Route,
  Link,
  PenTool,
  ScrollText,
  History,
  Monitor,
  LayoutTemplate,
  Files,
  CalendarPlus,
};

function getIcon(name: string): LucideIcon {
  return iconMap[name] ?? FileText;
}

function SidebarItem({
  item,
  collapsed,
  depth = 0,
}: {
  item: NavItem;
  collapsed: boolean;
  depth?: number;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const { currentRole } = useAuthStore();

  if (!item.visibleTo.includes(currentRole)) return null;

  const Icon = getIcon(item.icon);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.path
    ? location.pathname === item.path
    : item.children?.some((child) => location.pathname === child.path);

  const visibleChildren = hasChildren
    ? item.children!.filter((child) => child.visibleTo.includes(currentRole))
    : [];

  const handleClick = () => {
    if (hasChildren) {
      if (collapsed) {
        // When collapsed, navigate to first child
        const firstChild = visibleChildren[0];
        if (firstChild?.path) navigate(firstChild.path);
      } else {
        setExpanded(!expanded);
      }
    } else if (item.path) {
      navigate(item.path);
    }
  };

  const button = (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-md text-sm transition-colors duration-150',
        collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2',
        depth > 0 && !collapsed && 'pl-10',
        isActive
          ? 'bg-blue-500/20 text-white'
          : 'text-navy-200 hover:bg-white/8 hover:text-white',
      )}
    >
      <Icon className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-4 w-4')} />
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{item.label}</span>
          {hasChildren && visibleChildren.length > 0 && (
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
                expanded && 'rotate-180',
              )}
            />
          )}
        </>
      )}
    </button>
  );

  return (
    <div>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {item.label}
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}
      {!collapsed && hasChildren && expanded && (
        <div className="mt-0.5 space-y-0.5">
          {visibleChildren.map((child) => (
            <SidebarItem
              key={child.id}
              item={child}
              collapsed={collapsed}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarGroup({
  group,
  collapsed,
}: {
  group: NavGroup;
  collapsed: boolean;
}) {
  const { currentRole } = useAuthStore();

  if (!group.visibleTo.includes(currentRole)) return null;

  const visibleItems = group.items.filter((item) =>
    item.visibleTo.includes(currentRole),
  );
  if (visibleItems.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {group.label && !collapsed && (
        <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-navy-400">
          {group.label}
        </p>
      )}
      {collapsed && group.label && (
        <div className="mx-auto my-2 w-6 border-t border-navy-600" />
      )}
      {visibleItems.map((item) => (
        <SidebarItem key={item.id} item={item} collapsed={collapsed} />
      ))}
    </div>
  );
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        'h-screen bg-navy-800 flex flex-col shrink-0 transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-16' : 'w-[260px]',
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'h-14 flex items-center shrink-0 border-b border-navy-700',
          sidebarCollapsed ? 'justify-center px-2' : 'px-4 gap-3',
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500 shrink-0">
          <span className="text-sm font-bold text-white">GP</span>
        </div>
        {!sidebarCollapsed && (
          <span className="text-sm font-semibold text-white tracking-tight truncate">
            GP Procurement
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        <div className="space-y-0.5 pb-4">
          {navigation.map((group) => (
            <SidebarGroup
              key={group.id}
              group={group}
              collapsed={sidebarCollapsed}
            />
          ))}
        </div>
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 border-t border-navy-700 p-2">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 rounded-md px-2 py-2 text-navy-300 hover:bg-white/8 hover:text-white transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

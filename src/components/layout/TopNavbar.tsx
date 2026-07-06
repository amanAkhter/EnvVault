import { Link, useNavigate } from "react-router";
import { LockKeyhole, LogOut, Plus } from "lucide-react";
import { useAuthStore } from "../../features/auth/store/authStore";
import { logout } from "../../features/auth/api/authApi";
import { toast } from "react-hot-toast";
import { buttonVariants } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "../ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export const TopNavbar = () => {
  const { user, activeOrganization, can } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out successfully.");
      navigate("/login");
    } catch {
      toast.error("Failed to sign out. Please try again.");
    }
  };

  return (
    <nav className="w-full bg-background border-b border-border flex items-center justify-between px-4 sm:px-6 h-16">
      <div className="flex items-center">
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <LockKeyhole className="text-primary" size={22} />
          <span className="font-bold text-lg">EnvVault</span>
        </Link>
        {activeOrganization && (
          <span className="ml-3 hidden rounded-full border border-border px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
            {activeOrganization.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {can('projects.create') && (
          <Link to="/projects/new" className={buttonVariants({ size: "sm", variant: "secondary" })}>
            <Plus size={16} className="mr-2" />
            Create Project
          </Link>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none">
            <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-primary ring-offset-2 ring-offset-background transition-transform hover:scale-105">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.name || "Admin"}`} />
              <AvatarFallback>{user?.name?.[0] || 'A'}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Signed in as</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
              <LogOut size={16} className="mr-2" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};

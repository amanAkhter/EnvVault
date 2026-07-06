import { create } from 'zustand';
import { Organization, OrganizationMember, Permission, User } from '../../../types';
import { hasPermission } from '../services/permissions';

interface AuthState {
  user: User | null;
  activeOrganization: Organization | null;
  memberships: OrganizationMember[];
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setSession: (session: {
    user: User | null;
    activeOrganization: Organization | null;
    memberships: OrganizationMember[];
  }) => void;
  setActiveOrganization: (organization: Organization | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  can: (permission: Permission) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  activeOrganization: null,
  memberships: [],
  isLoading: true,
  error: null,
  setUser: (user) => set((state) => ({
    user,
    activeOrganization: user ? state.activeOrganization : null,
    memberships: user ? state.memberships : [],
    isLoading: false,
  })),
  setSession: ({ user, activeOrganization, memberships }) => set({
    user,
    activeOrganization,
    memberships,
    isLoading: false,
  }),
  setActiveOrganization: (activeOrganization) => set({ activeOrganization }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  can: (permission): boolean => {
    const { activeOrganization, memberships } = get();
    if (!activeOrganization) return false;
    const membership = memberships.find(
      (item: OrganizationMember) => item.organizationId === activeOrganization.id && item.status === 'active',
    );
    return hasPermission(membership?.effectivePermissions, permission);
  },
}));

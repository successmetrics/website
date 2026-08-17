import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, clearSession, setSession, type Role } from './api';

type User = { id: string; email: string; name: string };
type Workspace = { id: string; name: string; role: Role };

type AuthState = {
  user: User | null;
  workspaces: Workspace[];
  workspaceId: string | null;
  role: Role | null;
  permissions: Record<string, boolean>;
  platformAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, name: string, password: string, workspaceName: string, invitationToken?: string) => Promise<void>;
  logout: () => void;
  selectWorkspace: (id: string) => void;
  refresh: () => Promise<void>;
  can: (perm: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(
    () => localStorage.getItem('ss_workspace_id'),
  );
  const [role, setRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{
        user: User;
        workspaces: Workspace[];
        platform_admin?: boolean;
      }>('/v1/auth/me');
      setUser(me.user);
      setWorkspaces(me.workspaces as Workspace[]);
      let isPlatform = Boolean(me.platform_admin);
      if (!isPlatform) {
        try {
          await api('/v1/admin/api-key-requests?status=pending');
          isPlatform = true;
        } catch {
          isPlatform = false;
        }
      }
      setPlatformAdmin(isPlatform);
      const wid = localStorage.getItem('ss_workspace_id') || me.workspaces[0]?.id;
      if (wid) {
        localStorage.setItem('ss_workspace_id', wid);
        setWorkspaceId(wid);
        const cur = await api<{
          role: Role;
          permissions: Record<string, boolean>;
        }>('/v1/workspaces/current');
        setRole(cur.role);
        setPermissions(cur.permissions || {});
      }
    } catch {
      setUser(null);
      setPlatformAdmin(false);
      clearSession();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('ss_token')) refresh();
    else setLoading(false);
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await api<{
      token: string;
      user: User;
      workspaces: Workspace[];
    }>('/v1/auth/login', { method: 'POST', json: { email, password } });
    const wid = res.workspaces[0]?.id;
    setSession(res.token, wid);
    setUser(res.user);
    setWorkspaces(res.workspaces);
    setWorkspaceId(wid || null);
    await refresh();
  };

  const signup = async (
    email: string,
    name: string,
    password: string,
    workspaceName: string,
    invitationToken?: string,
  ) => {
    const res = await api<{
      token: string;
      user: User;
      workspace: Workspace;
    }>('/v1/auth/signup', {
      method: 'POST',
      json: { email, name, password, workspace_name: workspaceName, invitation_token: invitationToken || null },
    });
    setSession(res.token, res.workspace.id);
    setUser(res.user);
    setWorkspaces([res.workspace as Workspace]);
    setWorkspaceId(res.workspace.id);
    try {
      sessionStorage.setItem('ss_pending_welcome', '1');
    } catch {
      /* ignore */
    }
    await refresh();
  };

  const logout = () => {
    clearSession();
    setUser(null);
    setWorkspaces([]);
    setWorkspaceId(null);
    setRole(null);
    setPlatformAdmin(false);
  };

  const selectWorkspace = (id: string) => {
    localStorage.setItem('ss_workspace_id', id);
    setWorkspaceId(id);
    refresh();
  };

  const can = (perm: string) => !!permissions[perm];

  const value = useMemo(
    () => ({
      user,
      workspaces,
      workspaceId,
      role,
      permissions,
      platformAdmin,
      loading,
      login,
      signup,
      logout,
      selectWorkspace,
      refresh,
      can,
    }),
    [user, workspaces, workspaceId, role, permissions, platformAdmin, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}

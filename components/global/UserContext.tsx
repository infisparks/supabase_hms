import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UserContextType {
  user: any;
  role: string | null;
  loading: boolean;
  error: string | null;
}

const UserContext = createContext<UserContextType>({
  user: null,
  role: null,
  loading: true,
  error: null,
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      setLoading(true);
      setError(null);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setUser(null);
        setRole(null);
        setError(userError?.message || 'No user');
        setLoading(false);
        return;
      }
      setUser(user);
      // Fetch user role from public.user table
      const { data, error: roleError } = await supabase
        .from('user')
        .select('role')
        .eq('uhid', user.id)
        .single();
      if (roleError || !data) {
        setRole(null);
        setError(roleError?.message || 'No role');
      } else {
        setRole(data.role);
      }
      setLoading(false);
    };
    getUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, role, loading, error }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext); 
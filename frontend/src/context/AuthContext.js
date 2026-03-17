import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const getDeviceId = () => {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).toString();
    localStorage.setItem('device_id', id);
  }
  return id;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse user:', e);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
        device_id: getDeviceId(),
      });

      const { access_token, user: userData } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      return userData;
    } catch (error) {
      const status = error?.response?.status;

      if (status === 401) {
        throw new Error('INCORRECT_CREDENTIALS');
      }

      if (status === 403) {
        throw error;
      }

      if (!error?.response || status === 502 || status === 503 || status === 504) {
        throw new Error('SERVER_UNAVAILABLE');
      }

      throw new Error('LOGIN_FAILED');
    }
  };

  const register = async (email, password, company_name, full_name, role = 'MANAGER') => {
    const response = await api.post('/auth/register', {
      email,
      password,
      company_name,
      full_name,
      role,
      device_id: getDeviceId(),
    });

    const { access_token, user: userData } = response.data;

    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    return userData;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error('Logout API error:', e);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  const isManager = () => user?.role === 'MANAGER';
  const isProcurement = () => user?.role === 'PROCUREMENT';
  const isQuotingStaff = () => user?.role === 'QUOTING_STAFF';
  const isCEO = () => user?.role === 'CEO';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isManager,
        isProcurement,
        isQuotingStaff,
        isCEO,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;

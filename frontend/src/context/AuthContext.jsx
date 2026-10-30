import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("ppdb_token"));
  const [user, setUser] = useState(null);
  const [applicant, setApplicant] = useState(null);
  const [bill, setBill] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [raporUrl, setRaporUrl] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  const applyPayload = useCallback((data) => {
    if (data.accessToken) {
      localStorage.setItem("ppdb_token", data.accessToken);
      setToken(data.accessToken);
    }
    if (data.user) setUser(data.user);
    if (data.applicant !== undefined) setApplicant(data.applicant);
    if (data.bill !== undefined) setBill(data.bill);
    if (data.documents !== undefined) setDocuments(data.documents);
    if (data.raporUrl !== undefined) setRaporUrl(data.raporUrl || null);
  }, []);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem("ppdb_token")) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/me");
      applyPayload(data);
    } catch {
      localStorage.removeItem("ppdb_token");
      setToken(null);
      setUser(null);
      setApplicant(null);
      setBill(null);
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    applyPayload(data);
    return data;
  };

  const login = async (payload) => {
    const { data } = await api.post("/auth/login", payload);
    applyPayload(data);
    return data;
  };

  const staffLogin = async (payload) => {
    const { data } = await api.post("/auth/staff-login", payload);
    applyPayload(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("ppdb_token");
    setToken(null);
    setUser(null);
    setApplicant(null);
    setBill(null);
      setDocuments([]);
      setRaporUrl(null);
  };

  const value = useMemo(
    () => ({
      token,
      user,
      applicant,
      bill,
      documents,
      raporUrl,
      loading,
      register,
      login,
      staffLogin,
      logout,
      refresh,
      applyPayload,
    }),
    [token, user, applicant, bill, documents, raporUrl, loading, refresh, applyPayload]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

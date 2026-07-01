import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Lang } from "./i18n";
import { api, getToken, setToken, clearToken } from "./api";

interface AppState {
  lang: Lang;
  loading: boolean;
  authed: boolean;
  hasProfile: boolean;
  setLang: (l: Lang) => Promise<void>;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AppState>(null as any);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  const refresh = async () => {
    const token = await getToken();
    if (!token) { setAuthed(false); setHasProfile(false); setLoading(false); return; }
    setAuthed(true);
    // Start from the last-known profile status so a slow/unreachable server
    // doesn't wrongly send a returning user to onboarding (iOS symptom).
    const cached = await AsyncStorage.getItem("hasProfile");
    if (cached != null) setHasProfile(cached === "1");
    try {
      const me = await api.me();
      if (me?.user) {
        const hp = !!me.profileComplete;
        setHasProfile(hp);
        await AsyncStorage.setItem("hasProfile", hp ? "1" : "0");
        if (me.user.lang) setLangState(me.user.lang);
      } else {
        // 401/404 → token invalid or account missing
        setHasProfile(false);
        await AsyncStorage.setItem("hasProfile", "0");
      }
    } catch {
      // backend unreachable — keep the cached profile status set above
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (token: string) => {
    await setToken(token);
    setAuthed(true);
    await refresh();
  };

  const signOut = async () => {
    await clearToken();
    await AsyncStorage.removeItem("hasProfile");
    setAuthed(false);
    setHasProfile(false);
  };

  const setLang = async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem("lang", l);
    try { await api.setLanguage(l); } catch {}
  };

  useEffect(() => {
    (async () => {
      const stored = (await AsyncStorage.getItem("lang")) as Lang | null;
      if (stored) setLangState(stored);
      await refresh();
    })();
  }, []);

  return (
    <Ctx.Provider value={{ lang, loading, authed, hasProfile, setLang, signIn, signOut, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);

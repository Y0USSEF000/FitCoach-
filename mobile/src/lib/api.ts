import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = (Constants.expoConfig?.extra as any)?.apiUrl ?? "http://192.168.0.100:5000";

// ─── Auth token ─────────────────────────────────────────
let cachedToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  cachedToken = await AsyncStorage.getItem("token");
  return cachedToken;
}
export async function setToken(token: string) {
  cachedToken = token;
  await AsyncStorage.setItem("token", token);
}
export async function clearToken() {
  cachedToken = null;
  await AsyncStorage.removeItem("token");
}

async function req(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  const token = await getToken();
  if (token) headers["X-Auth-Token"] = token;
  if (init.body && !(init.body instanceof FormData)) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  return res;
}

async function json(path: string, init: RequestInit = {}) {
  const res = await req(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body?.error || `HTTP ${res.status}`), { status: res.status, body });
  return body;
}

export interface Targets { calories: number; protein: number; carbs: number; fat: number; }
export interface Meal { food: string; protein: number; carbs: number; fat: number; calories: number; time: string; estimatedGrams: number; }
export interface FoodItem { name: string; brand: string; barcode: string; calories: number; protein: number; carbs: number; fat: number; servingGrams: number | null; }
export interface DayLog { protein: number; carbs: number; fat: number; calories: number; meals: Meal[]; }
export interface NotificationPrefs {
  mealReminders: boolean; waterReminders: boolean; didYouEatToday: boolean;
  mealTimes: string[]; waterIntervalHours: number;
}

export const api = {
  // ── Auth ──
  authCheck: (email: string): Promise<{ exists: boolean }> =>
    json("/api/auth/check", { method: "POST", body: JSON.stringify({ email }) }),

  authStart: (email: string): Promise<{ exists: boolean; devCode: string | null }> =>
    json("/api/auth/start", { method: "POST", body: JSON.stringify({ email }) }),

  authVerify: (email: string, code: string): Promise<{ registered: boolean; token?: string; profileComplete?: boolean; verified?: boolean }> =>
    json("/api/auth/verify", { method: "POST", body: JSON.stringify({ email, code }) }),

  authRegister: (email: string, name: string, password: string): Promise<{ token: string; profileComplete: boolean }> =>
    json("/api/auth/register", { method: "POST", body: JSON.stringify({ email, name, password }) }),

  authLogin: (email: string, password: string): Promise<{ token: string; profileComplete: boolean }> =>
    json("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  // ── Profile / data (require token) ──
  onboard: (body: any) => json("/api/onboard", { method: "POST", body: JSON.stringify(body) }),

  me: async () => {
    const res = await req("/api/me");
    if (res.status === 401 || res.status === 404) return null;
    return res.json();
  },

  status: async () => {
    const res = await req("/api/status");
    if (!res.ok) return null;
    return res.json();
  },

  program: () => json("/api/program"),

  // save=false → preview only (user confirms/edits before logging)
  analyze: (uri: string, mimeType: string = "image/jpeg", save = true) => {
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const form = new FormData();
    form.append("photo", { uri, name: `meal.${ext}`, type: mimeType } as any);
    form.append("save", save ? "true" : "false");
    return json("/api/analyze", { method: "POST", body: form });
  },

  // Manual / confirmed meal log (from confirm screen, search, or barcode)
  logMeal: (body: { food: string; grams: number; calories: number; protein: number; carbs: number; fat: number }) =>
    json("/api/meals", { method: "POST", body: JSON.stringify(body) }),

  recent: (): Promise<{ recent: Meal[] }> => json("/api/recent"),

  searchFoods: (q: string): Promise<{ results: FoodItem[] }> =>
    json(`/api/foods/search?q=${encodeURIComponent(q)}`),

  barcodeFood: async (code: string): Promise<FoodItem | null> => {
    const res = await req(`/api/foods/barcode/${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    const body = await res.json();
    return body.item ?? null;
  },

  undo: () => json("/api/undo", { method: "POST" }),

  getNotifications: async (): Promise<NotificationPrefs | null> => {
    const res = await req("/api/notifications");
    if (!res.ok) return null;
    return res.json();
  },

  setNotifications: (prefs: NotificationPrefs) =>
    json("/api/notifications", { method: "PUT", body: JSON.stringify(prefs) }),

  setLanguage: (lang: string) =>
    json("/api/language", { method: "PUT", body: JSON.stringify({ lang }) }),

  reset: () => json("/api/me", { method: "DELETE" }),
};

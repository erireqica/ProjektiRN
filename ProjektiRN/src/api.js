import { Platform } from "react-native";

const defaultBaseUrl = Platform.OS === "web"
  ? "http://localhost:5001/api"
  : "http://10.0.2.2:5001/api";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || defaultBaseUrl;

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
  });

  let data;
  try {
    data = await response.json();
  } catch (_error) {
    throw new Error("The server returned an unreadable response.");
  }

  if (!response.ok || data.success === false) {
    const error = new Error(data.message || "Something went wrong.");
    error.status = response.status;
    error.fields = data.errors;
    throw error;
  }
  return data;
}

export function readSession() {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem("projektiRN.session");
    return value ? JSON.parse(value) : null;
  } catch (_error) {
    return null;
  }
}

export function writeSession(session) {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem("projektiRN.session", JSON.stringify(session));
  } else {
    window.localStorage.removeItem("projektiRN.session");
  }
}

"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { emptyState, type State } from "@/lib/local/model";
import {
  CHANGE,
  readState,
  updateState,
  switchMode,
  clearPersonal,
} from "@/lib/local/repository";
import { demoState } from "@/lib/local/demo";
type Context = {
  state: State;
  ready: boolean;
  error: string;
  update: (fn: (s: State) => State) => Promise<void>;
  demo: () => void;
  personal: () => void;
  reset: () => void;
};
const DataContext = createContext<Context | null>(null);
export function LocalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(emptyState),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const load = () => {
      try {
        setState(readState());
        setError("");
      } catch {
        setError(
          "Не удалось прочитать локальные данные. Исходные данные сохранены. Можно скачать их и восстановить резервную копию.",
        );
      }
      setReady(true);
    };
    load();
    window.addEventListener("storage", load);
    window.addEventListener(CHANGE, load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener(CHANGE, load);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        state.profile.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : state.profile.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [state.profile.theme]);
  const value: Context = {
    state,
    ready,
    error,
    update: updateState,
    demo: () => switchMode("demo", demoState()),
    personal: () => switchMode("personal"),
    reset: clearPersonal,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
export function useFinance() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("LocalProvider missing");
  return ctx;
}

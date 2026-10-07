import { emptyState, stateSchema, type State } from "./model";
import { validateState } from "./finance";
const PERSONAL = "kopilka.personal.v1",
  DEMO = "kopilka.demo.v1",
  MODE = "kopilka.mode";
export const CHANGE = "kopilka:change";
export function readState(): State {
  const key = localStorage.getItem(MODE) === "demo" ? DEMO : PERSONAL;
  const raw = localStorage.getItem(key);
  return raw ? validateState(stateSchema.parse(JSON.parse(raw))) : emptyState();
}
export async function updateState(updater: (s: State) => State) {
  const save = () => {
    const current = readState(),
      next = validateState(updater(current));
    localStorage.setItem(
      next.mode === "demo" ? DEMO : PERSONAL,
      JSON.stringify(next),
    );
    window.dispatchEvent(new Event(CHANGE));
  };
  if (navigator.locks) await navigator.locks.request("kopilka-write", save);
  else save();
}
export function switchMode(mode: "personal" | "demo", seed?: State) {
  if (seed)
    localStorage.setItem(
      mode === "demo" ? DEMO : PERSONAL,
      JSON.stringify(validateState(seed)),
    );
  localStorage.setItem(MODE, mode);
  window.dispatchEvent(new Event(CHANGE));
}
export function clearPersonal() {
  localStorage.removeItem(PERSONAL);
  localStorage.removeItem(DEMO);
  localStorage.removeItem(MODE);
  window.dispatchEvent(new Event(CHANGE));
}

"use client";
import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
export function ConnectionStatus() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  return online ? null : (
    <div className="connection-status" role="status">
      <WifiOff size={16} /> Без сети · изменения сохраняются на устройстве
    </div>
  );
}

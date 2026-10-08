"use client";
import { publicPath } from "@/lib/base-path";
import { useEffect } from "react";
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register(publicPath("/sw.js")).catch(() => {});
  }, []);
  return null;
}

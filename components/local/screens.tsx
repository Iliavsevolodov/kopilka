"use client";
import { Dashboard } from "./dashboard";
import { Transactions } from "./transactions";
import { Planning } from "./planning";
import { Accounts, Goals } from "./accounts-goals";
import { Analytics } from "./analytics";
import { Profile, Assistant } from "./profile";
import { useEntry } from "./workspace";
export function Screen({ name }: { name: string }) {
  const open = useEntry();
  switch (name) {
    case "transactions":
      return <Transactions />;
    case "plan":
      return <Planning />;
    case "accounts":
      return <Accounts />;
    case "goals":
      return <Goals />;
    case "analytics":
      return <Analytics />;
    case "profile":
      return <Profile />;
    case "assistant":
      return <Assistant />;
    default:
      return <Dashboard open={open} />;
  }
}

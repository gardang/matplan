"use client";

// Store integrations panel: connect Trumf/Coop/Rema, paste token, sync receipts.
// Used in Settings → "Butikker".

import { useEffect, useState } from "react";
import { RefreshCw, Trash2, KeyRound, CheckCircle2, AlertTriangle, CircleOff, Loader2 } from "lucide-react";
import type { StoreId } from "@/lib/types";

// A sync whose start is older than this is treated as crashed, not running.
const SYNC_STALE_MS = 6 * 60 * 1000;

interface ConnectionInfo {
  id: string;
  store: StoreId;
  last_sync_at: string | null;
  sync_started_at: string | null;
  status: "connected" | "expired" | "error" | "disconnected" | "syncing";
  status_message: string | null;
}

function isActivelySyncing(conn: ConnectionInfo | undefined): boolean {
  if (!conn || conn.status !== "syncing" || !conn.sync_started_at) return false;
  return Date.now() - new Date(conn.sync_started_at).getTime() < SYNC_STALE_MS;
}

interface SyncResult {
  receiptsAdded: number;
  itemsAdded: number;
  productsMapped: number;
  patternsUpdated: number;
}

const STORE_META: Record<StoreId, { label: string; chains: string; tokenHelp: string; supported: boolean }> = {
  trumf: {
    label: "Trumf",
    chains: "Kiwi, Meny, Spar, Joker",
    tokenHelp:
      "Logg inn på trumf.no → åpne utviklerverktøy (F12) → Network → velg et kall til ngdata.no → kopier verdien av Authorization-headeren.",
    supported: true,
  },
  coop: { label: "Coop", chains: "Obs, Extra, Mega", tokenHelp: "Kommer snart.", supported: false },
  rema: { label: "Rema (Æ)", chains: "Rema 1000", tokenHelp: "Kommer snart.", supported: false },
};

interface StoreConnectionsProps {
  showToast: (msg: string, type?: "success" | "error") => void;
}

export function StoreConnections({ showToast }: StoreConnectionsProps) {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [tokenInput, setTokenInput] = useState("");
  const [editingStore, setEditingStore] = useState<StoreId | null>(null);
  const [syncing, setSyncing] = useState<StoreId | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/settings/connections");
    const data = await res.json();
    setConnections(data.connections ?? []);
  }

  useEffect(() => {
    fetch("/api/settings/connections")
      .then((r) => r.json())
      .then((data) => setConnections(data.connections ?? []))
      .catch(() => showToast("Kunne ikke laste butikk-tilkoblinger", "error"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // While a sync is running (possibly started before navigating away), poll so
  // the panel reflects completion without a manual refresh.
  const anySyncing = connections.some((c) => isActivelySyncing(c));
  useEffect(() => {
    if (!anySyncing) return;
    const id = setInterval(() => {
      fetch("/api/settings/connections")
        .then((r) => r.json())
        .then((data) => setConnections(data.connections ?? []))
        .catch(() => {});
    }, 4000);
    return () => clearInterval(id);
  }, [anySyncing]);

  function connFor(store: StoreId): ConnectionInfo | undefined {
    return connections.find((c) => c.store === store);
  }

  async function saveToken(store: StoreId) {
    if (!tokenInput.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store, accessToken: tokenInput }),
      });
      if (!res.ok) throw new Error();
      setTokenInput("");
      setEditingStore(null);
      await load();
      showToast(`${STORE_META[store].label} tilkoblet`);
    } catch {
      showToast("Kunne ikke lagre token", "error");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect(store: StoreId) {
    if (!confirm(`Koble fra ${STORE_META[store].label}?`)) return;
    await fetch(`/api/settings/connections?store=${store}`, { method: "DELETE" });
    await load();
  }

  async function sync(store: StoreId) {
    setSyncing(store);
    try {
      const res = await fetch("/api/receipts/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store }),
      });
      const data = (await res.json()) as SyncResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Synkronisering feilet");
      showToast(
        `Synkronisert: ${data.receiptsAdded} kvitteringer, ${data.itemsAdded} varelinjer, ${data.patternsUpdated} mønstre oppdatert`
      );
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Synkronisering feilet", "error");
      await load(); // status may have flipped to 'expired'
    } finally {
      setSyncing(null);
    }
  }

  function statusBadge(conn: ConnectionInfo | undefined) {
    const status = conn?.status ?? "disconnected";
    if (isActivelySyncing(conn))
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Synkroniserer …
        </span>
      );
    if (status === "connected")
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" /> Tilkoblet
        </span>
      );
    if (status === "expired" || status === "error")
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" /> {conn?.status_message ?? "Feil — koble til på nytt"}
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <CircleOff className="w-3.5 h-3.5" /> Ikke tilkoblet
      </span>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Hent kvitteringer automatisk og lær handlemønstre: hvor ofte, hvor mye og til hvilken pris.
      </p>
      {(Object.keys(STORE_META) as StoreId[]).map((store) => {
        const meta = STORE_META[store];
        const conn = connFor(store);
        const activeSync = isActivelySyncing(conn) || syncing === store;
        const isConnected = conn?.status === "connected" || conn?.status === "syncing";
        return (
          <div key={store} className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {meta.label} <span className="text-xs text-gray-400 font-normal">({meta.chains})</span>
                </div>
                <div className="mt-0.5">{statusBadge(conn)}</div>
                {conn?.last_sync_at && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    Sist synkronisert: {new Date(conn.last_sync_at).toLocaleString("nb-NO")}
                  </div>
                )}
              </div>
              {meta.supported && (
                <div className="flex gap-1 shrink-0">
                  {isConnected && (
                    <button
                      onClick={() => sync(store)}
                      disabled={activeSync}
                      className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50"
                      title="Synkroniser kvitteringer"
                    >
                      <RefreshCw className={`w-4 h-4 ${activeSync ? "animate-spin" : ""}`} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingStore(editingStore === store ? null : store);
                      setTokenInput("");
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Lim inn token"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                  {isConnected && (
                    <button
                      onClick={() => disconnect(store)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Koble fra"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              {!meta.supported && <span className="text-xs text-gray-400 shrink-0">Kommer snart</span>}
            </div>

            {editingStore === store && meta.supported && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-gray-400">{meta.tokenHelp}</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Bearer eyJ..."
                    className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    onClick={() => saveToken(store)}
                    disabled={saving || !tokenInput.trim()}
                    className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    Lagre
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

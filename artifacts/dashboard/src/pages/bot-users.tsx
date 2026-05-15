import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
  Coins,
  Zap,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BotUserItem {
  id: string;
  senderJid: string;
  displayName: string;
  balance: number;
  limit: number;
  limitResetAt: string | null;
  totalCommandsUsed: number;
  createdAt: string;
}

async function getFirstBotId(token: string): Promise<string | null> {
  const res = await fetch("/api/bots", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const bots = Array.isArray(data) ? data : (data.bots ?? []);
  return bots[0]?.id ?? bots[0]?._id ?? null;
}

async function fetchBotUsers(
  botId: string,
  token: string,
  page: number,
  search: string,
): Promise<{ users: BotUserItem[]; total: number; totalPages: number }> {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  const res = await fetch(`/api/bots/${botId}/users?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Gagal memuat pengguna");
  return res.json();
}

async function patchUser(
  botId: string,
  userId: string,
  data: { balance?: number; limit?: number },
  token: string,
) {
  const res = await fetch(`/api/bots/${botId}/users/${userId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Gagal update user");
  return res.json();
}

function shortJid(jid: string) {
  const num = jid.split("@")[0]?.split(":")[0] ?? jid;
  return num.length > 10 ? `${num.slice(0, 6)}...${num.slice(-4)}` : num;
}

function EditDialog({
  user,
  botId,
  token,
  onClose,
  onSaved,
}: {
  user: BotUserItem;
  botId: string;
  token: string;
  onClose: () => void;
  onSaved: (updated: BotUserItem) => void;
}) {
  const { toast } = useToast();
  const [balance, setBalance] = useState(String(user.balance));
  const [limit, setLimit] = useState(String(user.limit));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const b = Number(balance);
    const l = Number(limit);
    if (isNaN(b) || b < 0 || isNaN(l) || l < 0) {
      toast({ variant: "destructive", title: "Nilai tidak valid", description: "Balance dan limit harus angka >= 0" });
      return;
    }
    setSaving(true);
    try {
      const updated = await patchUser(botId, user.id, { balance: b, limit: l }, token);
      onSaved({ ...user, ...updated });
      toast({ title: "Berhasil disimpan" });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Edit Pengguna</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 text-xs text-muted-foreground px-1">
          <p className="font-mono">{user.senderJid}</p>
          {user.displayName && <p className="font-medium text-foreground">{user.displayName}</p>}
        </div>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-yellow-400" /> Balance
            </label>
            <Input
              type="number"
              min={0}
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-blue-400" /> Limit
            </label>
            <Input
              type="number"
              min={0}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BotUsersPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const token = accessToken ?? localStorage.getItem("accessToken") ?? "";
  const { toast } = useToast();

  const [botId, setBotId] = useState<string | null>(null);
  const [users, setUsers] = useState<BotUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<BotUserItem | null>(null);

  const load = useCallback(async (bid: string, pg: number, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBotUsers(bid, token, pg, q);
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e: any) {
      setError(e.message ?? "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    (async () => {
      const id = await getFirstBotId(token);
      if (!id) { setError("Bot tidak ditemukan"); setLoading(false); return; }
      setBotId(id);
      await load(id, 1, "");
    })();
  }, []);

  useEffect(() => {
    if (!botId) return;
    load(botId, page, search);
  }, [page, search]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleSaved = (updated: BotUserItem) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pengguna Bot</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola balance & limit pengguna yang berinteraksi dengan bot kamu
          </p>
        </div>
        {!loading && !error && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => botId && load(botId, page, search)}
              className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <div className="text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-lg border border-border">
              Total: <span className="text-foreground font-semibold">{total}</span> pengguna
            </div>
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-border bg-secondary/30 px-5 py-4 text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-start gap-2.5">
          <Coins className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Balance</p>
            <p>Mata uang utama tiap pengguna. Bisa dipakai untuk beli limit tambahan (coming soon).</p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Zap className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Limit</p>
            <p>Dipakai saat menjalankan command berbayar. Default 25/hari, reset otomatis tiap 00.00 WIB.</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Cari nomor atau nama..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button size="sm" variant="outline" onClick={handleSearch} className="h-9 px-4 text-xs">
          Cari
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Memuat pengguna...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <AlertCircle className="w-8 h-8 text-destructive/70" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && users.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Users className="w-10 h-10 opacity-30" />
          <p className="text-sm">
            {search ? "Tidak ada hasil untuk pencarian ini" : "Belum ada pengguna yang berinteraksi dengan bot"}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && users.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pengguna</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balance</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Limit</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Cmd</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        {u.displayName && (
                          <p className="font-medium text-foreground text-sm leading-tight">{u.displayName}</p>
                        )}
                        <p className={cn("font-mono text-xs", u.displayName ? "text-muted-foreground" : "text-foreground")}>
                          +{shortJid(u.senderJid)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg px-2.5 py-1 text-xs font-semibold font-mono">
                        <Coins className="w-3 h-3" />
                        {u.balance.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold font-mono border",
                        u.limit === 0
                          ? "bg-red-500/10 text-red-400 border-red-500/20"
                          : u.limit < 5
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                          : "bg-blue-500/10 text-blue-400 border-blue-500/20",
                      )}>
                        <Zap className="w-3 h-3" />
                        {u.limit}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-muted-foreground font-mono">{u.totalCommandsUsed}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditUser(u)}
                        className="w-8 h-8 rounded-lg border border-border flex items-center justify-center ml-auto text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-border px-4 py-3 flex items-center justify-between bg-secondary/20">
              <p className="text-xs text-muted-foreground">
                Halaman {page} dari {totalPages}
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit dialog */}
      {editUser && botId && (
        <EditDialog
          user={editUser}
          botId={botId}
          token={token}
          onClose={() => setEditUser(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

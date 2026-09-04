import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useGetTodayBanner, useLogout, useGetMyMessages, useListStudents } from "@workspace/api-client-react";
import { clearAuth, getToken, setToken } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { isFeatureEnabled, shouldHideShortcomings } from "@/lib/schoolConfig";
import {
  Users, ClipboardList, BarChart3,
  UserCheck, UserX, Home, LogOut, Menu, X,
  CalendarCheck, PenSquare, Headphones, BookUser, FileDown,
  BarChart2, MessageSquare, Search, Clock, Archive, Layers,
  Calendar, ShoppingBag, Award, Shuffle, GraduationCap, AlertTriangle,
  ArrowLeftRight, Loader2, BookOpen, PlaneTakeoff, Bell, CheckCheck,
  TrendingUp, Globe, Moon, Sun, Database, Award as CertificateIcon,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import logoUrl from "@/assets/logo.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface LayoutProps {
  user: {
    id: number;
    name: string;
    role: string;
    email: string;
    track?: string | null;
  };
  children: React.ReactNode;
}

interface AccountInfo {
  id: number;
  name: string;
  role: string;
  roleLabel: string;
  track: string | null;
  circleId: number | null;
  circleName: string | null;
  isCurrent: boolean;
}

function useMyAccounts(userId: number) {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/auth/my-accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : []))
      .then((data: AccountInfo[]) => setAccounts(data))
      .catch(() => {});
  }, [userId]);
  return accounts;
}

function NavLink({ href, label, icon: Icon, badge }: { href: string; label: string; icon: React.ElementType; badge?: number }) {
  const [location] = useLocation();
  const isActive = location === href || (href !== "/" && location.startsWith(href));

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold group ${
        isActive
          ? "bg-white/20 text-white shadow-sm"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
      data-testid={`nav-link-${href.replace("/", "") || "home"}`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-white/60 group-hover:text-white/80"}`} />
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className="mr-auto ms-auto bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
          {badge}
        </span>
      )}
      {isActive && !badge && <div className="me-auto w-1.5 h-1.5 rounded-full bg-white/80 me-0 ms-auto"></div>}
    </Link>
  );
}

function NewsTicker() {
  const { data: banner } = useGetTodayBanner({ query: { queryKey: ["todayBanner"] } });

  const achievement = banner?.achievement ?? [];
  const fullAttendance = banner?.leastAbsent ?? [];

  const achievementText = achievement.length > 0
    ? achievement
        .map(item => `${item.circleName} (${item.track}) — ${item.totalPages.toString().replace(".", ",")} وجه`)
        .join("   ✦   ")
    : "لا توجد بيانات إنجاز لليوم بعد";

  const attendanceText = fullAttendance.length > 0
    ? fullAttendance
        .map(item => `${item.circleName} (${item.track}) — ${item.presentCount} طالبة`)
        .join("   ✦   ")
    : "لا توجد حلقات بحضور كامل بعد";

  return (
    <div data-testid="news-ticker">
      <div className="text-white py-1.5 overflow-hidden relative"
        style={{ background: "linear-gradient(90deg,  #1A2260 0%, #2B3784 100%)" }}
      >
        <div className="flex items-center gap-3 px-4">
          <div className="flex-shrink-0 bg-white/20 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap">
            🏆 الأكثر إنجازًا
          </div>
          <div className="flex-1 overflow-hidden">
            <div className={achievement.length > 0 ? "ticker-scroll text-xs font-medium" : "text-xs font-medium opacity-70"}>
              {achievement.length > 0 ? `${achievementText}   ✦   ${achievementText}` : achievementText}
            </div>
          </div>
        </div>
      </div>
      <div className="text-white py-1.5 overflow-hidden relative"
        style={{ background: "linear-gradient(90deg,  #2B3784 0%, #1A2260 100%)" }}
      >
        <div className="flex items-center gap-3 px-4">
          <div className="flex-shrink-0 bg-white/20 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap">
            ✅ أكثر حضورًا
          </div>
          <div className="flex-1 overflow-hidden">
            <div className={fullAttendance.length > 0 ? "ticker-scroll text-xs font-medium" : "text-xs font-medium opacity-70"}>
              {fullAttendance.length > 0 ? `${attendanceText}   ✦   ${attendanceText}` : attendanceText}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SEARCH_ROLES = ["leader", "track_supervisor"];

function StudentSearch({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results } = useListStudents(
    debouncedQ.length >= 2 ? { q: debouncedQ } : {},
    { query: { queryKey: ["studentSearch", debouncedQ], enabled: debouncedQ.length >= 2 } }
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const showResults = open && debouncedQ.length >= 2 && results && results.length > 0;

  return (
    <div ref={wrapperRef} className="relative mx-4 mb-2">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
        <input
          type="text"
          placeholder="بحث عن طالبة..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full bg-white/10 text-white placeholder-white/40 text-sm rounded-xl pr-9 pl-3 py-2 border border-white/10 focus:outline-none focus:border-white/30 focus:bg-white/15 transition-colors"
          dir="rtl"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setDebouncedQ(""); setOpen(false); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {showResults && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
          {results!.slice(0, 6).map(s => (
            <button
              key={s.id}
              onClick={() => {
                onNavigate(`/students/${s.id}`);
                setQuery("");
                setOpen(false);
              }}
              className="w-full text-right px-3 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0"
            >
              <p className="text-sm font-medium text-foreground">{s.fullName}</p>
            </button>
          ))}
        </div>
      )}
      {open && debouncedQ.length >= 2 && results && results.length === 0 && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl shadow-xl z-50 px-3 py-3 text-xs text-muted-foreground text-center">
          لا توجد نتائج
        </div>
      )}
    </div>
  );
}

const ALERT_ROLES = ["leader", "deputy", "track_supervisor"];

function useLowMemorizationAlerts(userId: number, role: string) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const enabled = ALERT_ROLES.includes(role);

  const fetchAlerts = () => {
    if (!enabled) return;
    const token = getToken();
    if (!token) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/alerts/low-memorization`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(setAlerts)
      .catch(() => {});
  };

  useEffect(() => {
    fetchAlerts();
    const t = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [userId, role, enabled]);

  const markAllRead = async () => {
    const token = getToken();
    if (!token) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    await fetch(`${base}/api/alerts/low-memorization/read-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    setAlerts([]);
    setOpen(false);
  };

  const markOneRead = async (id: number) => {
    const token = getToken();
    if (!token) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    await fetch(`${base}/api/alerts/low-memorization/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  return { alerts, open, setOpen, markAllRead, markOneRead, enabled };
}

function LowMemorizationAlertBell({ userId, role }: { userId: number; role: string }) {
  const { alerts, open, setOpen, markAllRead, markOneRead, enabled } = useLowMemorizationAlerts(userId, role);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!enabled) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        title="تنبيهات قلة الحفظ"
      >
        <Bell className="w-4 h-4 text-white/80" />
        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5 leading-none">
            {alerts.length > 99 ? "99+" : alerts.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden border border-border"
          style={{ right: "auto" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-rose-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span className="font-bold text-sm text-rose-800">تنبيهات قلة الحفظ</span>
              {alerts.length > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                  {alerts.length}
                </span>
              )}
            </div>
            {alerts.length > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-medium"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                قراءة الكل
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                لا توجد تنبيهات حالية
              </div>
            ) : (
              <div className="divide-y divide-border">
                {alerts.slice(0, 15).map((a: any) => (
                  <div key={a.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-foreground truncate">{a.studentName}</p>
                        <p className="text-xs text-muted-foreground">{a.circleName} · {a.track}</p>
                        <p className="text-xs text-rose-600 font-medium mt-0.5">
                          {a.totalPages} وجه في آخر {a.periodDays} يومًا
                        </p>
                      </div>
                      <button
                        onClick={() => markOneRead(a.id)}
                        className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                        title="تعليم كمقروء"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const MESSAGE_ROLES = ["student", "teacher", "supervisor", "track_supervisor"];

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
}

function NewMessagesModal({ userId, role, navigate }: {
  userId: number; role: string; navigate: (p: string) => void;
}) {
  const enabled = MESSAGE_ROLES.includes(role);
  const { data: messages } = useGetMyMessages({ query: { queryKey: ["myMessages"], enabled } });
  const [open, setOpen] = useState(false);

  const sessionKey = `msgs_modal_${userId}`;
  const seenKey = `msgs_seen_${userId}`;

  useEffect(() => {
    if (!enabled || !messages || messages.length === 0) return;
    // Show modal only once per session if there are unread messages
    const shownThisSession = sessionStorage.getItem(sessionKey);
    if (shownThisSession) return;
    const lastSeen = localStorage.getItem(seenKey);
    const hasUnread = !lastSeen || messages.some(m => m.createdAt > lastSeen);
    if (hasUnread) {
      setOpen(true);
      sessionStorage.setItem(sessionKey, "1");
    }
  }, [messages, enabled, sessionKey, seenKey]);

  const handleClose = () => {
    localStorage.setItem(seenKey, new Date().toISOString());
    setOpen(false);
  };

  const handleGoToMessages = () => {
    handleClose();
    navigate("/my-messages");
  };

  if (!enabled || !messages || messages.length === 0) return null;

  const lastSeen = localStorage.getItem(seenKey);
  const unread = messages.filter(m => !lastSeen || m.createdAt > lastSeen);
  const displayMsgs = unread.length > 0 ? unread : messages.slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2 text-primary">
            <MessageSquare className="w-5 h-5" />
            رسائل القائدة
            {unread.length > 0 && (
              <Badge className="bg-rose-500 text-white text-xs border-0 mr-auto">
                {unread.length} جديدة
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5 py-1 max-h-72 overflow-y-auto">
          {displayMsgs.map(msg => (
            <div key={msg.id} className="bg-primary/5 rounded-xl px-3.5 py-3 border border-primary/10">
              <p className="text-sm text-foreground leading-relaxed">{msg.content}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">{formatDateShort(msg.createdAt)}</span>
                {msg.expiresAt && (
                  <span className="text-xs text-amber-600 flex items-center gap-1 mr-auto">
                    <Clock className="w-3 h-3" />
                    تنتهي {formatDateShort(msg.expiresAt)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
          <Button
            className="flex-1 gap-1.5"
            onClick={handleGoToMessages}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            كل الرسائل
          </Button>
          <Button variant="outline" onClick={handleClose} className="flex-1">
            حسنًا
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const BADGE_ROLES = ["student", "teacher", "supervisor", "track_supervisor"];

function useUnreadMessageCount(userId: number, role: string, isHome: boolean, isMessagesPage: boolean) {
  const enabled = BADGE_ROLES.includes(role);
  const { data: messages } = useGetMyMessages({
    query: { queryKey: ["myMessages"], enabled, refetchInterval: 60000 },
  });

  const storageKey = `msgs_seen_${userId}`;

  useEffect(() => {
    if ((isHome || isMessagesPage) && enabled) {
      localStorage.setItem(storageKey, new Date().toISOString());
    }
  }, [isHome, isMessagesPage, enabled, storageKey]);

  return useMemo(() => {
    if (!enabled || !messages) return 0;
    const lastSeen = localStorage.getItem(storageKey);
    if (!lastSeen) return messages.length;
    return messages.filter(m => m.createdAt > lastSeen).length;
  }, [messages, enabled, storageKey]);
}

export default function Layout({ user, children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const queryClient = useQueryClient();
  const logout = useLogout();
  const [location, setLocation] = useLocation();
  const allAccounts = useMyAccounts(user.id);
  const currentAccount = allAccounts.find(a => a.isCurrent);
  const otherAccounts = allAccounts.filter(a => !a.isCurrent);

  const isHome = location === "/";
  const isMessagesPage = location === "/my-messages";
  const unreadCount = useUnreadMessageCount(user.id, user.role, isHome, isMessagesPage);

  const handleLogout = () => {
    clearAuth();
    queryClient.clear();
    logout.mutate(undefined);
    setLocation("/login");
  };

  // تبديل الحساب: يحصل على token جديد للحساب المختار ثم يُعيد تحميل الصفحة
  const handleSwitchAccount = async (targetUserId: number) => {
    if (switching) return;
    setSwitching(true);
    try {
      const token = getToken();
      const res = await fetch("/api/auth/switch-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) throw new Error("switch failed");
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
        queryClient.clear();
        window.location.assign("/");
      }
    } catch {
      setSwitching(false);
    }
  };

  const navItems = getNavItems(user.role, unreadCount, user.track, (user as any).circleDataEntryType);

  return (
    <div className="min-h-screen sana-main-background flex flex-col" dir="rtl">
      {/* Messages popup on login */}
      <NewMe

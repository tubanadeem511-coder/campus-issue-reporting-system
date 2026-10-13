
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { publicSupabase, statuses } from "@/lib/supabase";
import { useAuth } from "@/app/ui/auth";
import { Activity, CheckCircle2, ClipboardList, Clock3, RefreshCw, Search, ShieldAlert } from "lucide-react";

type Complaint = {
  id: string;
  reference_number: string;
  title: string;
  category: string;
  location: string;
  building: string | null;
  room: string | null;
  description: string;
  image_path: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
};

type ApiResponse = {
  complaints?: Complaint[];
  total?: number;
  counts?: Record<string, number>;
  error?: string;
};

const statusStyles: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-700/20",
  "In Progress": "bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-700/20",
  Resolved: "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-700/20",
};

export default function AdminPage() {
  const router = useRouter();
  const { session, role, loading } = useAuth();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loadingData, setLoadingData] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadComplaints = useCallback(async () => {
    if (!session?.access_token) return;

    setLoadingData(true);
    setError("");

    try {
      const response = await fetch("/api/complaints?scope=admin", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const result: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Complaints load nahi ho sakin.");
      }

      setComplaints(result.complaints ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Dashboard load nahi ho saka."
      );
    } finally {
      setLoadingData(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!loading && !session) {
      router.replace("/login");
    }
  }, [loading, session, router]);

  useEffect(() => {
    if (!loading && session && role === "admin") {
      void loadComplaints();
    } else if (!loading && session && role && role !== "admin") {
      setLoadingData(false);
    }
  }, [loading, session, role, loadComplaints]);

  const filteredComplaints = useMemo(() => {
    const term = search.trim().toLowerCase();

    return complaints.filter((complaint) => {
      const matchesStatus =
        statusFilter === "All" || complaint.status === statusFilter;

      const searchableText = [
        complaint.reference_number,
        complaint.title,
        complaint.category,
        complaint.location,
        complaint.building ?? "",
        complaint.room ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && searchableText.includes(term);
    });
  }, [complaints, search, statusFilter]);

  const counts = useMemo(() => {
    return {
      Total: complaints.length,
      Pending: complaints.filter((c) => c.status === "Pending").length,
      "In Progress": complaints.filter(
        (c) => c.status === "In Progress"
      ).length,
      Resolved: complaints.filter((c) => c.status === "Resolved").length,
    };
  }, [complaints]);

  async function updateStatus(id: string, nextStatus: string) {
    if (!session?.access_token) {
      setError("Session expire ho gayi hai. Dobara login karein.");
      return;
    }

    setUpdatingId(id);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/complaints", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, status: nextStatus }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Status update nahi hua.");
      }

      setComplaints((previous) =>
        previous.map((complaint) =>
          complaint.id === id
            ? { ...complaint, status: nextStatus }
            : complaint
        )
      );

      setNotice("Complaint status successfully update ho gaya.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Status update nahi hua."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading || (!session && !error)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F7FB] p-6">
        <p className="text-sm text-[#64748B]">Checking your account…</p>
      </main>
    );
  }

  if (session && role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F7FB] p-6">
        <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-[0_20px_60px_-40px_rgba(20,43,74,.45)]">
          <ShieldAlert className="mx-auto text-amber-600" size={32}/><h1 className="mt-4 text-2xl font-bold text-[#142B4A]">
            Admin Access Required
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Administrator access is required to view this workspace.
          </p>
          <button
            onClick={() => router.push("/complaints")}
            className="mt-6 min-h-11 rounded-lg bg-[#142B4A] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0B766E]"
          >
            My Complaints
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F7FB] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E2E8F0] bg-white px-5 py-4 shadow-sm sm:px-6">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#142B4A] text-white"><ClipboardList size={19}/></span><div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0B766E]">CampusFix administration</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#142B4A] sm:text-[27px]">Complaints</h1>
          </div></div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/reports" className="min-h-11 rounded-lg px-4 py-3 text-sm font-semibold text-[#475569] transition hover:bg-[#F4F7FB] hover:text-[#142B4A]">Reports</Link>
            <button
              onClick={() => router.push("/complaints")}
              className="min-h-11 rounded-lg border border-[#CBD5E1] bg-white px-4 py-2.5 text-sm font-semibold text-[#334155] transition hover:bg-[#F4F7FB]"
            >
              My Complaints
            </button>
            <button
              onClick={() => void loadComplaints()}
              disabled={loadingData}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#142B4A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B766E] disabled:opacity-50"
            >
              <RefreshCw size={16} className={loadingData ? "animate-spin" : ""}/>
              {loadingData ? "Loading..." : "Refresh"}
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {error}
          </div>
        )}

        {notice && (
          <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            {notice}
          </div>
        )}

        <section aria-label="Complaint summary" className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ["Total Complaints", counts.Total, "All submitted reports"],
              ["Pending", counts.Pending, "Awaiting attention"],
              ["In Progress", counts["In Progress"], "Currently being handled"],
              ["Resolved", counts.Resolved, "Completed reports"],
            ] as const
          ).map(([label, value, description]) => (
            <div
              key={label}
              className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_8px_28px_-22px_rgba(20,43,74,.5)] transition-shadow hover:shadow-[0_12px_34px_-22px_rgba(20,43,74,.35)]"
            >
              <p className="flex items-center justify-between gap-3 text-sm font-medium text-[#64748B]">{label}<span className={`grid size-9 place-items-center rounded-lg ${label === "Pending" ? "bg-amber-50 text-amber-700" : label === "In Progress" ? "bg-blue-50 text-blue-700" : label === "Resolved" ? "bg-emerald-50 text-emerald-700" : "bg-[#EAF5F4] text-[#0B766E]"}`}>{label === "Pending" ? <Clock3 size={17}/> : label === "In Progress" ? <Activity size={17}/> : label === "Resolved" ? <CheckCircle2 size={17}/> : <ClipboardList size={17}/>}</span></p>
              <p className="mt-3 text-3xl font-bold text-[#172B4D]">
                {loadingData ? "—" : value}
              </p>
              <p className="mt-2 text-xs text-[#64748B]">{description}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_12px_36px_-28px_rgba(20,43,74,.45)]">
          <div className="border-b border-[#E2E8F0] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#142B4A]">
                  Complaint Management
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredComplaints.length} complaint(s) displayed
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
              <label className="relative block"><span className="sr-only">Search complaints</span><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search reference, title, category or location..."
                className="w-full rounded-lg border border-[#CBD5E1] bg-white py-3 pl-10 pr-4 text-sm text-[#172B4D] outline-none transition focus:border-[#0F9488] focus:ring-2 focus:ring-[#0F9488]/15"
              /></label>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-lg border border-[#CBD5E1] bg-white px-4 py-3 text-sm text-[#172B4D] outline-none transition focus:border-[#0F9488] focus:ring-2 focus:ring-[#0F9488]/15"
              >
                <option value="All">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingData ? (
            <div role="status" className="p-12 text-center text-sm text-[#64748B]">
              Loading complaints...
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="p-12 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500"><ClipboardList size={21}/></span><h3 className="mt-4 font-semibold text-[#142B4A]">
                No complaints found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Try another search term or status filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0F9488]" role="region" aria-label="Complaints table, scroll horizontally on small screens" tabIndex={0}>
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-[#F8FAFC] text-[11px] uppercase tracking-[.12em] text-[#64748B]">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Complaint</th>
                    <th className="px-5 py-4 font-semibold">Category</th>
                    <th className="px-5 py-4 font-semibold">Location</th>
                    <th className="px-5 py-4 font-semibold">Submitted</th>
                    <th className="px-5 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredComplaints.map((complaint) => (
                    <tr key={complaint.id} className="align-top transition-colors hover:bg-[#F8FAFC]">
                      <td className="max-w-sm px-5 py-5">
                        <p className="font-semibold text-[#172B4D]">
                          {complaint.title}
                        </p>
                        <p className="mt-1 text-xs font-medium text-[#0B766E]">
                          {complaint.reference_number}
                        </p>
                        <p className="mt-2 line-clamp-3 text-sm text-slate-500">
                          {complaint.description}
                        </p>
                        {complaint.image_url && (
                          <a
                            href={complaint.image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-xs font-semibold text-[#0B766E] underline"
                          >
                            View attached image
                          </a>
                        )}
                      </td>
                      <td className="px-5 py-5 text-slate-700">
                        {complaint.category}
                      </td>
                      <td className="px-5 py-5 text-slate-700">
                        {complaint.location}
                      </td>
                      <td className="whitespace-nowrap px-5 py-5 text-slate-600">
                        {new Date(complaint.created_at).toLocaleDateString(
                          "en-PK",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </td>
                      <td className="px-5 py-5">
                        <span
                          className={`mb-3 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                            statusStyles[complaint.status] ??
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {complaint.status}
                        </span>
                        <select
                          aria-label={`Update status for ${complaint.reference_number}`}
                          value={complaint.status}
                          disabled={updatingId === complaint.id}
                          onChange={(event) =>
                            void updateStatus(complaint.id, event.target.value)
                          }
                          className="block w-36 rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-[#0F9488] disabled:opacity-50"
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        {updatingId === complaint.id && (
                          <p className="mt-2 text-xs text-slate-500">
                            Updating...
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-5 text-xs text-slate-500">
          CampusFix Admin • Complaint status changes are saved to Supabase.
        </p>
      </div>
    </main>
  );
}

import React, { useState, useEffect } from 'react';
import { AuditLog } from '../types.js';
import { apiRequest } from '../api/client.js';
import {
  ShieldAlert,
  Filter,
  RotateCcw,
  CheckCircle2,
  XCircle,
  X,
  FileCode,
  AlertCircle,
} from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected Log for metadata modal
  const [inspectedLog, setInspectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (actionFilter) params.append('action', actionFilter);
      if (statusFilter) params.append('status', statusFilter);
      params.append('limit', '50');

      const res = await apiRequest(`/audit-logs?${params.toString()}`);
      if (res.success && res.data) {
        setLogs(res.data.logs);
        setTotal(res.data.total);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, statusFilter]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Security Audit & Compliance Trail
            </h1>
            <span className="bg-rose-50 text-rose-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-rose-200">
              Immutable Records
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time forensic logs of authentication events, authorization checks, and notice lifecycles.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-xl transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh Logs</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center space-x-1.5 text-slate-500 font-semibold uppercase tracking-wider">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter Logs:</span>
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Actions</option>
          <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
          <option value="LOGIN_FAILURE">LOGIN_FAILURE</option>
          <option value="UNAUTHORIZED_ACCESS">UNAUTHORIZED_ACCESS</option>
          <option value="NOTICE_CREATE">NOTICE_CREATE</option>
          <option value="NOTICE_UPDATE">NOTICE_UPDATE</option>
          <option value="NOTICE_DELETE">NOTICE_DELETE</option>
          <option value="NOTICE_SCHEDULE">NOTICE_SCHEDULE</option>
          <option value="LOGOUT">LOGOUT</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILURE">FAILURE</option>
        </select>

        <span className="text-slate-400 ml-auto">
          Showing <strong>{logs.length}</strong> of <strong>{total}</strong> records
        </span>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actor / Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Target Resource</th>
                <th className="px-4 py-3">IP Address</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Loading security audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No audit records match the current filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isFailure = log.status === 'FAILURE' || log.action === 'UNAUTHORIZED_ACCESS';
                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isFailure ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded-sm ${
                            log.action === 'UNAUTHORIZED_ACCESS'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : log.action.includes('LOGIN')
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full font-medium ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold'
                          }`}
                        >
                          {log.status === 'SUCCESS' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          <span>{log.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-800 font-medium font-mono">
                        {log.user_email || 'Anonymous'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {log.user_role || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-mono truncate max-w-[150px]">
                        {log.resource_type}: {log.resource_id || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono">
                        {log.ip_address || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => setInspectedLog(log)}
                          className="px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded-md font-medium transition-colors cursor-pointer inline-flex items-center space-x-1"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Metadata Modal */}
      {inspectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Audit Event Details: {inspectedLog.action}
                </h3>
              </div>
              <button
                onClick={() => setInspectedLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-500 font-semibold">Event ID:</span>
                  <div className="font-mono text-slate-800 break-all">{inspectedLog.id}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Timestamp:</span>
                  <div className="font-mono text-slate-800">{formatDate(inspectedLog.created_at)}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">User:</span>
                  <div className="font-mono text-slate-800">{inspectedLog.user_email || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">IP Address:</span>
                  <div className="font-mono text-slate-800">{inspectedLog.ip_address || 'N/A'}</div>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">User Agent:</span>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono text-[11px] text-slate-700 break-all">
                  {inspectedLog.user_agent || 'N/A'}
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Event Metadata (JSON):</span>
                <pre className="bg-slate-900 text-emerald-400 p-3 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed">
                  {JSON.stringify(inspectedLog.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectedLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

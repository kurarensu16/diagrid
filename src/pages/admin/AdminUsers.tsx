import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { mockAdmin, type AdminUser } from '../../services/mockAdmin';
import { Search, Eye, X, UserCheck, UserX, Shield, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    loadUsers();
  }, []);

  // Reset to first page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, roleFilter, pageSize]);

  const loadUsers = () => {
    setUsers(mockAdmin.getUsers());
  };

  const handleToggleStatus = (id: string, currentStatus: 'active' | 'suspended') => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    if (confirm(`Are you sure you want to change this user status to ${nextStatus.toUpperCase()}?`)) {
      mockAdmin.setUserStatus(id, nextStatus);
      loadUsers();
      if (selectedUser && selectedUser.id === id) {
        setSelectedUser({ ...selectedUser, status: nextStatus });
      }
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredUsers.length);
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  return (
    <div className="p-8 flex flex-col gap-6 text-ink">
      {/* Header */}
      <div className="border-b border-line pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight">user_management</h1>
          <p className="text-[13px] text-ink-soft font-mono mt-1">// manage registered developer accounts and security policies</p>
        </div>
        <div className="font-mono text-[12px] text-ink-soft">
          PAGE {validCurrentPage} OF {totalPages} • TOTAL_RECORDS: {filteredUsers.length} of {users.length}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
        {/* Search */}
        <div className="relative flex-1 lg:max-w-[320px]">
          <Search className="w-4 h-4 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 border border-line bg-paper-raised text-[13px] font-mono focus:border-ink focus:outline-none w-full"
            placeholder="search_user_email..."
          />
        </div>

        {/* Filter Controls: Role and Status */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Role filter */}
          <div className="flex border border-line font-mono text-[11px] bg-paper select-none">
            <span className="px-2.5 py-2 border-r border-line text-ink-soft uppercase text-[10px] flex items-center bg-paper-raised font-bold">
              role:
            </span>
            {(['all', 'user', 'admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-2 border-r last:border-r-0 border-line uppercase tracking-wide transition-colors cursor-pointer ${
                  roleFilter === r ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-paper-raised hover:text-ink'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex border border-line font-mono text-[11px] bg-paper select-none">
            <span className="px-2.5 py-2 border-r border-line text-ink-soft uppercase text-[10px] flex items-center bg-paper-raised font-bold">
              status:
            </span>
            {(['all', 'active', 'suspended'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 border-r last:border-r-0 border-line uppercase tracking-wide transition-colors cursor-pointer ${
                  statusFilter === s ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-paper-raised hover:text-ink'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users List Table */}
      <Card variant="blueprint" className="p-0 overflow-x-auto select-text">
        <table className="w-full text-left border-collapse font-mono text-[12px]">
          <thead>
            <tr className="border-b border-line bg-paper text-ink-soft font-bold">
              <th className="p-4 uppercase tracking-wide">email_address</th>
              <th className="p-4 uppercase tracking-wide">role</th>
              <th className="p-4 uppercase tracking-wide text-center">status</th>
              <th className="p-4 uppercase tracking-wide text-center">projects</th>
              <th className="p-4 uppercase tracking-wide text-center">diagrams</th>
              <th className="p-4 uppercase tracking-wide">last_active</th>
              <th className="p-4 uppercase tracking-wide text-center">actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-ink-soft italic">
                  // no users matching search filters found
                </td>
              </tr>
            ) : (
              paginatedUsers.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0 hover:bg-paper hover:bg-opacity-40">
                  <td className="p-4 font-bold text-[13px] break-all">{u.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 border text-[10px] uppercase tracking-wide ${
                      u.role === 'admin' ? 'border-signal text-signal bg-signal bg-opacity-5' : 'border-line text-ink-soft'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wide border ${
                      u.status === 'active' 
                        ? 'border-blueprint text-blueprint bg-blueprint bg-opacity-5' 
                        : 'border-signal text-signal bg-signal bg-opacity-5'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="p-4 text-center font-bold">{u.project_count}</td>
                  <td className="p-4 text-center font-bold">{u.diagram_count}</td>
                  <td className="p-4 text-ink-soft text-[11px]">
                    {new Date(u.last_active).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setSelectedUser(u)}
                        className="font-mono text-[10px] border border-line text-ink hover:border-blueprint hover:text-blueprint px-2.5 py-1 uppercase tracking-wide cursor-pointer transition-colors flex items-center gap-1"
                        title="View user details"
                      >
                        <Eye className="w-3 h-3" />
                        details
                      </button>

                      {u.role === 'admin' ? (
                        <span className="text-ink-soft text-[10px] select-none italic">// locked</span>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(u.id, u.status)}
                          className={`font-mono text-[10px] border px-2.5 py-1 uppercase tracking-wide cursor-pointer transition-colors ${
                            u.status === 'active'
                              ? 'border-signal text-signal hover:bg-signal hover:text-paper'
                              : 'border-blueprint text-blueprint hover:bg-blueprint hover:text-paper'
                          }`}
                        >
                          {u.status === 'active' ? 'suspend()' : 'activate()'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Table Pagination Footer */}
        <div className="border-t border-line bg-paper-raised px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[11px] select-none">
          {/* Left: Entries Counter & Rows Per Page */}
          <div className="flex flex-wrap items-center gap-4 text-ink-soft">
            <div>
              {filteredUsers.length === 0 ? (
                <span>showing 0 of 0 users</span>
              ) : (
                <span>
                  showing <span className="font-bold text-ink">{startIndex + 1}</span>-
                  <span className="font-bold text-ink">{endIndex}</span> of{' '}
                  <span className="font-bold text-ink">{filteredUsers.length}</span> users
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase text-ink-soft font-bold">per_page:</span>
              <div className="flex border border-line bg-paper">
                {[5, 10, 25].map((size) => (
                  <button
                    key={size}
                    onClick={() => setPageSize(size)}
                    className={`px-2 py-0.5 border-r last:border-r-0 border-line text-[10px] cursor-pointer transition-colors ${
                      pageSize === size
                        ? 'bg-ink text-paper font-bold'
                        : 'text-ink-soft hover:bg-paper-raised hover:text-ink'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Page Navigation Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              {/* First Page */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={validCurrentPage <= 1}
                className={`p-1.5 border border-line transition-colors flex items-center justify-center ${
                  validCurrentPage <= 1
                    ? 'opacity-30 cursor-not-allowed text-ink-soft'
                    : 'hover:border-ink hover:bg-paper text-ink cursor-pointer'
                }`}
                title="First page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>

              {/* Prev Page */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validCurrentPage <= 1}
                className={`p-1.5 border border-line transition-colors flex items-center justify-center ${
                  validCurrentPage <= 1
                    ? 'opacity-30 cursor-not-allowed text-ink-soft'
                    : 'hover:border-ink hover:bg-paper text-ink cursor-pointer'
                }`}
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1 mx-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    return Math.abs(p - validCurrentPage) <= 1;
                  })
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const hasGap = prevP && p - prevP > 1;

                    return (
                      <React.Fragment key={p}>
                        {hasGap && <span className="px-1 text-ink-soft">...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`min-w-[26px] h-[26px] px-1.5 border text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center ${
                            validCurrentPage === p
                              ? 'border-ink bg-ink text-paper shadow-sm'
                              : 'border-line bg-paper text-ink hover:border-ink hover:bg-paper-raised'
                          }`}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              {/* Next Page */}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validCurrentPage >= totalPages}
                className={`p-1.5 border border-line transition-colors flex items-center justify-center ${
                  validCurrentPage >= totalPages
                    ? 'opacity-30 cursor-not-allowed text-ink-soft'
                    : 'hover:border-ink hover:bg-paper text-ink cursor-pointer'
                }`}
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              {/* Last Page */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={validCurrentPage >= totalPages}
                className={`p-1.5 border border-line transition-colors flex items-center justify-center ${
                  validCurrentPage >= totalPages
                    ? 'opacity-30 cursor-not-allowed text-ink-soft'
                    : 'hover:border-ink hover:bg-paper text-ink cursor-pointer'
                }`}
                title="Last page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* User Details Modal Dialog */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink bg-opacity-60 backdrop-blur-sm p-4">
          <Card variant="blueprint" className="w-full max-w-lg p-6 flex flex-col gap-5 bg-paper shadow-hard">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blueprint" />
                <h3 className="font-mono text-[16px] font-bold tracking-tight">
                  user_profile_inspector()
                </h3>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 border border-line hover:border-signal hover:text-signal transition-colors text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile fields */}
            <div className="flex flex-col gap-3 font-mono text-[12px]">
              <div className="flex flex-col gap-1 border-b border-line border-dashed pb-2">
                <span className="text-ink-soft uppercase text-[10px]">// account_id</span>
                <span className="font-bold text-ink">{selectedUser.id}</span>
              </div>
              <div className="flex flex-col gap-1 border-b border-line border-dashed pb-2">
                <span className="text-ink-soft uppercase text-[10px]">// email_address</span>
                <span className="font-bold text-blueprint break-all">{selectedUser.email}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-line border-dashed pb-2">
                <div>
                  <span className="text-ink-soft uppercase text-[10px] block mb-1">// security_role</span>
                  <span className={`inline-block px-2 py-0.5 border text-[10px] uppercase font-bold ${
                    selectedUser.role === 'admin' ? 'border-signal text-signal bg-signal bg-opacity-5' : 'border-line text-ink'
                  }`}>
                    {selectedUser.role}
                  </span>
                </div>
                <div>
                  <span className="text-ink-soft uppercase text-[10px] block mb-1">// account_status</span>
                  <span className={`inline-block px-2 py-0.5 border text-[10px] uppercase font-bold ${
                    selectedUser.status === 'active' ? 'border-blueprint text-blueprint bg-blueprint bg-opacity-5' : 'border-signal text-signal bg-signal bg-opacity-5'
                  }`}>
                    {selectedUser.status}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-line border-dashed pb-2">
                <div>
                  <span className="text-ink-soft uppercase text-[10px] block">// total_projects</span>
                  <span className="font-bold text-ink text-[14px]">{selectedUser.project_count}</span>
                </div>
                <div>
                  <span className="text-ink-soft uppercase text-[10px] block">// total_diagrams</span>
                  <span className="font-bold text-ink text-[14px]">{selectedUser.diagram_count}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-line border-dashed pb-2">
                <div>
                  <span className="text-ink-soft uppercase text-[10px] block">// created_at</span>
                  <span className="text-ink-soft text-[11px]">{new Date(selectedUser.created_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-ink-soft uppercase text-[10px] block">// last_active</span>
                  <span className="text-ink-soft text-[11px]">{new Date(selectedUser.last_active).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-2">
              {selectedUser.role !== 'admin' ? (
                <button
                  onClick={() => handleToggleStatus(selectedUser.id, selectedUser.status)}
                  className={`flex items-center gap-1.5 font-mono text-[11px] border px-4 py-2 uppercase tracking-wide cursor-pointer transition-colors ${
                    selectedUser.status === 'active'
                      ? 'border-signal text-signal hover:bg-signal hover:text-paper'
                      : 'border-blueprint text-blueprint hover:bg-blueprint hover:text-paper'
                  }`}
                >
                  {selectedUser.status === 'active' ? (
                    <>
                      <UserX className="w-3.5 h-3.5" />
                      suspend_account()
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-3.5 h-3.5" />
                      activate_account()
                    </>
                  )}
                </button>
              ) : (
                <span className="font-mono text-[11px] text-ink-soft italic">// admin accounts cannot be suspended</span>
              )}

              <button
                onClick={() => setSelectedUser(null)}
                className="font-mono text-[11px] border border-line px-4 py-2 hover:bg-ink hover:text-paper uppercase tracking-wide transition-colors cursor-pointer"
              >
                close()
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

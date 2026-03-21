import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { toast } from 'sonner';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';

export default function AdminCompanyDetailPage() {
  const { companyId } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    role: '',
    status: 'ACTIVE',
  });

  const loadCompany = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/companies/${companyId}`);
      setCompany(response.data);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to load company details.');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

const handleSuspendCompany = async () => {
    try {
      await api.post(`/admin/companies/${companyId}/suspend`);
      toast.success('Company suspended successfully.');
      loadCompany();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to suspend company.');
    }
  };

  const handleDeleteCompany = async () => {
    try {
      await api.post(`/admin/companies/${companyId}/delete`);
      toast.success('Company soft deleted successfully.');
      loadCompany();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to delete company.');
    }
  };

const handleRestoreCompany = async () => {
    try {
      await api.post(`/admin/companies/${companyId}/restore`);
      toast.success('Company restored successfully.');
      loadCompany();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to restore company.');
    }
  };

const handleSuspendUser = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/suspend`);
      toast.success('Seat suspended successfully.');
      loadCompany();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to suspend seat.');
    }
  };

  const handleRestoreUser = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/restore`);
      toast.success('Seat reactivated successfully.');
      loadCompany();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to reactivate seat.');
    }
  };

const handleSoftDeleteUser = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/delete`);
      toast.success('Seat soft deleted successfully.');
      loadCompany();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to delete seat.');
    }
  };

  const handleHardDeleteUser = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/hard-delete`);
      toast.success('Seat permanently deleted.');
      loadCompany();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to hard delete seat.');
    }
  };

const handleStartEditUser = (user) => {
    setEditingUserId(user.user_id);
    setEditForm({
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role || '',
      status: user.status || 'ACTIVE',
    });
  };

const handleSaveEditUser = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/update`, editForm);
      toast.success('Seat updated successfully.');
      setEditingUserId(null);
      loadCompany();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to update seat.');
    }
  };

const handleCancelEditUser = () => {
    setEditingUserId(null);
    setEditForm({
      full_name: '',
      email: '',
      role: '',
      status: 'ACTIVE',
    });
  };

const handleCreateSeat = async () => {
    try {
      await api.post(
        `/admin/companies/${company.company_id}/users/create`,
        newSeatForm
      );

      toast.success('Seat created successfully.');

      setShowAddSeatForm(false);
      setNewSeatForm({
        full_name: '',
        email: '',
        role: 'QUOTING_STAFF',
        status: 'ACTIVE',
      });

      loadCompany();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to create seat.');
    }
  };

  return (
    <PlatformAdminLayout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">
            {company?.company_name || 'Company Detail'}
          </h1>
          <p className="text-slate-600 mt-2">
            Seats, roles, and lockout tracking
          </p>
        </div>

        {loading ? (
          <div className="card-technical p-6 text-slate-600">Loading company details...</div>
        ) : !company ? (
          <div className="card-technical p-6 text-slate-600">Company not found.</div>
        ) : (
          <>
            <div className="card-technical p-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wide">
                    Company Overview
                  </h2>
                </div>
                <div className="flex gap-2">
                  {company?.status === 'ACTIVE' && (
                    <>
                      <button
                        type="button"
                        onClick={handleSuspendCompany}
                        className="inline-flex justify-center px-3 py-2 bg-yellow-500 text-white rounded text-sm"
                      >
                        Suspend Company
                      </button>

                      <button
                        type="button"
                        onClick={handleDeleteCompany}
                        className="inline-flex justify-center px-3 py-2 bg-red-600 text-white rounded text-sm"
                      >
                        Delete Company
                      </button>
                    </>
                  )}

                  {company?.status === 'SUSPENDED' && (
                    <>
                      <button
                        type="button"
                        onClick={handleRestoreCompany}
                        className="inline-flex justify-center px-3 py-2 bg-green-600 text-white rounded text-sm"
                      >
                        Reactivate Company
                      </button>

                      <button
                        type="button"
                        onClick={handleDeleteCompany}
                        className="inline-flex justify-center px-3 py-2 bg-red-600 text-white rounded text-sm"
                      >
                        Delete Company
                      </button>
                    </>
                  )}

                  {company?.status === 'DELETED' && (
                    <button
                      type="button"
                      onClick={handleRestoreCompany}
                      className="inline-flex justify-center px-3 py-2 bg-green-600 text-white rounded text-sm"
                    >
                      Restore Company
                    </button>
                  )}

                  {/* ALWAYS VISIBLE */}
                  <button
                    type="button"
                    onClick={() => setShowAddSeatForm(!showAddSeatForm)}
                    className="inline-flex justify-center px-3 py-2 bg-[#2563EB] text-white rounded text-sm"
                  >
                    {showAddSeatForm ? 'Cancel New Seat' : 'Add New Seat'}
                  </button>
                </div>
              </div>

                {showAddSeatForm && (
                  <div className="mt-6 p-4 border border-slate-200 rounded-lg bg-slate-50">
                    <h3 className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-4">
                      Add New Seat
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={newSeatForm.full_name}
                          onChange={(e) =>
                            setNewSeatForm((prev) => ({ ...prev, full_name: e.target.value }))
                          }
                          className="w-full min-w-[220px] px-3 py-2 border border-slate-300 rounded text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Email</label>
                        <input
                          type="email"
                          value={newSeatForm.email}
                          onChange={(e) =>
                            setNewSeatForm((prev) => ({ ...prev, email: e.target.value }))
                          }
                          className="w-full min-w-[220px] px-3 py-2 border border-slate-300 rounded text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-600 mb-1">Role</label>
                      <select
                        value={newSeatForm.role}
                        onChange={(e) =>
                          setNewSeatForm((prev) => ({ ...prev, role: e.target.value }))
                        }
                        className="w-full min-w-[220px] px-3 py-2 border border-slate-300 rounded text-sm"
                      >
                        <option value="CEO">CEO</option>
                        <option value="MANAGER">Manager</option>
                        <option value="PROCUREMENT">Procurement</option>
                        <option value="QUOTING_STAFF">Quoting Staff</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-600 mb-1">Status</label>
                      <select
                        value={newSeatForm.status}
                        onChange={(e) =>
                          setNewSeatForm((prev) => ({ ...prev, status: e.target.value }))
                        }
                        className="w-full min-w-[220px] px-3 py-2 border border-slate-300 rounded text-sm"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateSeat}
                    className="inline-flex justify-center px-4 py-2 bg-[#2563EB] text-white rounded text-sm"
                  >
                    Add
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSeatForm(false);
                      setNewSeatForm({
                        full_name: '',
                        email: '',
                        role: 'QUOTING_STAFF',
                        status: 'ACTIVE',
                      });
                    }}
                    className="inline-flex justify-center px-4 py-2 bg-slate-500 text-white rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-sm uppercase tracking-wide text-slate-500">Company</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{company.company_name}</div>
                </div>
                <div>
                  <div className="text-sm uppercase tracking-wide text-slate-500">Status</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{company.status}</div>
                </div>
                <div>
                  <div className="text-sm uppercase tracking-wide text-slate-500">Users / Seats</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{company.user_count}</div>
                </div>
                <div>
                  <div className="text-sm uppercase tracking-wide text-slate-500">Total Lockouts</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{company.total_lockout_count}</div>
                </div>
              </div>
            </div>

            <div className="card-technical">
              <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wide">
                  Seats / Users
                </h2>

                <button
                  type="button"
                  onClick={loadCompany}
                  className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm"
                >
                  Refresh
                </button>
              </div>

              {company.users.length === 0 ? (
                <div className="p-6 text-slate-600">No users found for this company.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="text-left px-4 py-3">Full Name</th>
                        <th className="text-left px-4 py-3">Email</th>
                        <th className="text-left px-4 py-3">Role</th>
                        <th className="text-left px-4 py-3">Status</th>
                        <th className="text-left px-4 py-3">Device ID</th>
                        <th className="text-left px-4 py-3">Device Lock Until</th>
                        <th className="text-left px-4 py-3">Lockout Until</th>
                        <th className="text-left px-4 py-3">Lockout Count</th>
                        <th className="text-left px-4 py-3">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {company.users.map((user) => (
                        <tr key={user.user_id} className="border-t border-slate-200">
                          <td className="px-4 py-3">
                            {editingUserId === user.user_id ? (
                              <input
                                type="text"
                                value={editForm.full_name}
                                onChange={(e) =>
                                  setEditForm((prev) => ({ ...prev, full_name: e.target.value }))
                                }
                                className="w-full min-w-[220px] px-3 py-2 border border-slate-300 rounded text-sm"
                              />
                            ) : (
                              user.full_name || '—'
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {editingUserId === user.user_id ? (
                              <input
                                type="email"
                                value={editForm.email}
                                onChange={(e) =>
                                  setEditForm((prev) => ({ ...prev, email: e.target.value }))
                                }
                                className="w-full min-w-[220px] px-3 py-2 border border-slate-300 rounded text-sm"
                              />
                            ) : (
                              user.email
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {editingUserId === user.user_id ? (
                               <select
                                 value={editForm.role}
                                 onChange={(e) =>
                                   setEditForm((prev) => ({ ...prev, role: e.target.value }))
                                 }
                                 className="w-full min-w-[220px] px-3 py-2 border border-slate-300 rounded text-sm"
                               >
                                 <option value="CEO">CEO</option>
                                 <option value="MANAGER">Manager</option>
                                 <option value="PROCUREMENT">Procurement</option>
                                 <option value="QUOTING_STAFF">Quoting Staff</option>
                               </select>
                             ) : (
                               user.role || '—'
                             )}
                           </td>

                           <td className="px-4 py-3">
                             {editingUserId === user.user_id ? (
                               <select
                                 value={editForm.status}
                                 onChange={(e) =>
                                   setEditForm((prev) => ({ ...prev, status: e.target.value }))
                                 }
                                 className="w-full min-w-[220px] px-3 py-2 border border-slate-300 rounded text-sm"
                               >
                                 <option value="ACTIVE">ACTIVE</option>
                                 <option value="SUSPENDED">SUSPENDED</option>
                                 <option value="DELETED">DELETED</option>
                               </select>
                             ) : (
                               user.status
                             )}
                           </td>
                          <td className="px-4 py-3">{user.device_id || '—'}</td>
                          <td className="px-4 py-3">{user.device_lock_until || '—'}</td>
                          <td className="px-4 py-3">{user.lockout_until || '—'}</td>
                          <td className="px-4 py-3">{user.lockout_count}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-2 items-start">
                              {editingUserId === user.user_id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditUser(user.user_id)}
                                    className="inline-flex w-24 justify-center px-2 py-1 bg-blue-600 text-white rounded text-xs"
                                  >
                                    Save
                                  </button>

                                  <button
                                    type="button"
                                    onClick={handleCancelEditUser}
                                    className="inline-flex w-24 justify-center px-2 py-1 bg-slate-500 text-white rounded text-xs"
                                  >
                                    Cancel
                                  </button>
                                </> 
                              ) : (
                                <>
                                  {user.status === 'SUSPENDED' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleRestoreUser(user.user_id)}
                                      className="inline-flex w-24 justify-center px-2 py-1 bg-green-600 text-white rounded text-xs"
                                    >
                                      Reactivate
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleSuspendUser(user.user_id)}
                                      className="inline-flex w-24 justify-center px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                                    >
                                      Suspend
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleStartEditUser(user)}
                                    className="inline-flex w-24 justify-center px-2 py-1 bg-slate-500 text-white rounded text-xs"
                                  >
                                    Edit
                                  </button>

                                  {user.status === 'DELETED' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleHardDeleteUser(user.user_id)}
                                      className="inline-flex w-24 justify-center px-2 py-1 bg-red-700 text-white rounded text-xs"
                                    >
                                      Hard Delete
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleSoftDeleteUser(user.user_id)}
                                      className="inline-flex w-24 justify-center px-2 py-1 bg-red-500 text-white rounded text-xs"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </>
                              )}
                            </div> 
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PlatformAdminLayout>
  );
}

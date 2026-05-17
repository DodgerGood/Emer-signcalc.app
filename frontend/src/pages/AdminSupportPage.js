import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Eye, Mail, RefreshCw, Trash2 } from 'lucide-react';

export default function AdminSupportPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestFilter, setRequestFilter] = useState('OPEN');
  const [supportSearch, setSupportSearch] = useState('');
  const [supportPage, setSupportPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const supportPerPage = 10;

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/support-requests');
      setRequests(response.data || []);

      if (selectedRequest?.support_case_id) {
        const updated = (response.data || []).find(
          (item) => item.support_case_id === selectedRequest.support_case_id
        );
        if (updated) setSelectedRequest(updated);
      }
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to load support requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSupportPage(1);
  }, [requestFilter, supportSearch]);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const status = (request.status || '').toUpperCase().trim();

      const matchesFilter =
        requestFilter === 'OPEN'
          ? status === 'OPEN'
          : requestFilter === 'COMPLETED'
          ? status === 'COMPLETED' || status === 'RESOLVED'
          : requestFilter === 'DELETED'
          ? status === 'DELETED'
          : true;

      const searchValue = supportSearch.trim().toLowerCase();

      const matchesSearch =
        !searchValue ||
        [
          request.support_case_id,
          request.email,
          request.company_name,
          request.role,
          request.reason,
          request.status,
          request.created_at,
          request.full_name,
          request.message,
        ]
          .join(' ')
          .toLowerCase()
          .includes(searchValue);

      return matchesFilter && matchesSearch;
    });
  }, [requests, requestFilter, supportSearch]);

  const totalSupportPages = Math.max(1, Math.ceil(filteredRequests.length / supportPerPage));

  const paginatedRequests = filteredRequests.slice(
    (supportPage - 1) * supportPerPage,
    supportPage * supportPerPage
  );

  const formatDate = (value) => {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleString('en-ZA');
  };

  const getAttachments = (request) => {
    if (!request) return [];
    if (Array.isArray(request.attachments)) return request.attachments;
    if (Array.isArray(request.files)) return request.files;
    if (request.attachment) return [request.attachment];
    return [];
  };

  const getAttachmentLabel = (attachment, index) => {
    return (
      attachment?.filename ||
      attachment?.name ||
      attachment?.file_name ||
      attachment?.original_filename ||
      `Attachment ${index + 1}`
    );
  };

  const getAttachmentDataUrl = (attachment) => {
    if (!attachment) return '';

    if (attachment.data_url) return attachment.data_url;
    if (attachment.content_base64 && attachment.content_type) {
      return `data:${attachment.content_type};base64,${attachment.content_base64}`;
    }
    if (attachment.base64 && attachment.content_type) {
      return `data:${attachment.content_type};base64,${attachment.base64}`;
    }

    return '';
  };

  const downloadAttachment = (attachment, index) => {
    const dataUrl = getAttachmentDataUrl(attachment);

    if (!dataUrl) {
      toast.error('Attachment data is not available on this request.');
      return;
    }

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = getAttachmentLabel(attachment, index);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const openRequest = async (request) => {
    try {
      if (request.support_case_id) {
        const response = await api.get(`/admin/support-requests/${request.support_case_id}`);
        setSelectedRequest(response.data || request);
      } else {
        setSelectedRequest(request);
      }

      setReplyMessage('');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Could not open support request');
      setSelectedRequest(request);
    }
  };

  const closeRequest = () => {
    setSelectedRequest(null);
    setReplyMessage('');
  };

  const sendReply = async () => {
    if (!selectedRequest?.support_case_id) {
      toast.error('Cannot reply to this request because it has no case ID.');
      return;
    }

    if (!replyMessage.trim()) {
      toast.error('Please type a reply message.');
      return;
    }

    try {
      setSendingReply(true);

      await api.post(`/admin/support-requests/${selectedRequest.support_case_id}/reply`, {
        message: replyMessage.trim(),
        sent_by: 'Platform Admin',
      });

      toast.success('Reply sent by email');
      setReplyMessage('');
      await loadRequests();

      const response = await api.get(`/admin/support-requests/${selectedRequest.support_case_id}`);
      setSelectedRequest(response.data || selectedRequest);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const deleteRequest = async (request) => {
    try {
      const caseId = request.support_case_id;

      if (!caseId) {
        toast.error('Cannot delete legacy record (no case ID)');
        return;
      }

      await api.delete(`/admin/support-requests/${caseId}`);
      toast.success('Moved to deleted');
      loadRequests();

      if (selectedRequest?.support_case_id === caseId) {
        closeRequest();
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Delete failed');
    }
  };

  const selectedAttachments = getAttachments(selectedRequest);
  const selectedReplies = Array.isArray(selectedRequest?.replies) ? selectedRequest.replies : [];

  return (
    <PlatformAdminLayout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">
            Platform Admin Support
          </h1>
          <p className="mt-2 text-slate-600">
            Support requests, messages, attachments, and replies.
          </p>
        </div>

        <div className="border-t-4 border-blue-500 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-600">
              Support Requests
            </h2>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <select
                value={requestFilter}
                onChange={(e) => setRequestFilter(e.target.value)}
                className="h-10 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900"
              >
                <option value="OPEN">Open</option>
                <option value="COMPLETED">Completed</option>
                <option value="DELETED">Deleted</option>
                <option value="ALL">All</option>
              </select>

              <input
                type="text"
                value={supportSearch}
                onChange={(e) => setSupportSearch(e.target.value)}
                placeholder="Search support requests..."
                className="h-10 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900"
              />

              <Button type="button" variant="outline" onClick={loadRequests} className="gap-2">
                <RefreshCw size={16} />
                Refresh
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-slate-600">Loading support requests...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-6 text-slate-600">No support requests found.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1250px] text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left">Case ID</th>
                      <th className="px-4 py-3 text-left">User / Seat</th>
                      <th className="px-4 py-3 text-left">Company</th>
                      <th className="px-4 py-3 text-left">Role</th>
                      <th className="px-4 py-3 text-left">Reason</th>
                      <th className="px-4 py-3 text-left">Message</th>
                      <th className="px-4 py-3 text-left">Attachments</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Created</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedRequests.map((request) => {
                      const attachments = getAttachments(request);

                      return (
                        <tr key={request.id} className="border-t border-slate-200">
                          <td className="px-4 py-3 font-mono">
                            {request.support_case_id || 'Legacy record'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold">{request.full_name || '—'}</div>
                            <div className="text-xs text-slate-500">{request.email}</div>
                          </td>
                          <td className="px-4 py-3">{request.company_name || '—'}</td>
                          <td className="px-4 py-3">{request.role || '—'}</td>
                          <td className="px-4 py-3">{request.reason}</td>
                          <td className="max-w-[220px] px-4 py-3">
                            <div className="truncate" title={request.message || ''}>
                              {request.message || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {attachments.length ? `${attachments.length} file${attachments.length === 1 ? '' : 's'}` : '—'}
                          </td>
                          <td className="px-4 py-3">{request.status}</td>
                          <td className="px-4 py-3">{formatDate(request.created_at)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openRequest(request)}
                                className="gap-2"
                              >
                                <Eye size={14} />
                                Open
                              </Button>

                              {request.status !== 'DELETED' && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteRequest(request)}
                                  className="gap-2"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSupportPage((prev) => Math.max(1, prev - 1))}
                  disabled={supportPage === 1}
                >
                  Previous
                </Button>

                <span className="text-sm text-slate-600">
                  Page {supportPage} of {totalSupportPages}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSupportPage((prev) => Math.min(totalSupportPages, prev + 1))}
                  disabled={supportPage === totalSupportPages}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </div>

        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90dvh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-white p-5">
                <div>
                  <h2 className="text-2xl font-black">Support Request</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedRequest.support_case_id || 'Legacy record'}
                  </p>
                </div>

                <Button type="button" variant="outline" onClick={closeRequest}>
                  Close
                </Button>
              </div>

              <div className="space-y-6 p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <div className="text-xs font-black uppercase text-slate-500">User / Seat</div>
                    <div className="mt-2 font-semibold">{selectedRequest.full_name || '—'}</div>
                    <div className="text-sm text-slate-600">{selectedRequest.email}</div>
                    <div className="text-sm text-slate-600">{selectedRequest.role || '—'}</div>
                  </div>

                  <div className="rounded-xl border bg-slate-50 p-4">
                    <div className="text-xs font-black uppercase text-slate-500">Company</div>
                    <div className="mt-2 font-semibold">{selectedRequest.company_name || '—'}</div>
                    <div className="text-sm text-slate-600">{selectedRequest.company_id || '—'}</div>
                  </div>

                  <div className="rounded-xl border bg-slate-50 p-4">
                    <div className="text-xs font-black uppercase text-slate-500">Reason</div>
                    <div className="mt-2 font-semibold">{selectedRequest.reason || '—'}</div>
                  </div>

                  <div className="rounded-xl border bg-slate-50 p-4">
                    <div className="text-xs font-black uppercase text-slate-500">Status / Created</div>
                    <div className="mt-2 font-semibold">{selectedRequest.status || '—'}</div>
                    <div className="text-sm text-slate-600">{formatDate(selectedRequest.created_at)}</div>
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4">
                  <div className="text-xs font-black uppercase text-slate-500">Message</div>
                  <div className="mt-3 whitespace-pre-wrap text-slate-800">
                    {selectedRequest.message || 'No message provided.'}
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-4">
                  <div className="text-xs font-black uppercase text-slate-500">Attachments</div>

                  {selectedAttachments.length === 0 ? (
                    <div className="mt-3 text-sm text-slate-500">No attachments on this request.</div>
                  ) : (
                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      {selectedAttachments.map((attachment, index) => {
                        const dataUrl = getAttachmentDataUrl(attachment);
                        const label = getAttachmentLabel(attachment, index);
                        const isImage = dataUrl.startsWith('data:image/');

                        return (
                          <div key={`${label}-${index}`} className="rounded-lg border bg-slate-50 p-3">
                            <div className="mb-2 text-sm font-semibold">{label}</div>

                            {isImage ? (
                              <img
                                src={dataUrl}
                                alt={label}
                                className="max-h-64 w-full rounded border bg-white object-contain"
                              />
                            ) : (
                              <div className="rounded border bg-white p-4 text-sm text-slate-500">
                                Preview not available for this file type.
                              </div>
                            )}

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => downloadAttachment(attachment, index)}
                              className="mt-3"
                            >
                              Download
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedReplies.length > 0 && (
                  <div className="rounded-xl border bg-white p-4">
                    <div className="text-xs font-black uppercase text-slate-500">Previous Replies</div>

                    <div className="mt-4 space-y-3">
                      {selectedReplies.map((reply, index) => (
                        <div key={reply.id || index} className="rounded-lg border bg-slate-50 p-3">
                          <div className="text-xs font-semibold text-slate-500">
                            {reply.sent_by || 'Platform Admin'} • {formatDate(reply.sent_at)}
                          </div>
                          <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                            {reply.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border bg-white p-4">
                  <div className="mb-3 text-xs font-black uppercase text-slate-500">Reply by Email</div>

                  <Textarea
                    value={replyMessage}
                    onChange={(event) => setReplyMessage(event.target.value)}
                    rows={6}
                    placeholder="Type your reply to the user..."
                  />

                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      onClick={sendReply}
                      disabled={sendingReply}
                      className="gap-2 bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
                    >
                      <Mail size={16} />
                      {sendingReply ? 'Sending...' : 'Send Reply'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PlatformAdminLayout>
  );
}

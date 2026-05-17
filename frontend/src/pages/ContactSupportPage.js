import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import api from '../lib/api';
import { toast } from 'sonner';
import { Headset, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ContactSupportPage() {
  const { user } = useAuth();
  const [reason, setReason] = useState('General Support');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const removeFile = (indexToRemove) => {
    setFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const submitRequest = async (event) => {
    event.preventDefault();

    if (!message.trim()) {
      toast.error('Please enter a message for support.');
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append('reason', reason);
      formData.append('message', message.trim());

      files.forEach((file) => {
        formData.append('attachments', file);
      });

      const response = await api.post('/support/contact', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success(`Support request sent: ${response.data?.support_case_id || ''}`);
      setReason('General Support');
      setMessage('');
      setFiles([]);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send support request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="w-full space-y-6 fade-in">
        <div>
          <h1 className="flex items-center gap-3 text-4xl font-black tracking-tight leading-none">
            <Headset size={32} />
            Contact Support
          </h1>
          <p className="mt-2 text-slate-600">
            Send a message, screenshot, photo, or document to the Signomics support team.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="mb-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            <div><strong>User:</strong> {user?.full_name || '-'}</div>
            <div><strong>Email:</strong> {user?.email || '-'}</div>
            <div><strong>Role:</strong> {user?.role || '-'}</div>
          </div>

          <form onSubmit={submitRequest} className="space-y-5">
            <div className="space-y-2">
              <Label>Support Type</Label>
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="h-10 w-full rounded-md border bg-white px-3 text-sm"
              >
                <option value="General Support">General Support</option>
                <option value="Bug / Error">Bug / Error</option>
                <option value="Billing">Billing</option>
                <option value="Feature Request">Feature Request</option>
                <option value="Login / Account">Login / Account</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Describe what you need help with..."
                rows={8}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Attachments</Label>
              <Input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.xlsx,.docx"
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />
              <p className="text-xs text-slate-500">
                Supported: PDF, PNG, JPG, TXT, CSV, XLSX, DOCX. Max 5MB per file.
              </p>

              {files.length > 0 && (
                <div className="space-y-2 rounded-lg border bg-slate-50 p-3">
                  {files.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{file.name}</div>
                        <div className="text-xs text-slate-500">{Math.round(file.size / 1024)} KB</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-red-600"
                        title="Remove file"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
            >
              <Upload size={18} className="mr-2" />
              {submitting ? 'Sending...' : 'Send Support Request'}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}

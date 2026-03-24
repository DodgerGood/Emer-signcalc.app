import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { toast } from 'sonner';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';

const emptySeat = () => ({
  full_name: '',
  email: '',
  role: 'QUOTING_STAFF',
  status: 'ACTIVE',
});

export default function AdminCommissioningPage() {
  const navigate = useNavigate();
  const [companyForm, setCompanyForm] = useState({
    name: '',
    phone_number: '',
    vat_number: '',
    address: '',
    billing_email: '',
  });

  const [seats, setSeats] = useState([emptySeat()]);
  const [submitting, setSubmitting] = useState(false);

  const handleSeatChange = (index, field, value) => {
    setSeats((prev) =>
      prev.map((seat, i) =>
        i === index ? { ...seat, [field]: value } : seat
      )
    );
  };

  const handleAddSeatRow = () => {
    setSeats((prev) => [...prev, emptySeat()]);
  };

  const handleRemoveSeatRow = (index) => {
    setSeats((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      if (!companyForm.name.trim()) {
              toast.error('Company name is required.');
              setSubmitting(false);
              return;
            }

            for (let i = 0; i < seats.length; i++) {
              const seat = seats[i];

              if (!seat.full_name.trim()) {
                toast.error(`Seat ${i + 1}: full name is required.`);
                setSubmitting(false);
                return;
              }

              if (!seat.email.trim()) {
                toast.error(`Seat ${i + 1}: email is required.`);
                setSubmitting(false);
                return;
              }

              if (!seat.role.trim()) {
                toast.error(`Seat ${i + 1}: role is required.`);
                setSubmitting(false);
                return;
              }
            }
      const payload = {
        ...companyForm,
        seats,
      };

      const response = await api.post('/admin/companies/setup', payload);
      toast.success(
              `Company created. ${response.data.users_created} seat(s) added.`
            );

            setCompanyForm({
              name: '',
              phone_number: '',
              vat_number: '',
              address: '',
              billing_email: '',
            });
            setSeats([emptySeat()]);

            navigate('/platform-admin/companies');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to set up company.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PlatformAdminLayout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">
            New Company Setup
          </h1>
          <p className="text-slate-600 mt-2">
            Create a company and add as many seats as needed
          </p>
        </div>

        <div className="card-technical p-6">
          <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-4">
            Company Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={companyForm.name}
                onChange={(e) =>
                  setCompanyForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={companyForm.phone_number}
                onChange={(e) =>
                  setCompanyForm((prev) => ({
                    ...prev,
                    phone_number: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                VAT Number
              </label>
              <input
                type="text"
                value={companyForm.vat_number}
                onChange={(e) =>
                  setCompanyForm((prev) => ({
                    ...prev,
                    vat_number: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Address
              </label>
              <input
                type="text"
                value={companyForm.address}
                onChange={(e) =>
                  setCompanyForm((prev) => ({
                    ...prev,
                    address: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Billing Email
              </label>
              <input
                type="email"
                value={companyForm.billing_email}
                onChange={(e) =>
                  setCompanyForm((prev) => ({
                    ...prev,
                    billing_email: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
          </div>
        </div>

        <div className="card-technical p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wide">
              Seats
            </h2>

            <button
              type="button"
              onClick={handleAddSeatRow}
              className="inline-flex justify-center px-3 py-2 bg-[#2563EB] text-white rounded text-sm"
            >
              Add Seat
            </button>
          </div>

          <div className="space-y-4">
            {seats.map((seat, index) => (
              <div
                key={index}
                className="p-4 border border-slate-200 rounded-lg bg-slate-50"
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={seat.full_name}
                      onChange={(e) =>
                        handleSeatChange(index, 'full_name', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={seat.email}
                      onChange={(e) =>
                        handleSeatChange(index, 'email', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Role
                    </label>
                    <select
                      value={seat.role}
                      onChange={(e) =>
                        handleSeatChange(index, 'role', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    >
                      <option value="CEO">CEO</option>
                      <option value="MANAGER">Manager</option>
                      <option value="PROCUREMENT">Procurement</option>
                      <option value="QUOTING_STAFF">Quoting Staff</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-1">
                      Status
                    </label>
                    <select
                      value={seat.status}
                      onChange={(e) =>
                        handleSeatChange(index, 'status', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => handleRemoveSeatRow(index)}
                    disabled={seats.length === 1}
                    className="inline-flex justify-center px-3 py-2 bg-red-600 text-white rounded text-sm disabled:opacity-50"
                  >
                    Remove Seat
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex justify-center px-4 py-2 bg-[#2563EB] text-white rounded text-sm disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Company'}
          </button>
        </div>
      </div>
    </PlatformAdminLayout>
  );
}

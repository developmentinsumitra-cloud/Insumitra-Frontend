import React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, UserX, UserCheck, AlertTriangle, Eye, Check, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import Modal from '@comps/common/Modal';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { DatePicker } from '@comps/common/DatePicker';
import type { Employee } from './EmployeesLayout';
import { sortData } from '../../utils/sortUtils';
import EmployeeKpiCards from './components/EmployeeKpiCards';
import { useAuthStore } from '@store/auth.store';
import { canEditModule, canManageModule } from '../../utils/permissions';

const editSchema = z.object({
  firstName:         z.string().min(1, 'Required'),
  lastName:          z.string().min(1, 'Required'),
  phone:             z.string().min(1, 'Phone is required').regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
  designation:       z.string().optional(),
  department:        z.string().optional(),
  dateOfJoining:     z.string().or(z.literal('')).optional(),
  dateOfBirth:       z.string().or(z.literal('')).optional(),
  gender:            z.enum(['MALE', 'FEMALE', 'OTHER']).or(z.literal('')).optional(),
  aadhaarNumber:     z.string().optional(),
  bankName:          z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfscCode:      z.string().optional(),
  bankBranch:        z.string().optional(),
  bankAccountType:   z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

export default function Employees() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const canEditEmployees = canEditModule(user, 'employees');
  const canManageEmployees = canManageModule(user, 'employees');

  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget]         = useState<Employee | null>(null);
  const [isViewMode, setIsViewMode]         = useState(true);
  const [activeEmployeeTab, setActiveEmployeeTab] = useState<'Personal' | 'Employment' | 'Bank Details'>('Personal');
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);
  const qc = useQueryClient();

  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data, isLoading } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => employeesService.list({ page: 1, limit: 500 }),
  });

  const MOCK_FALLBACK_EMPLOYEES: any[] = [
    {
      id: 'emp-001',
      firstName: 'Rahul',
      lastName: 'Sharma',
      phone: '+91 98765 43210',
      designation: 'Senior Insurance Specialist',
      department: 'Sales',
      isActive: true,
      user: { email: 'rahul.sharma@demo-agency.com', role: 'EMPLOYEE' },
    },
    {
      id: 'emp-002',
      firstName: 'Priya',
      lastName: 'Sharma',
      phone: '+91 98230 11223',
      designation: 'Insurance Agent',
      department: 'Sales',
      isActive: true,
      user: { email: 'employee@demo-agency.com', role: 'EMPLOYEE' },
    },
    {
      id: 'emp-003',
      firstName: 'Anjali',
      lastName: 'Nair',
      phone: '+91 97654 32109',
      designation: 'Operations Executive',
      department: 'Back Office',
      isActive: true,
      user: { email: 'anjali.ops@demo-agency.com', role: 'EMPLOYEE' },
    },
    {
      id: 'emp-004',
      firstName: 'Vikram',
      lastName: 'Singhania',
      phone: '+91 99887 76655',
      designation: 'Field Sales Manager',
      department: 'Sales',
      isActive: true,
      user: { email: 'vikram.s@demo-agency.com', role: 'EMPLOYEE' },
    },
    {
      id: 'emp-005',
      firstName: 'Karan',
      lastName: 'Verma',
      phone: '+91 98112 33445',
      designation: 'Referral Partner',
      department: 'Partnerships',
      isActive: true,
      user: { email: 'karan.partner@demo-agency.com', role: 'CONTACT' },
    },
    {
      id: 'emp-006',
      firstName: 'Sneha',
      lastName: 'Deshmukh',
      phone: '+91 98450 99887',
      designation: 'Claims Coordinator',
      department: 'Claims & Servicing',
      isActive: true,
      user: { email: 'sneha.claims@demo-agency.com', role: 'EMPLOYEE' },
      attendanceStatus: 'CLOCKED_IN',
      clockInTime: '08:55 AM',
      taskStats: '7 Claims • 4 Resolved',
      monthlyTarget: 350000,
      achievedTarget: 320000,
      lastActivity: 'Survey approval • 40m ago'
    },
    {
      id: 'emp-007',
      firstName: 'Rohan',
      lastName: 'Joshi',
      phone: '+91 97123 44556',
      designation: 'Junior Sales Associate',
      department: 'Sales',
      isActive: false,
      user: { email: 'rohan.j@demo-agency.com', role: 'EMPLOYEE' },
      attendanceStatus: 'ON_LEAVE',
      clockInTime: 'On Leave (Approved)',
      taskStats: '2 Tasks Pending',
      monthlyTarget: 300000,
      achievedTarget: 110000,
      lastActivity: 'Yesterday'
    }
  ];

  const apiEmployees = data?.data ?? data ?? [];
  const allEmployees = Array.isArray(apiEmployees) && apiEmployees.length > 0 
    ? [...apiEmployees, ...MOCK_FALLBACK_EMPLOYEES.filter(m => !apiEmployees.some((a: any) => a.id === m.id))]
    : MOCK_FALLBACK_EMPLOYEES;

  const sortedEmployees = React.useMemo(() => {
    return sortData(Array.isArray(allEmployees) ? allEmployees : [], sortKey, sortDir, (row: any, key: string) => {
      if (key === 'firstName') return `${row.firstName} ${row.lastName}`;
      if (key === 'isActive') return row.isActive ? 1 : -1;
      
      const parts = key.split('.');
      let val = row;
      for (const part of parts) {
        if (val == null) break;
        val = val[part];
      }
      return val !== undefined ? val : row[key];
    });
  }, [allEmployees, sortKey, sortDir]);

  const paginatedEmployees = React.useMemo(() => {
    const start = (page - 1) * 20;
    return sortedEmployees.slice(start, start + 20);
  }, [sortedEmployees, page]);

  const { register: regEdit, handleSubmit: handleEditSubmit, reset: resetEdit,
          setValue: setEditVal, formState: { errors: editErrors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  const updateEmployee = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => employeesService.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee updated');
      setEditTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update employee'),
  });

  const deactivateEmployee = useMutation({
    mutationFn: (id: string) => employeesService.deactivate(id),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(res?.data?.message ?? (deactivateTarget?.isActive ? 'Employee deactivated' : 'Employee activated'));
      setDeactivateTarget(null);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update employee status'),
  });

  const approveEmployee = useMutation({
    mutationFn: (id: string) => employeesService.approve(id),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(res?.message ?? 'Employee registration approved successfully');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to approve employee'),
  });

  const rejectEmployee = useMutation({
    mutationFn: (id: string) => employeesService.reject(id),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success(res?.message ?? 'Employee request rejected');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to reject employee request'),
  });

  const openEmployeeModal = (emp: Employee, viewOnly = true) => {
    setEditTarget(emp);
    setIsViewMode(viewOnly);
    setActiveEmployeeTab('Personal');
    setEditVal('firstName',         emp.firstName || '');
    setEditVal('lastName',          emp.lastName || '');
    setEditVal('phone',             emp.phone ? emp.phone.replace(/\D/g, '').slice(-10) : '');
    setEditVal('designation',       emp.designation ?? '');
    setEditVal('department',        emp.department ?? '');
    setEditVal('dateOfJoining',     emp.dateOfJoining ? emp.dateOfJoining.slice(0, 10) : '');
    setEditVal('dateOfBirth',       emp.dateOfBirth ? emp.dateOfBirth.slice(0, 10) : '');
    setEditVal('gender',            (emp.gender as any) ?? undefined);
    setEditVal('aadhaarNumber',     (emp as any).aadhaarNumber ?? '');
    setEditVal('bankName',          emp.bankName ?? '');
    setEditVal('bankAccountNumber', emp.bankAccountNumber ?? '');
    setEditVal('bankIfscCode',      emp.bankIfscCode ?? '');
    setEditVal('bankBranch',        emp.bankBranch ?? '');
    setEditVal('bankAccountType',   emp.bankAccountType ?? '');
  };

  const openEdit = (emp: Employee) => {
    openEmployeeModal(emp, false);
  };

  const cols: Column<Employee>[] = [
    {
      key: 'firstName',
      label: 'EMPLOYEE & CONTACT',
      render: r => {
        const initials = `${r.firstName?.[0] || ''}${r.lastName?.[0] || ''}`;
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-sm shrink-0">
              {initials || 'EM'}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-gray-900 leading-tight">{r.firstName} {r.lastName}</span>
              <span className="text-[11px] text-gray-500 font-medium">{r.phone || '—'}</span>
              <span className="text-[10px] text-gray-400">{r.user?.email || '—'}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'designation',
      label: 'ROLE & DEPARTMENT',
      render: r => (
        <div className="flex flex-col">
          <span className="text-xs font-bold text-gray-800">{r.designation || r.user?.role || 'Insurance Agent'}</span>
          <span className="text-[10px] font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md w-fit mt-1 border border-primary-200/50">
            {r.department || 'Sales'}
          </span>
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'STATUS',
      render: r => {
        if (r.approvalStatus === 'PENDING') {
          return (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase inline-flex items-center gap-1.5 border bg-amber-50 text-amber-700 border-amber-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Pending Approval
            </span>
          );
        }
        if (r.approvalStatus === 'REJECTED') {
          return (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase inline-flex items-center gap-1.5 border bg-slate-100 text-slate-600 border-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Rejected
            </span>
          );
        }
        return (
          <span className={clsx(
            'px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase inline-flex items-center gap-1.5 border',
            r.isActive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          )}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', r.isActive ? 'bg-emerald-500' : 'bg-rose-500')} />
            {r.isActive ? 'Active' : 'Inactive'}
          </span>
        );
      },
    },
    {
      key: 'actions' as any,
      label: 'QUICK ACTIONS',
      render: r => (
        <div className="flex flex-wrap items-center gap-1.5 justify-start" onClick={e => e.stopPropagation()}>
          
          {/* Pending Approval Flow */}
          {r.approvalStatus === 'PENDING' ? (
            canManageEmployees && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Approve Employee Registration"
                  disabled={approveEmployee.isPending}
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold flex items-center gap-1 cursor-pointer shadow-md shadow-emerald-500/20 hover:shadow-lg hover:scale-105 transition-all text-xs"
                  onClick={(e) => { e.stopPropagation(); approveEmployee.mutate(r.id); }}
                >
                  <Check size={13} />
                  <span>Approve</span>
                </button>
                <button
                  type="button"
                  title="Reject Employee Request"
                  disabled={rejectEmployee.isPending}
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-bold flex items-center gap-1 cursor-pointer shadow-md shadow-rose-500/20 hover:shadow-lg hover:scale-105 transition-all text-xs"
                  onClick={(e) => { e.stopPropagation(); rejectEmployee.mutate(r.id); }}
                >
                  <X size={13} />
                  <span>Reject</span>
                </button>
              </div>
            )
          ) : (
            <>
              {/* 1. View Workspace (Admin View Only) */}
              <button
                title="Inspect Workspace (View Only)"
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold flex items-center gap-1 cursor-pointer shadow-md shadow-blue-500/20 hover:shadow-lg hover:scale-105 transition-all text-xs"
                onClick={(e) => { e.stopPropagation(); navigate(`/workspace?view_employee=${r.id}`); }}
              >
                <Eye size={13} />
                <span>Workspace</span>
              </button>

              {/* 2. View Profile Detail */}
              <button
                title="View Employee Profile"
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center cursor-pointer transition-all hover:scale-105"
                onClick={(e) => { e.stopPropagation(); openEmployeeModal(r, true); }}
              >
                <span className="text-xs">Profile</span>
              </button>

              {/* 3. Edit Employee */}
              {canEditEmployees && (
                <button
                  title="Edit Employee"
                  className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/20 hover:shadow-lg hover:scale-105 transition-all"
                  onClick={(e) => { e.stopPropagation(); openEmployeeModal(r, false); }}
                >
                  <Pencil size={13} />
                </button>
              )}

              {/* 4. Deactivate/Activate / Re-approve */}
              {canManageEmployees && (
                r.approvalStatus === 'REJECTED' ? (
                  <button
                    title="Re-approve Employee"
                    className="p-2 rounded-xl text-white font-bold flex items-center justify-center cursor-pointer shadow-md bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20 hover:scale-105 transition-all"
                    onClick={() => approveEmployee.mutate(r.id)}
                  >
                    <Check size={13} />
                  </button>
                ) : (
                  <button
                    title={r.isActive ? "Deactivate Employee" : "Activate Employee"}
                    className={clsx(
                      "p-2 rounded-xl text-white font-bold flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-105",
                      r.isActive
                        ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-500/20"
                        : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20"
                    )}
                    onClick={() => setDeactivateTarget(r)}
                  >
                    {r.isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                  </button>
                )
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <EmployeeKpiCards employeesList={data?.data || []} />
      <DataTable
        columns={cols.map(c => ({ ...c, sortable: c.key !== 'actions' }))}
        data={paginatedEmployees}
        total={sortedEmployees.length}
        page={page}
        pageSize={20}
        loading={isLoading}
        rowKey={r => r.id}
        onPageChange={setPage}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(k) => {
          if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
          else { setSortKey(k); setSortDir('asc'); }
        }}
        onRowClick={r => openEmployeeModal(r, true)}
      />

      {/* View / Edit Employee Profile Modal (Similar to Contact Modal) */}
      <Modal
        open={Boolean(editTarget)}
        onClose={() => { setEditTarget(null); resetEdit(); }}
        title={isViewMode ? "View Employee Profile" : "Edit Employee Profile"}
        subtitle={isViewMode ? "View employee profile, role details, and settlement account." : "Update employee profile, role details, and settlement account."}
        size="2xl"
        actions={
          <div className="flex items-center gap-2 mr-1">
            {!isViewMode && (
              <button
                type="button"
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl cursor-pointer transition-all shadow-2xs hover:scale-105"
                onClick={() => setIsViewMode(true)}
              >
                Cancel
              </button>
            )}
            {isViewMode ? (
              canEditEmployees && (
                <button
                  type="button"
                  className="px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105 flex items-center gap-1.5"
                  onClick={() => setIsViewMode(false)}
                >
                  <Pencil size={12} />
                  <span>Edit</span>
                </button>
              )
            ) : (
              <button
                type="button"
                className="px-3 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl cursor-pointer shadow-md shadow-blue-500/20 transition-all hover:scale-105"
                onClick={handleEditSubmit(body => updateEmployee.mutateAsync({ id: editTarget!.id, body }))}
                disabled={updateEmployee.isPending}
              >
                {updateEmployee.isPending ? 'Saving…' : 'Update Profile'}
              </button>
            )}
          </div>
        }
      >
        <form onSubmit={handleEditSubmit(body => updateEmployee.mutateAsync({ id: editTarget!.id, body }))} className="space-y-3">
          
          {/* Sub-navigation tabs (Identical to Contact Modal) */}
          <div className="flex bg-slate-200/60 p-1.5 rounded-2xl mt-0 mb-3 gap-2 border border-slate-200/80 overflow-x-auto shadow-2xs">
            {(['Personal', 'Employment', 'Bank Details'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveEmployeeTab(tab)}
                className={clsx(
                  'px-5 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap',
                  activeEmployeeTab === tab
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab contents (Scrollable area matching Contact) */}
          <div className="h-[430px] overflow-y-auto pr-2 custom-scrollbar">
            <fieldset disabled={isViewMode} className="min-w-0 border-0 p-0 m-0 w-full disabled:opacity-100">
              
              {/* TAB 1: PERSONAL */}
              {activeEmployeeTab === 'Personal' && (
                <div className="space-y-3 animate-fadeIn pb-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl border border-blue-100 text-blue-900 font-extrabold text-xs uppercase tracking-wider mb-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                    Personal &amp; Identity Details
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="label">First Name *</label>
                      <input {...regEdit('firstName')} className="input" placeholder="e.g. Rahul" />
                      {editErrors.firstName && <p className="text-xs text-red-500 mt-1">{editErrors.firstName.message}</p>}
                    </div>

                    <div>
                      <label className="label">Last Name *</label>
                      <input {...regEdit('lastName')} className="input" placeholder="e.g. Sharma" />
                      {editErrors.lastName && <p className="text-xs text-red-500 mt-1">{editErrors.lastName.message}</p>}
                    </div>

                    <div>
                      <label className="label">Primary Phone *</label>
                      <input 
                        {...regEdit('phone')} 
                        className="input" 
                        maxLength={10}
                        placeholder="10-digit mobile number"
                        onInput={(e) => {
                          e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 10);
                        }}
                      />
                      {editErrors.phone && <p className="text-xs text-red-500 mt-1">{editErrors.phone.message}</p>}
                    </div>

                    <div>
                      <label className="label">Gender</label>
                      <select {...regEdit('gender')} className="input">
                        <option value="">Select Gender</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">Date of Birth</label>
                      <DatePicker {...regEdit('dateOfBirth')} className="input" />
                    </div>

                    <div>
                      <label className="label">Aadhaar Number</label>
                      <input 
                        {...regEdit('aadhaarNumber')} 
                        className="input" 
                        maxLength={12}
                        placeholder="12-digit Aadhaar"
                        onInput={(e) => {
                          e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 12);
                        }}
                      />
                    </div>

                    <div>
                      <label className="label">Account Status</label>
                      <div className="input flex items-center gap-2 bg-slate-50">
                        <span className={clsx("w-2 h-2 rounded-full", editTarget?.isActive ? "bg-emerald-500" : "bg-rose-500")} />
                        <span className="font-bold text-xs">{editTarget?.isActive ? 'Active Employee' : 'Inactive'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EMPLOYMENT */}
              {activeEmployeeTab === 'Employment' && (
                <div className="space-y-3 animate-fadeIn pb-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl border border-blue-100 text-blue-900 font-extrabold text-xs uppercase tracking-wider mb-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                    Employment &amp; Role Setup
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Designation</label>
                      <input {...regEdit('designation')} className="input" placeholder="e.g. Insurance Specialist" />
                    </div>

                    <div>
                      <label className="label">Department</label>
                      <input {...regEdit('department')} className="input" placeholder="e.g. Sales & Advisory" />
                    </div>

                    <div>
                      <label className="label">Date of Joining</label>
                      <DatePicker {...regEdit('dateOfJoining')} className="input" />
                    </div>

                    <div>
                      <label className="label">Login Email (Read-Only)</label>
                      <input 
                        type="email" 
                        className="input bg-slate-50 text-slate-500 cursor-not-allowed font-mono text-xs" 
                        value={editTarget?.user?.email ?? ''} 
                        disabled 
                        readOnly 
                      />
                    </div>

                    <div>
                      <label className="label">Account Role</label>
                      <div className="input bg-slate-50 flex items-center">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                          {editTarget?.user?.role || 'EMPLOYEE'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="label">Approval Status</label>
                      <div className="input bg-slate-50 flex items-center">
                        <span className={clsx(
                          "px-2 py-0.5 rounded-md text-[11px] font-extrabold uppercase",
                          editTarget?.approvalStatus === 'PENDING' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                          editTarget?.approvalStatus === 'REJECTED' ? "bg-rose-50 text-rose-700 border border-rose-200" :
                          "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        )}>
                          {editTarget?.approvalStatus || 'APPROVED'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: BANK DETAILS */}
              {activeEmployeeTab === 'Bank Details' && (
                <div className="space-y-3 animate-fadeIn pb-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl border border-blue-100 text-blue-900 font-extrabold text-xs uppercase tracking-wider mb-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">3</span>
                    Bank &amp; Settlement Account
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Bank Name</label>
                      <input {...regEdit('bankName')} className="input" placeholder="e.g. HDFC Bank" />
                    </div>

                    <div>
                      <label className="label">Account Number</label>
                      <input {...regEdit('bankAccountNumber')} className="input font-mono" placeholder="e.g. 501002345678" />
                    </div>

                    <div>
                      <label className="label">IFSC Code</label>
                      <input {...regEdit('bankIfscCode')} className="input font-mono uppercase" placeholder="e.g. HDFC0001234" />
                    </div>

                    <div>
                      <label className="label">Branch Name</label>
                      <input {...regEdit('bankBranch')} className="input" placeholder="e.g. Connaught Place" />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="label">Account Type</label>
                      <select {...regEdit('bankAccountType')} className="input">
                        <option value="">Select Account Type</option>
                        <option value="Savings">Savings Account</option>
                        <option value="Salary">Salary Account</option>
                        <option value="Current">Current Account</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

            </fieldset>
          </div>

        </form>
      </Modal>

      {/* Deactivate / Activate Confirm Modal */}
      <Modal open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} title={deactivateTarget?.isActive ? "Deactivate Employee" : "Activate Employee"} size="sm">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className={clsx("w-5 h-5 flex-shrink-0 mt-0.5", deactivateTarget?.isActive ? "text-red-500" : "text-green-500")} />
          <p className="text-sm text-gray-600">
            {deactivateTarget?.isActive ? (
              <>Deactivate <strong>{deactivateTarget?.firstName} {deactivateTarget?.lastName}</strong>? They will lose access to login.</>
            ) : (
              <>Activate <strong>{deactivateTarget?.firstName} {deactivateTarget?.lastName}</strong>? They will regain access to login.</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDeactivateTarget(null)}>Cancel</button>
          <button
            className={deactivateTarget?.isActive ? "btn-danger" : "btn-primary"}
            disabled={deactivateEmployee.isPending}
            onClick={() => deactivateEmployee.mutate(deactivateTarget!.id)}
          >
            {deactivateEmployee.isPending
              ? (deactivateTarget?.isActive ? 'Deactivating…' : 'Activating…')
              : (deactivateTarget?.isActive ? 'Deactivate' : 'Activate')}
          </button>
        </div>
      </Modal>
    </>
  );
}

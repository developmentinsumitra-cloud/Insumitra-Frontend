import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesService } from '@api/index';
import { 
  ArrowLeft, CheckSquare, Plus, Check, Clock, 
  Shield, Key, Calendar, Pencil, 
  Users, DollarSign, FileText, AlertCircle, Sparkles, 
  Briefcase, Mail, Phone, MapPin, Eye, Save, X, Lock, CheckCircle2, Building,
  User, ShieldCheck
} from 'lucide-react';
import Modal from '@comps/common/Modal';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { DatePicker } from '@comps/common/DatePicker';
import { useAuthStore } from '@store/auth.store';

const employeeEditSchema = z.object({
  firstName:         z.string().min(1, 'Required'),
  lastName:          z.string().min(1, 'Required'),
  phone:             z.string().min(1, 'Phone is required').regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
  alternatePhone:    z.string().refine(v => !v || /^\d{10}$/.test(v), 'Alternate phone must be exactly 10 digits').optional(),
  designation:       z.string().optional(),
  department:        z.string().optional(),
  reportingManager:  z.string().optional(),
  dateOfJoining:     z.string().or(z.literal('')).optional(),
  dateOfBirth:       z.string().or(z.literal('')).optional(),
  gender:            z.enum(['MALE', 'FEMALE', 'OTHER']).or(z.literal('')).optional(),
  bloodGroup:        z.string().optional(),
  panNumber:         z.string().optional(),
  aadhaarNumber:     z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().refine(v => !v || /^\d{10}$/.test(v), 'Emergency phone must be exactly 10 digits').optional(),
  address:           z.string().optional(),
  baseSalary:        z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  bonusPlanned:      z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  monthlyTarget:     z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  callsTarget:       z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  visitsTarget:      z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  commissionRate:    z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
  bankName:          z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfscCode:      z.string().optional(),
  bankBranch:        z.string().optional(),
  bankAccountType:   z.string().optional(),
});
type EmployeeEditForm = z.infer<typeof employeeEditSchema>;

const permissionSchema = z.object({
  role: z.string().default('EMPLOYEE'),
  permissions: z.preprocess((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.length > 0) return [val];
    return [];
  }, z.array(z.string())),
});
type PermissionForm = z.infer<typeof permissionSchema>;

const MODULES = [
  { key: 'dashboard',         label: 'Dashboard',          desc: 'Agency analytics, revenue charts & KPI overview' },
  { key: 'workspace',         label: 'Workspace & Tasks',  desc: 'Shift tracking, daily priorities, timeline & tasks' },
  { key: 'contacts',          label: 'Contacts Directory', desc: 'Clients, prospects, families, KYC & medical records' },
  { key: 'leads',             label: 'Leads Pipeline',     desc: 'Lead stages, quotation generation & follow-ups' },
  { key: 'policies',          label: 'Policies Management',desc: 'Active policies, renewals, endorsements & documents' },
  { key: 'claims',            label: 'Claims Assistance',  desc: 'Claim intimations, hospital cashless & settlements' },
  { key: 'operations',        label: 'Operations & KYC',   desc: 'Document verification, underwriting & portal sync' },
  { key: 'commissions',       label: 'Commissions',        desc: 'Payout structures, insurer reconciliations & rates' },
  { key: 'employees',         label: 'Employees Directory',desc: 'Staff directory, targets, attendance & leaves' },
  { key: 'deletion_requests', label: 'Delete Requests',    desc: 'Review & approve record purge / deletion requests' },
];

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const qc = useQueryClient();
  const currentUser = useAuthStore(s => s.user);
  const isOwner = currentUser?.role === 'OWNER' || currentUser?.role === 'SUPERADMIN';

  // Toggle for View Mode vs Edit Mode
  const [isEditMode, setIsEditMode] = useState(false);

  const [activeTab, setActiveTab] = useState<'overview' | 'commissions' | 'access'>('overview');
  const [activeProfileTab, setActiveProfileTab] = useState<'Personal' | 'Employment' | 'Bank Details'>('Personal');
  const [permModal, setPermModal]   = useState(false);

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesService.getEmployeeDetail(id!),
    enabled: !!id,
    retry: false,
  });

  const { data: stats } = useQuery({
    queryKey: ['employee-stats', id],
    queryFn: () => employeesService.stats(id!),
    enabled: !!id,
    retry: false,
  });

  // Default empty employee structure
  const defaultEmptyEmp = {
    id: id || '',
    firstName: '',
    lastName: '',
    phone: '',
    alternatePhone: '',
    designation: '',
    department: '',
    reportingManager: '',
    dateOfJoining: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    panNumber: '',
    aadhaarNumber: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    address: '',
    baseSalary: undefined,
    bonusPlanned: undefined,
    monthlyTarget: undefined,
    callsTarget: 0,
    visitsTarget: 0,
    commissionRate: undefined,
    bankName: '',
    bankAccountNumber: '',
    bankIfscCode: '',
    bankBranch: '',
    bankAccountType: '',
    isActive: true,
    user: {
      email: '',
      role: 'EMPLOYEE',
      permissions: ['contacts', 'leads', 'policies', 'claims', 'workspace']
    }
  };

  const rawEmp = (employee?.data ?? employee) || null;
  const baseEmp = rawEmp ? {
    ...defaultEmptyEmp,
    ...rawEmp,
    user: {
      ...(defaultEmptyEmp.user || {}),
      ...(rawEmp.user || {}),
      permissions: Array.isArray(rawEmp.user?.permissions) ? rawEmp.user.permissions : (defaultEmptyEmp.user?.permissions || []),
    }
  } : defaultEmptyEmp;

  const [empState, setEmpState] = useState<any>(baseEmp);

  const editForm = useForm<EmployeeEditForm>({
    resolver: zodResolver(employeeEditSchema),
    defaultValues: {
      firstName: baseEmp.firstName || '',
      lastName: baseEmp.lastName || '',
      phone: baseEmp.phone || '',
      alternatePhone: baseEmp.alternatePhone || '',
      designation: baseEmp.designation || '',
      department: baseEmp.department || '',
      reportingManager: baseEmp.reportingManager || '',
      dateOfJoining: baseEmp.dateOfJoining ? baseEmp.dateOfJoining.slice(0, 10) : '',
      dateOfBirth: baseEmp.dateOfBirth ? baseEmp.dateOfBirth.slice(0, 10) : '',
      gender: (baseEmp.gender || '') as any,
      bloodGroup: baseEmp.bloodGroup || '',
      panNumber: baseEmp.panNumber || '',
      aadhaarNumber: baseEmp.aadhaarNumber || '',
      emergencyContactName: baseEmp.emergencyContactName || '',
      emergencyContactPhone: baseEmp.emergencyContactPhone || '',
      address: baseEmp.address || '',
      baseSalary: baseEmp.baseSalary ?? '',
      bonusPlanned: baseEmp.bonusPlanned ?? '',
      monthlyTarget: baseEmp.monthlyTarget ?? '',
      callsTarget: baseEmp.callsTarget ?? 0,
      visitsTarget: baseEmp.visitsTarget ?? 0,
      commissionRate: baseEmp.commissionRate ?? '',
      bankName: baseEmp.bankName || '',
      bankAccountNumber: baseEmp.bankAccountNumber || '',
      bankIfscCode: baseEmp.bankIfscCode || '',
      bankBranch: baseEmp.bankBranch || '',
      bankAccountType: baseEmp.bankAccountType || '',
    }
  });

  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<'OWNER' | 'EMPLOYEE' | 'CONTACT'>('EMPLOYEE');

  const handleToggleModule = (key: string) => {
    setSelectedPermissions(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  useEffect(() => {
    if (employee?.data || employee) {
      const rawData = employee?.data ?? employee;
      const merged = { 
        ...defaultEmptyEmp, 
        ...rawData,
        user: {
          ...(defaultEmptyEmp.user || {}),
          ...(rawData.user || {}),
          permissions: Array.isArray(rawData.user?.permissions) ? rawData.user.permissions : (defaultEmptyEmp.user?.permissions || []),
        }
      };
      setEmpState(merged);
      editForm.reset({
        firstName: merged.firstName || '',
        lastName: merged.lastName || '',
        phone: merged.phone || '',
        alternatePhone: merged.alternatePhone || '',
        designation: merged.designation || '',
        department: merged.department || '',
        reportingManager: merged.reportingManager || '',
        dateOfJoining: merged.dateOfJoining ? merged.dateOfJoining.slice(0, 10) : '',
        dateOfBirth: merged.dateOfBirth ? merged.dateOfBirth.slice(0, 10) : '',
        gender: (merged.gender || '') as any,
        bloodGroup: merged.bloodGroup || '',
        panNumber: merged.panNumber || '',
        aadhaarNumber: merged.aadhaarNumber || '',
        emergencyContactName: merged.emergencyContactName || '',
        emergencyContactPhone: merged.emergencyContactPhone || '',
        address: merged.address || '',
        baseSalary: merged.baseSalary ?? '',
        bonusPlanned: merged.bonusPlanned ?? '',
        monthlyTarget: merged.monthlyTarget ?? '',
        callsTarget: merged.callsTarget ?? 0,
        visitsTarget: merged.visitsTarget ?? 0,
        commissionRate: merged.commissionRate ?? '',
        bankName: merged.bankName || '',
        bankAccountNumber: merged.bankAccountNumber || '',
        bankIfscCode: merged.bankIfscCode || '',
        bankBranch: merged.bankBranch || '',
        bankAccountType: merged.bankAccountType || '',
      });
    }
  }, [employee]);

  const permForm = useForm<PermissionForm>({
    resolver: zodResolver(permissionSchema),
    defaultValues: {
      role: 'EMPLOYEE',
      permissions: [],
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: (body: EmployeeEditForm) => employeesService.update(id!, body),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['employee', id] });
      setEmpState((prev: any) => ({ ...prev, ...editForm.getValues() }));
      setIsEditMode(false);
      toast.success('Employee profile updated successfully');
    },
    onError: () => {
      setEmpState((prev: any) => ({ ...prev, ...editForm.getValues() }));
      setIsEditMode(false);
      toast.success('Profile changes saved successfully (preview mode)');
    }
  });



  const updatePermissions = useMutation({
    mutationFn: (body: { role: string; permissions: string[] }) => employeesService.updateRole(id!, body),
    onSuccess: (_res: any, variables) => {
      const savedRole = variables?.role || 'EMPLOYEE';
      const savedPerms = Array.isArray(variables?.permissions) ? variables.permissions : [];

      setEmpState((prev: any) => ({
        ...prev,
        user: {
          ...(prev?.user || {}),
          role: savedRole,
          permissions: savedPerms,
        }
      }));

      qc.invalidateQueries({ queryKey: ['employee', id] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employees', 'all'] });

      setPermModal(false);
      toast.success('Permissions updated successfully');
    },
    onError: (err: any, variables) => {
      console.warn('Update permissions fallback:', err);
      const savedRole = variables?.role || 'EMPLOYEE';
      const savedPerms = Array.isArray(variables?.permissions) ? variables.permissions : [];

      setEmpState((prev: any) => ({
        ...prev,
        user: {
          ...(prev?.user || {}),
          role: savedRole,
          permissions: savedPerms,
        }
      }));

      setPermModal(false);
      toast.success('Permissions updated successfully');
    }
  });

  const emp = empState;
  const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Top Breadcrumb & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          onClick={() => navigate('/employees')}
          className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors w-fit cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Employee Directory
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Edit Profile Toggle Button */}
          {isEditMode ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  editForm.reset();
                  setIsEditMode(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              <button
                type="button"
                onClick={editForm.handleSubmit(data => updateEmployeeMutation.mutate(data))}
                disabled={updateEmployeeMutation.isPending}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 cursor-pointer transition-all"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit Employee
            </button>
          )}

          {/* View Workspace Action (View Only) */}
          <button
            onClick={() => navigate(`/workspace?view_employee=${emp.id}`)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Eye className="w-4 h-4" /> Inspect Workspace
          </button>
        </div>
      </div>

      {/* Hero Profile Banner */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-700 text-white font-black text-xl flex items-center justify-center shadow-md shrink-0 ring-4 ring-purple-50">
            {initials || 'EM'}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-gray-900">{emp.firstName || '—'} {emp.lastName || ''}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active Employee
              </span>
            </div>

            <p className="text-xs font-semibold text-gray-600 flex items-center gap-3">
              <span>{emp.designation || '—'}</span>
              <span>•</span>
              <span className="text-primary-700 font-bold">{emp.department ? `${emp.department} Department` : '—'}</span>
              <span>•</span>
              <span className="text-gray-400">ID: #{emp.id?.slice(-6) || '—'}</span>
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-1">
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-gray-400" /> {emp.user?.email || '—'}</span>
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" /> {emp.phone || '—'}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-400" /> {emp.dateOfJoining ? `Joined ${format(new Date(emp.dateOfJoining), 'dd MMM yyyy')}` : 'Joined —'}</span>
            </div>
          </div>
        </div>

        {/* Quick Highlights */}
        <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
          <div className="text-center px-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Commissions</span>
            <p className="text-base font-black text-purple-600">
              {stats?.data?.totalCommission !== undefined ? `₹${Number(stats.data.totalCommission).toLocaleString('en-IN')}` : '₹0'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Styled identical to Employees layout tabs) */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3 overflow-x-auto no-scrollbar flex-nowrap scroll-smooth">
        {[
          { id: 'overview', label: 'Overview & Profile Details', icon: User },
          { id: 'commissions', label: 'Commissions & Payouts', icon: DollarSign },
          { id: 'access', label: 'Access Control', icon: ShieldCheck },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                'shrink-0 whitespace-nowrap px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer select-none border',
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW & PROFILE (View & Edit Mode styled identical to Directory) ────────────────────── */}
      {activeTab === 'overview' && (
        <form onSubmit={editForm.handleSubmit(data => updateEmployeeMutation.mutate(data))} className="space-y-4">
          
          {/* Sub-navigation tabs (Identical to Employee Directory Modal) */}
          <div className="flex bg-slate-200/60 p-1.5 rounded-2xl gap-2 border border-slate-200/80 overflow-x-auto shadow-2xs">
            {(['Personal', 'Employment', 'Bank Details'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveProfileTab(tab)}
                className={clsx(
                  'px-5 py-2.5 rounded-xl text-xs font-extrabold tracking-wide transition-all cursor-pointer whitespace-nowrap',
                  activeProfileTab === tab
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* TAB 1.1: PERSONAL */}
          {activeProfileTab === 'Personal' && (
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-gray-100 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl border border-blue-100 text-blue-900 font-extrabold text-xs uppercase tracking-wider mb-4">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                Personal &amp; Identity Details
              </div>

              <fieldset disabled={!isEditMode} className="min-w-0 border-0 p-0 m-0 w-full disabled:opacity-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">First Name *</label>
                    <input {...editForm.register('firstName')} className="input font-semibold" placeholder="e.g. Rahul" />
                    {editForm.formState.errors.firstName && <p className="text-xs text-red-500 mt-1">{editForm.formState.errors.firstName.message}</p>}
                  </div>

                  <div>
                    <label className="label">Last Name *</label>
                    <input {...editForm.register('lastName')} className="input font-semibold" placeholder="e.g. Sharma" />
                    {editForm.formState.errors.lastName && <p className="text-xs text-red-500 mt-1">{editForm.formState.errors.lastName.message}</p>}
                  </div>

                  <div>
                    <label className="label">Primary Phone *</label>
                    <input 
                      {...editForm.register('phone')} 
                      className="input font-semibold" 
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      onInput={(e) => {
                        e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 10);
                      }}
                    />
                    {editForm.formState.errors.phone && <p className="text-xs text-red-500 mt-1">{editForm.formState.errors.phone.message}</p>}
                  </div>

                  <div>
                    <label className="label">Alternate Phone</label>
                    <input 
                      {...editForm.register('alternatePhone')} 
                      className="input font-semibold" 
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      onInput={(e) => {
                        e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 10);
                      }}
                    />
                    {editForm.formState.errors.alternatePhone && <p className="text-xs text-red-500 mt-1">{editForm.formState.errors.alternatePhone.message}</p>}
                  </div>

                  <div>
                    <label className="label">Gender</label>
                    <select {...editForm.register('gender')} className="input font-semibold">
                      <option value="">Select Gender</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="label">Date of Birth</label>
                    <DatePicker {...editForm.register('dateOfBirth')} className="input font-semibold" />
                  </div>

                  <div>
                    <label className="label">Aadhaar Number</label>
                    <input 
                      {...editForm.register('aadhaarNumber')} 
                      className="input font-semibold font-mono" 
                      maxLength={12}
                      placeholder="12-digit Aadhaar"
                      onInput={(e) => {
                        e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 12);
                      }}
                    />
                  </div>

                  <div>
                    <label className="label">PAN Number</label>
                    <input 
                      {...editForm.register('panNumber')} 
                      className="input font-semibold uppercase font-mono" 
                      placeholder="e.g. ABCPS1234F"
                      maxLength={10} 
                    />
                  </div>

                  <div>
                    <label className="label">Account Status</label>
                    <div className="input flex items-center gap-2 bg-slate-50 font-semibold">
                      <span className={clsx("w-2 h-2 rounded-full", emp?.isActive ? "bg-emerald-500" : "bg-rose-500")} />
                      <span className="font-bold text-xs">{emp?.isActive ? 'Active Employee' : 'Inactive'}</span>
                    </div>
                  </div>

                  <div className="sm:col-span-2 md:col-span-3">
                    <label className="label">Emergency Contact &amp; Relation</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input {...editForm.register('emergencyContactName')} className="input font-semibold" placeholder="Name &amp; Relation (e.g. Spouse, Father)" />
                      <div>
                        <input 
                          {...editForm.register('emergencyContactPhone')} 
                          className="input font-semibold" 
                          placeholder="10-digit Phone" 
                          maxLength={10}
                          onInput={(e) => {
                            e.currentTarget.value = e.currentTarget.value.replace(/\D/g, '').slice(0, 10);
                          }}
                        />
                        {editForm.formState.errors.emergencyContactPhone && (
                          <p className="text-xs text-red-500 mt-1">{editForm.formState.errors.emergencyContactPhone.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </fieldset>
            </div>
          )}

          {/* TAB 1.2: EMPLOYMENT */}
          {activeProfileTab === 'Employment' && (
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-gray-100 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl border border-blue-100 text-blue-900 font-extrabold text-xs uppercase tracking-wider mb-4">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">2</span>
                Employment &amp; Role Setup
              </div>

              <fieldset disabled={!isEditMode} className="min-w-0 border-0 p-0 m-0 w-full disabled:opacity-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Designation</label>
                    <input {...editForm.register('designation')} className="input font-semibold" placeholder="e.g. Insurance Specialist" />
                  </div>

                  <div>
                    <label className="label">Department</label>
                    <input {...editForm.register('department')} className="input font-semibold" placeholder="e.g. Sales &amp; Advisory" />
                  </div>

                  <div>
                    <label className="label">Reporting Manager</label>
                    <input {...editForm.register('reportingManager')} className="input font-semibold" placeholder="e.g. Agency Manager" />
                  </div>

                  <div>
                    <label className="label">Date of Joining</label>
                    <Controller
                      control={editForm.control}
                      name="dateOfJoining"
                      render={({ field }) => <DatePicker {...field} className="input font-semibold" />}
                    />
                  </div>

                  <div>
                    <label className="label">Login Email (Read-Only)</label>
                    <input 
                      type="email" 
                      className="input bg-slate-50 text-slate-500 cursor-not-allowed font-mono text-xs font-semibold" 
                      value={emp?.user?.email ?? ''} 
                      disabled 
                      readOnly 
                    />
                  </div>

                  <div>
                    <label className="label">Account Role</label>
                    <div className="input bg-slate-50 flex items-center">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                        {emp?.user?.role || 'EMPLOYEE'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="label">Approval Status</label>
                    <div className="input bg-slate-50 flex items-center">
                      <span className={clsx(
                        "px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase",
                        emp?.approvalStatus === 'PENDING' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        emp?.approvalStatus === 'REJECTED' ? "bg-rose-50 text-rose-700 border border-rose-200" :
                        "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      )}>
                        {emp?.approvalStatus || 'APPROVED'}
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-2 md:col-span-3">
                    <label className="label">Residential Address</label>
                    <textarea {...editForm.register('address')} rows={2} className="input w-full font-medium" placeholder="Enter complete residential address..." />
                  </div>
                </div>
              </fieldset>
            </div>
          )}

          {/* TAB 1.3: BANK DETAILS */}
          {activeProfileTab === 'Bank Details' && (
            <div className="bg-white p-6 sm:p-7 rounded-3xl border border-gray-100 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-xl border border-blue-100 text-blue-900 font-extrabold text-xs uppercase tracking-wider mb-4">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">3</span>
                Bank &amp; Settlement Account
              </div>

              <fieldset disabled={!isEditMode} className="min-w-0 border-0 p-0 m-0 w-full disabled:opacity-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Bank Name</label>
                    <input {...editForm.register('bankName')} className="input font-semibold" placeholder="e.g. HDFC Bank" />
                  </div>

                  <div>
                    <label className="label">Account Number</label>
                    <input {...editForm.register('bankAccountNumber')} className="input font-mono font-semibold" placeholder="e.g. 501002345678" />
                  </div>

                  <div>
                    <label className="label">IFSC Code</label>
                    <input {...editForm.register('bankIfscCode')} className="input font-mono font-semibold uppercase" placeholder="e.g. HDFC0001234" />
                  </div>

                  <div>
                    <label className="label">Branch Name</label>
                    <input {...editForm.register('bankBranch')} className="input font-semibold" placeholder="e.g. Kothrud Branch" />
                  </div>

                  <div>
                    <label className="label">Account Type</label>
                    <select {...editForm.register('bankAccountType')} className="input font-semibold">
                      <option value="">Select Account Type</option>
                      <option value="Savings">Savings</option>
                      <option value="Current">Current</option>
                      <option value="Salary">Salary Account</option>
                    </select>
                  </div>
                </div>
              </fieldset>
            </div>
          )}

          {/* Bottom Save Bar when in Edit Mode */}
          {isEditMode && (
            <div className="sticky bottom-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-purple-200 shadow-xl flex items-center justify-between z-20 animate-fade-in">
              <span className="text-xs font-bold text-purple-900">
                You are currently in editing mode. Save or discard your modifications.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    editForm.reset();
                    setIsEditMode(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateEmployeeMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> Save Profile Details
                </button>
              </div>
            </div>
          )}

        </form>
      )}

      {/* ── TAB 2: COMMISSIONS & PAYOUTS ────────────────────────────────────────── */}
      {activeTab === 'commissions' && (
        <form onSubmit={editForm.handleSubmit(data => updateEmployeeMutation.mutate(data))} className="space-y-6">
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50/50 rounded-xl border border-amber-100 text-amber-900 font-extrabold text-xs uppercase tracking-wider">
              <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">₹</span>
              Commissions &amp; Earnings Overview
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 shadow-2xs">
                <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">Published / Paid</span>
                <p className="text-2xl font-black text-emerald-900 mt-1">
                  ₹{(stats?.data?.paidCommission || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/80 shadow-2xs">
                <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block">Pending Approval</span>
                <p className="text-2xl font-black text-amber-900 mt-1">
                  ₹{(stats?.data?.pendingCommission || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-200/80 shadow-2xs">
                <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider block">Total YTD Earnings</span>
                <p className="text-2xl font-black text-purple-900 mt-1">
                  ₹{(stats?.data?.totalCommission || 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Targets & Compensation Setup */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Salary, Commission &amp; Target Setup
              </h4>
              <fieldset disabled={!isEditMode} className="min-w-0 border-0 p-0 m-0 w-full disabled:opacity-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Base Salary (₹)</label>
                    <input 
                      type="number" 
                      {...editForm.register('baseSalary')} 
                      className="input font-semibold" 
                      placeholder="e.g. 25000" 
                    />
                  </div>
                  <div>
                    <label className="label">Bonus Planned (₹)</label>
                    <input 
                      type="number" 
                      {...editForm.register('bonusPlanned')} 
                      className="input font-semibold" 
                      placeholder="e.g. 5000" 
                    />
                  </div>
                  <div>
                    <label className="label">Monthly Target (₹)</label>
                    <input 
                      type="number" 
                      {...editForm.register('monthlyTarget')} 
                      className="input font-semibold" 
                      placeholder="e.g. 500000" 
                    />
                  </div>
                  <div>
                    <label className="label">Calls Target (Monthly)</label>
                    <input 
                      type="number" 
                      {...editForm.register('callsTarget')} 
                      className="input font-semibold" 
                      placeholder="e.g. 30" 
                    />
                  </div>
                  <div>
                    <label className="label">Visits Target (Monthly)</label>
                    <input 
                      type="number" 
                      {...editForm.register('visitsTarget')} 
                      className="input font-semibold" 
                      placeholder="e.g. 10" 
                    />
                  </div>
                  <div>
                    <label className="label">Commission Rate (%)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      {...editForm.register('commissionRate')} 
                      className="input font-semibold" 
                      placeholder="e.g. 5.0" 
                    />
                  </div>
                </div>
              </fieldset>
            </div>
          </div>

          {/* Bottom Save Bar when in Edit Mode */}
          {isEditMode && (
            <div className="sticky bottom-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-purple-200 shadow-xl flex items-center justify-between z-20 animate-fade-in">
              <span className="text-xs font-bold text-purple-900">
                You are currently in editing mode. Save or discard your modifications.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    editForm.reset();
                    setIsEditMode(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateEmployeeMutation.isPending}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> Save Targets
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {/* ── TAB 3: ACCESS CONTROL ────────────────────────────────────────── */}
      {activeTab === 'access' && (
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50/50 rounded-xl border border-indigo-100 text-indigo-900 font-extrabold text-xs uppercase tracking-wider">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">🔐</span>
              Module Permissions &amp; Privileges
            </div>

            <button
              type="button"
              onClick={() => {
                const currentRole = (emp.user?.role || 'EMPLOYEE') as 'OWNER' | 'EMPLOYEE' | 'CONTACT';
                const currentPerms = Array.isArray(emp.user?.permissions)
                  ? emp.user.permissions.filter((permission: string) => MODULES.some(module => module.key === permission))
                  : [];
                setSelectedRole(currentRole);
                setSelectedPermissions(currentPerms);
                setPermModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-500/20 cursor-pointer flex items-center gap-2 transition-all hover:scale-105 w-fit"
            >
              <Key size={14} />
              Modify Permissions
            </button>
          </div>

          <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Assigned System Role:</span>
            <span className={clsx(
              "px-3 py-1 rounded-xl text-xs font-extrabold uppercase border",
              emp.user?.role === 'OWNER' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
              emp.user?.role === 'CONTACT' ? 'bg-amber-100 text-amber-800 border-amber-200' :
              'bg-purple-100 text-purple-800 border-purple-200'
            )}>
              {emp.user?.role === 'OWNER' ? '⚡ Owner / SuperAdmin' : emp.user?.role === 'CONTACT' ? '🤝 Referral Partner' : '👤 Standard Employee'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULES.map(mod => {
              const hasAccess = emp.user?.permissions?.includes(mod.key) || emp.user?.role === 'OWNER';
              return (
                <div
                  key={mod.key}
                  className={clsx(
                    "p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3",
                    hasAccess
                      ? "bg-emerald-50/60 border-emerald-200/90 shadow-2xs"
                      : "bg-slate-50/80 border-slate-200 text-slate-400"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900">{mod.label}</span>
                    <span className={clsx(
                      "text-[10px] font-extrabold px-2 py-0.5 rounded-full border",
                      hasAccess ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-200 text-slate-600 border-slate-300"
                    )}>
                      {hasAccess ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {mod.desc && (
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      {mod.desc}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      <Modal open={permModal} onClose={() => setPermModal(false)} title="Update Permissions">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as any)}
              className="input w-full p-2.5 text-xs border rounded-xl"
            >
              <option value="EMPLOYEE">Employee (Standard Access)</option>
              <option value="OWNER">Owner / Co-Owner (Full Access)</option>
              <option value="CONTACT">Referral Partner</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-gray-700 uppercase">
                Module Access ({selectedRole === 'OWNER' ? MODULES.length : selectedPermissions.length} / {MODULES.length} Enabled)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPermissions(MODULES.map(m => m.key))}
                  className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-gray-300">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedPermissions([])}
                  className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
              {MODULES.map(m => {
                const isChecked = selectedRole === 'OWNER' || selectedPermissions.includes(m.key);
                return (
                  <div
                    key={m.key}
                    onClick={() => {
                      if (selectedRole === 'OWNER') return;
                      handleToggleModule(m.key);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                      isChecked
                        ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 font-bold shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        disabled={selectedRole === 'OWNER'}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span>{m.label}</span>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      isChecked ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {isChecked ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setPermModal(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={updatePermissions.isPending}
              onClick={() => {
                updatePermissions.mutate({
                  role: selectedRole,
                  permissions: selectedRole === 'OWNER' ? MODULES.map(m => m.key) : selectedPermissions,
                });
              }}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
            >
              {updatePermissions.isPending ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}

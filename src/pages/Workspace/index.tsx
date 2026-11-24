import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@store/auth.store';
import {
  useWorkspaceData,
  useClockIn,
  useClockOut,
  useUpsertDailyLog,
  useUpdateTaskStatus,
  useCreateTask,
  useEmployeeTasks
} from '@hooks/useWorkspace';
import { commissionsService, contactsService, employeesService, workspaceService } from '@api/index';
import DataTable, { Column } from '@comps/common/DataTable';
import {
  Clock, CheckCircle, Play, Square,
  TrendingUp, ListTodo, ClipboardList,
  Plus, CheckSquare, User, Shield,
  FileText, Users, Phone, DollarSign,
  Filter, Check, AlertCircle, LayoutDashboard, ArrowRight, Lock, MessageSquare,
  ChevronDown, Eye, X
} from 'lucide-react';
import { format } from 'date-fns';
import { DatePicker } from '@comps/common/DatePicker';
import toast from 'react-hot-toast';
import WorkspaceKpiCards from './components/WorkspaceKpiCards';

function formatTotalDuration(checkIn: string | Date, checkOut: string | Date) {
  const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (diffMs <= 0) return '0m';
  const totalMins = Math.floor(diffMs / (1000 * 60));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

type TabType = 'commissions';

const formatPreview = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return format(d, 'dd/MMM/yyyy');
  } catch {
    return '';
  }
};

export default function Workspace() {
  const user = useAuthStore(s => s.user);
  const { data: wsRes, isLoading, refetch } = useWorkspaceData();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEmployeeUserId = searchParams.get('view_employee');
  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();
  const saveLogMutation = useUpsertDailyLog();
  const updateTaskStatusMutation = useUpdateTaskStatus();
  const createTaskMutation = useCreateTask();

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabType>('commissions');
  const [commissionPage, setCommissionPage] = useState(1);

  // Task filter & form state
  const [taskStatusFilter, setTaskStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('ALL');
  const [taskFilterDateFrom, setTaskFilterDateFrom] = useState('');
  const [taskFilterDateTo, setTaskFilterDateTo] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [comments, setComments] = useState('');
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskTargetTime, setTaskTargetTime] = useState('');
  const [taskTimeRequired, setTaskTimeRequired] = useState('');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [showAddTask, setShowAddTask] = useState(false);

  // Employee list for Task assignment
  const { data: employeesRes } = useQuery({
    queryKey: ['employees-lookup-workspace'],
    queryFn: () => employeesService.list({ limit: 100 }),
    staleTime: 5 * 60_000,
  });

  const contactsCountParams = { limit: 2000, search: undefined, sortBy: 'createdAt', sortOrder: 'desc' };
  const {
    data: contactsCountRes,
    isLoading: contactsCountLoading,
    isError: contactsCountError,
  } = useQuery({
    queryKey: ['contacts', contactsCountParams],
    queryFn: () => contactsService.list(contactsCountParams),
    enabled: !selectedEmployeeUserId,
    staleTime: 0,
  });

  // My tasks list query
  const { data: allTasksRes, isLoading: tasksLoading } = useEmployeeTasks(
    taskStatusFilter === 'ALL' ? {} : { status: taskStatusFilter }
  );

  // Load every backend page so the history totals and pagination include all entries.
  const { data: commRes, isLoading: commLoading, isError: commError } = useQuery({
    queryKey: ['my-commissions', selectedEmployeeUserId],
    queryFn: async () => {
      const params = selectedEmployeeUserId ? { beneficiaryId: selectedEmployeeUserId } : {};
      const firstPage = await commissionsService.list({ ...params, page: 1, limit: 100 });
      const allCommissions = [...(firstPage?.data ?? [])];
      const totalPages = firstPage?.meta?.totalPages ?? 1;

      for (let page = 2; page <= totalPages; page++) {
        const response = await commissionsService.list({ ...params, page, limit: 100 });
        allCommissions.push(...(response?.data ?? []));
      }

      return { ...firstPage, data: allCommissions };
    },
    staleTime: 60_000,
  });

  // EOD fields
  const [notes, setNotes] = useState('');
  const [callsMade, setCallsMade] = useState(0);
  const [visitsCompleted, setVisitsCompleted] = useState(0);
  const [premiumCollected, setPremiumCollected] = useState(0);
  const [nextDayPlan, setNextDayPlan] = useState('');

  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);

  // Query for selected employee workspace data (when admin selects an employee)
  const { data: selectedEmpWsRes, isLoading: selectedEmpWsLoading } = useQuery({
    queryKey: ['workspace', 'employee-data', selectedEmployeeUserId],
    queryFn: () => selectedEmployeeUserId ? workspaceService.getEmployeeData(selectedEmployeeUserId) : null,
    enabled: !!selectedEmployeeUserId && (user?.role === 'OWNER' || user?.role === 'SUPERADMIN'),
    staleTime: 30_000,
  });

  const workspaceData = wsRes?.data || wsRes; // support both envelope formats
  const selectedWorkspaceData = selectedEmpWsRes?.data || selectedEmpWsRes;
  const logToday = workspaceData?.dailyLog;
  const isClockedIn = !!logToday?.checkIn && !logToday?.checkOut;
  const isClockedOut = !!logToday?.checkIn && !!logToday?.checkOut;

  // Sync log fields to local state
  useEffect(() => {
    if (logToday) {
      setNotes(logToday.notes || '');
      setCallsMade(logToday.callsMade || 0);
      setVisitsCompleted(logToday.visitsCompleted || 0);
      setPremiumCollected(logToday.premiumCollected || 0);
      setNextDayPlan(logToday.nextDayPlan || '');
    }
  }, [logToday]);

  useEffect(() => {
    setCommissionPage(1);
  }, [selectedEmployeeUserId]);

  const handleClockIn = () => {
    if (isClockedOut) {
      toast.error('Attendance is locked after EOD submission for today');
      return;
    }
    clockInMutation.mutate(undefined, {
      onSuccess: () => refetch()
    });
  };

  const handleClockOut = () => {
    if (isClockedOut) {
      toast.error('Attendance already ended and locked for today');
      return;
    }
    clockOutMutation.mutate(undefined, {
      onSuccess: () => refetch()
    });
  };

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    saveLogMutation.mutate({
      notes,
      callsMade,
      visitsCompleted,
      premiumCollected,
      nextDayPlan
    }, {
      onSuccess: () => refetch()
    });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    createTaskMutation.mutate({
      title: taskTitle,
      description: taskDesc || undefined,
      assignedToId: assignedToId || user?.id,
      comments: comments || undefined,
      startDate: taskStartDate ? new Date(taskStartDate).toISOString() : undefined,
      dueDate: taskDueDate ? new Date(taskDueDate).toISOString() : new Date(Date.now() + 86400000).toISOString(),
      targetTime: taskTargetTime || undefined,
      timeRequired: taskTimeRequired || undefined,
      priority: taskPriority,
    }, {
      onSuccess: () => {
        setTaskTitle('');
        setTaskDesc('');
        setComments('');
        setTaskStartDate('');
        setTaskDueDate('');
        setTaskTargetTime('');
        setTaskTimeRequired('');
        setTaskPriority('MEDIUM');
        setShowAddTask(false);
        refetch();
      }
    });
  };

  const handleToggleTask = (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    updateTaskStatusMutation.mutate({ taskId, status: nextStatus }, {
      onSuccess: () => refetch()
    });
  };

  const employeesList = (employeesRes?.data?.data || employeesRes?.data || []) as any[];
  const selectedEmployeeObj = employeesList.find((e: any) => (e.user?.id || e.userId || e.id) === selectedEmployeeUserId);

  const activeWorkspaceData = selectedEmployeeUserId ? selectedWorkspaceData : workspaceData;
  const activeCounts = activeWorkspaceData?.counts ?? { leads: 0, policies: 0, claims: 0, contacts: 0 };
  const workspaceContactCount = useMemo(() => {
    const records = Array.isArray(contactsCountRes?.data)
      ? contactsCountRes.data
      : Array.isArray(contactsCountRes?.data?.data)
        ? contactsCountRes.data.data
        : [];
    const visibleContactIds = new Set<string>();
    records.forEach((contact: any) => {
      if (!contact.id) return;
      const isInvalidDoctor = String(contact.role || '').trim().toLowerCase() === 'doctor'
        && String(contact.phone || '').replace(/\D/g, '').length !== 10;
      if (!isInvalidDoctor) visibleContactIds.add(String(contact.id));
    });
    return visibleContactIds.size;
  }, [contactsCountRes]);
  const workspaceCardCounts = {
    ...activeCounts,
    contacts: selectedEmployeeUserId ? activeCounts.contacts : workspaceContactCount,
  };
  const activeTarget = activeWorkspaceData?.target ?? { monthlyTarget: 0, progress: 0, percentage: 0, baseSalary: 0, bonusPlanned: 0, callsTarget: 0, visitsTarget: 0, callsProgress: 0, visitsProgress: 0, monthlyCommission: 0 };
  const activeTasks = activeWorkspaceData?.tasks || [];
  const activeRecentLogs = activeWorkspaceData?.recentLogs || [];
  const activeLogToday = activeWorkspaceData?.dailyLog;
  const activeIsClockedIn = !!activeLogToday?.checkIn && !activeLogToday?.checkOut;
  const activeIsClockedOut = !!activeLogToday?.checkIn && !!activeLogToday?.checkOut;

  const counts = activeCounts;
  const target = activeTarget;
  const tasks = activeTasks;
  const recentLogs = activeRecentLogs;

  const taskListFromApi = selectedEmployeeUserId ? activeTasks : (allTasksRes?.data || tasks);

  const filteredTasksList = useMemo(() => {
    const list = taskListFromApi || [];
    return list.filter((task: any) => {
      // 1. Status Filter
      if (taskStatusFilter !== 'ALL' && task.status !== taskStatusFilter) {
        return false;
      }
      // 2. Priority Filter
      if (taskPriorityFilter !== 'ALL' && (task.priority || 'MEDIUM') !== taskPriorityFilter) {
        return false;
      }
      // 3. Datewise Filter (matches task dueDate, startDate, or createdAt)
      const taskDateStr = task.dueDate || task.startDate || task.createdAt;
      if (taskDateStr) {
        const taskTime = new Date(taskDateStr).getTime();
        if (taskFilterDateFrom) {
          const fromTime = new Date(taskFilterDateFrom).setHours(0, 0, 0, 0);
          if (taskTime < fromTime) return false;
        }
        if (taskFilterDateTo) {
          const toTime = new Date(taskFilterDateTo).setHours(23, 59, 59, 999);
          if (taskTime > toTime) return false;
        }
      }
      return true;
    });
  }, [taskListFromApi, taskStatusFilter, taskPriorityFilter, taskFilterDateFrom, taskFilterDateTo]);

  if (isLoading || (!selectedEmployeeUserId && contactsCountLoading) || (selectedEmployeeUserId && selectedEmpWsLoading)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-sm sm:text-base">
      {/* 1. TOP KPI METRIC CARDS */}
      <WorkspaceKpiCards
        activeCounts={workspaceCardCounts}
        contactsCountError={contactsCountError && !selectedEmployeeUserId}
        taskListFromApi={taskListFromApi}
      />

      {/* Admin Select Employee Modal / Modal List */}
      {isEmployeeModalOpen && (user?.role === 'OWNER' || user?.role === 'SUPERADMIN') && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-800 flex flex-wrap items-center gap-2">
                <Users className="w-5 h-5 text-primary-600" /> Select Employee Workspace
              </h3>
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-gray-500">
              Select an employee to view their targets, active tasks, daily log reports, and performance in view-only mode.
            </p>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {employeesList.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">No employees found.</div>
              ) : (
                employeesList.map((emp: any) => {
                  const empUserId = emp.user?.id || emp.userId || emp.id;
                  const isSelected = selectedEmployeeUserId === empUserId;
                  return (
                    <button
                      key={empUserId}
                      onClick={() => {
                        setSearchParams({ view_employee: empUserId });
                        setIsEmployeeModalOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-xs transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-primary-50 border-primary-300 text-primary-900 font-bold'
                          : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800 font-semibold'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                          {emp.firstName?.[0] || 'E'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{emp.firstName} {emp.lastName}</p>
                          <p className="text-[10px] text-gray-500">{emp.designation || 'Employee'} • {emp.email || emp.user?.email}</p>
                        </div>
                      </div>
                      <Eye className="w-4 h-4 text-primary-600 opacity-60 group-hover:opacity-100" />
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsEmployeeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. WORKSPACE NAVIGATION (Commissions) */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto no-scrollbar flex-nowrap scroll-smooth">
        <button
          onClick={() => setActiveTab('commissions')}
          className="shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer bg-primary-600 text-white shadow-sm"
        >
          <DollarSign className="w-4 h-4" /> Commissions
        </button>

        {/* "View Employee Workspace" Button Next to Tabs (Owners / Superadmins only) */}
        {(user?.role === 'OWNER' || user?.role === 'SUPERADMIN') && (
          <div className="shrink-0 whitespace-nowrap ml-auto flex items-center gap-2">
            {selectedEmployeeUserId ? (
              <button
                onClick={() => setSearchParams({})}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
              >
                <X className="w-4 h-4 text-amber-700" /> Clear Filter
              </button>
            ) : (
              <button
                onClick={() => setIsEmployeeModalOpen(!isEmployeeModalOpen)}
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 border border-primary-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
              >
                <Users className="w-4 h-4 text-primary-600" /> View Employee <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* COMMISSIONS */}
      {activeTab === 'commissions' && (
        <div className="space-y-6">
          {/* Compensation Overview (Backend Sourced) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-500 block">Base Salary</span>
                <span className="text-lg font-bold text-gray-900">₹{(target.baseSalary || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-500 block">Bonus Planned</span>
                <span className="text-lg font-bold text-gray-900">₹{(target.bonusPlanned || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-600 block">Monthly Commission</span>
                <span className="text-lg font-bold text-emerald-600">₹{(target.monthlyCommission || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Commissions List */}
          {(() => {
            const rawList: any[] = commRes?.data ?? [];
            const commList = rawList.filter((c: any) => {
              const notes = c.notes || '';
              if (notes.includes('[Saved as Draft]')) return false;
              return notes.includes('[Published to Workspace]');
            });
            const commissionPageSize = 20;
            const currentPage = Math.min(commissionPage, Math.max(1, Math.ceil(commList.length / commissionPageSize)));
            const pageStart = (currentPage - 1) * commissionPageSize;
            const paginatedCommissions = commList.slice(pageStart, pageStart + commissionPageSize);
            const totalCommission = commList.reduce((sum: number, c: any) => sum + Number(c.amount ?? 0), 0);
            const paidCommission  = commList.filter((c: any) => c.isPaid).reduce((sum: number, c: any) => sum + Number(c.amount ?? 0), 0);
            const commissionColumns: Column<any>[] = [
              {
                key: 'policyDetails',
                label: 'Policy Details',
                render: (c: any) => {
                  const contactName = c.policy?.contact
                    ? `${c.policy.contact.firstName ?? ''} ${c.policy.contact.lastName ?? ''}`.trim()
                    : '';
                  const planName = c.policy?.plan?.name || c.policyName || 'Insurance Policy';
                  return (
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{planName}</span>
                      {contactName && <span className="text-xs text-slate-500 font-medium">Holder: {contactName}</span>}
                    </div>
                  );
                },
              },
              {
                key: 'policyNumber',
                label: 'Policy Number',
                render: (c: any) => (
                  <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    #{c.policy?.policyNumber ?? '—'}
                  </span>
                ),
              },
              {
                key: 'year',
                label: 'Year',
                render: (c: any) => c.commissionYear?.name ?? (c.year ? `Year ${c.year}` : '—'),
              },
              {
                key: 'amount',
                label: 'Commission Amount',
                className: 'text-right',
                render: (c: any) => <span className="font-bold text-slate-900">₹{Number(c.amount ?? 0).toLocaleString('en-IN')}</span>,
              },
              {
                key: 'comment',
                label: 'Comment',
                render: (c: any) => {
                  const matchRemark = c.notes?.match(/Payment Remark:\s*([^\n]+)/i);
                  const commentText = matchRemark ? matchRemark[1].trim() : (c.remark || '');
                  return <span className="truncate block max-w-[180px]" title={commentText}>{commentText}</span>;
                },
              },
              {
                key: 'status',
                label: 'Status',
                className: 'text-center',
                render: (c: any) => (
                  <span className={c.isPaid ? 'badge-green' : 'badge-yellow'}>
                    {c.isPaid ? 'Paid' : 'Pending'}
                  </span>
                ),
              },
              {
                key: 'paidAt',
                label: 'Paid Date',
                render: (c: any) => c.paidAt ? format(new Date(c.paidAt), 'dd/MMM/yyyy') : '—',
              },
            ];
            return (
              <div className="card bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <h2 className="text-base font-bold text-gray-800 flex flex-wrap items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" /> Commission History (Backend Sourced)
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <span className="text-gray-500">Total: <span className="font-bold text-gray-800">₹{totalCommission.toLocaleString('en-IN')}</span></span>
                    <span className="text-gray-500">Paid: <span className="font-bold text-green-600">₹{paidCommission.toLocaleString('en-IN')}</span></span>
                  </div>
                </div>

                {commLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
                  </div>
                ) : commError ? (
                  <div className="text-center py-8 text-sm text-red-500">Commission history could not be loaded. Please try again.</div>
                ) : commList.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">No commission entries found.</div>
                ) : (
                  <DataTable
                    columns={commissionColumns}
                    data={paginatedCommissions}
                    total={commList.length}
                    page={currentPage}
                    pageSize={commissionPageSize}
                    onPageChange={setCommissionPage}
                    rowKey={c => c.id}
                    showPagination
                    horizontalScroll
                  />
                )}
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
}

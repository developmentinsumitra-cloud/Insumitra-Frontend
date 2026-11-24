import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '@api/auth.service';
import toast from 'react-hot-toast';
import { 
  Mail, Lock, Eye, EyeOff, ShieldCheck, 
  ArrowRight, User, Phone, CheckCircle2, AlertCircle, ArrowLeft, KeyRound
} from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

const registerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Valid 10-digit phone number is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
type RegisterForm = z.infer<typeof registerSchema>;

const resetSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(10, 'Valid 10-digit registered mobile phone is required'),
  code: z.string().min(1, 'Email verification code is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
type ResetForm = z.infer<typeof resetSchema>;

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [pendingApprovalMsg, setPendingApprovalMsg] = useState<string | null>(null);

  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const { 
    register: registerLogin, 
    handleSubmit: handleLoginSubmit, 
    setValue: setLoginValue, 
    formState: { errors: loginErrors } 
  } = useForm<LoginForm>({ 
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const {
    register: registerReg,
    handleSubmit: handleRegSubmit,
    reset: resetReg,
    formState: { errors: regErrors }
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema)
  });

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    reset: resetResetForm,
    getValues: getResetValues,
    setValue: setResetValue,
    trigger: triggerReset,
    formState: { errors: resetErrors }
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: '',
      phone: '',
      code: '',
      newPassword: '',
      confirmPassword: '',
    }
  });

  // Countdown timer for resend code
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Check URL params if arrived via email link
  useEffect(() => {
    const resetParam = searchParams.get('reset');
    const tokenParam = searchParams.get('token');
    const emailParam = searchParams.get('email');
    if (resetParam === 'true' || tokenParam) {
      setIsResetting(true);
      setIsRegistering(false);
      if (emailParam) {
        setResetValue('email', emailParam);
      }
      if (tokenParam) {
        setResetValue('code', tokenParam);
        setCodeSent(true);
      }
    }
  }, [searchParams, setResetValue]);

  const onLoginSubmit = async (data: LoginForm) => {
    setLoading(true);
    setPendingApprovalMsg(null);
    try {
      const res = await authService.login(data);
      if (res?.user?.role === 'CONTACT') {
        navigate('/client/dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (e: any) {
      const msg = e.response?.data?.message ?? 'Login failed';
      if (typeof msg === 'string' && (msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('reject'))) {
        setPendingApprovalMsg(msg);
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onRegisterSubmit = async (data: RegisterForm) => {
    setLoading(true);
    try {
      await authService.registerEmployee({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        password: data.password,
      });
      toast.success('Registration request submitted! Awaiting admin approval.');
      setPendingApprovalMsg('Your registration request has been submitted to the Admin for approval. You will be able to log in once approved.');
      setIsRegistering(false);
      resetReg();
      setLoginValue('email', data.email.trim().toLowerCase(), { shouldValidate: true });
      setLoginValue('password', '');
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetCode = async () => {
    const email = getResetValues('email')?.trim();
    const phone = getResetValues('phone')?.trim();

    if (!email) {
      toast.error('Please enter your registered email address first.');
      triggerReset('email');
      return;
    }
    const emailValid = await triggerReset('email');
    if (!emailValid) return;

    if (!phone) {
      toast.error('Please enter your registered mobile phone number.');
      triggerReset('phone');
      return;
    }
    const phoneValid = await triggerReset('phone');
    if (!phoneValid) return;

    setSendingCode(true);
    try {
      const res = await authService.sendResetCode({ email, phone });
      setCodeSent(true);
      setCountdown(60);
      if (res?.code) {
        setResetValue('code', res.code, { shouldValidate: true });
        toast.success(res.message || `OTP Code: ${res.code}`, { duration: 8000 });
      } else {
        toast.success(res?.message || 'Verification code sent to your registered email!');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Authentication failed. Please verify your email and phone number.');
    } finally {
      setSendingCode(false);
    }
  };

  const onResetSubmit = async (data: ResetForm) => {
    if (!data.code || !data.code.trim()) {
      toast.error('Please enter the verification code sent to your email.');
      return;
    }
    setLoading(true);
    try {
      const res = await authService.resetPasswordDirect({
        email: data.email.trim().toLowerCase(),
        phone: data.phone?.trim() || undefined,
        code: data.code.trim(),
        newPassword: data.newPassword,
      });
      toast.success(res?.message ?? 'Password reset successfully!');
      setIsResetting(false);
      resetResetForm();
      setCodeSent(false);
      setLoginValue('email', data.email.trim().toLowerCase(), { shouldValidate: true });
      setLoginValue('password', '');
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to reset password. Please check your verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 relative overflow-y-auto no-scrollbar flex flex-col items-center justify-center p-3 md:p-6 select-none">
      
      {/* Soft Pastel Floating Ambient Blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-200/50 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none" />

      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:28px_28px] opacity-35 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md my-auto flex flex-col items-center py-6">

        {/* Top Centered Portal Switcher Tabs */}
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-white/90 backdrop-blur-xl border border-white rounded-full shadow-md shadow-teal-900/5 mb-3 text-[11px] font-semibold">
          <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm">
            Unified Portal Login
          </span>
        </div>

        {/* Centered Glassmorphic Login Form Card */}
        <div className="w-full bg-white/90 backdrop-blur-2xl border border-white rounded-3xl p-5 md:p-6 shadow-xl shadow-slate-300/50 space-y-4">
          
          {/* Logo & Header */}
          <div className="text-center space-y-1">
            <img src="/InsumitraLogo.png" alt="Insumitra" className="h-20 md:h-24 max-w-[240px] w-auto object-contain mx-auto" />

            {isRegistering ? (
              <div>
                <h1 className="text-xl font-black text-slate-800 tracking-tight">Employee Registration</h1>
                <p className="text-[11px] text-slate-500 font-medium">Submit request for Admin approval to access workspace</p>
              </div>
            ) : isResetting ? (
              <div>
                <h1 className="text-xl font-black text-slate-800 tracking-tight">Reset Password</h1>
                <p className="text-[11px] text-slate-500 font-medium">Enter your details to create a new password</p>
              </div>
            ) : (
              <div>
                <h1 className="text-xl font-black text-slate-800 tracking-tight">Welcome Back</h1>
                <p className="text-[11px] text-slate-500 font-medium">Sign in to access your agency workspace</p>
              </div>
            )}
          </div>

          {/* Pending / Rejection Approval Message Notice */}
          {pendingApprovalMsg && !isRegistering && !isResetting && (
            <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-start gap-2.5 text-amber-800 text-xs shadow-xs animate-in fade-in duration-300">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900">Registration Notice</p>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">{pendingApprovalMsg}</p>
              </div>
            </div>
          )}

          {/* MODE 1: Reset Password View */}
          {isResetting ? (
            <form onSubmit={handleResetSubmit(onResetSubmit)} className="space-y-3">
              <div className="p-2.5 bg-teal-50/80 border border-teal-200/70 rounded-xl text-[11px] text-teal-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Enter your registered email and mobile number to authenticate and receive your OTP code.</span>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Registered Email Address *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    {...registerReset('email')}
                    type="email"
                    placeholder="you@agency.com"
                    className="w-full pl-8 pr-2.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all"
                  />
                </div>
                {resetErrors.email && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-1">
                    {resetErrors.email.message}
                  </p>
                )}
              </div>

              {/* Mobile Phone */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Registered Mobile Phone *
                  </label>
                  <button
                    type="button"
                    onClick={handleSendResetCode}
                    disabled={sendingCode || countdown > 0}
                    className="text-[10px] font-bold text-teal-600 hover:text-teal-700 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    {sendingCode ? 'Sending...' : countdown > 0 ? `Resend (${countdown}s)` : codeSent ? 'Resend Code' : 'Send Code'}
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <input
                    {...registerReset('phone')}
                    type="tel"
                    placeholder="10-digit registered mobile number"
                    className="w-full pl-8 pr-24 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleSendResetCode}
                    disabled={sendingCode || countdown > 0}
                    className="absolute inset-y-1 right-1 px-2.5 bg-teal-600/10 hover:bg-teal-600/20 text-teal-700 text-[10px] font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                  >
                    {sendingCode ? (
                      <div className="w-2.5 h-2.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>{countdown > 0 ? `${countdown}s` : codeSent ? 'Resend' : 'Send Code'}</span>
                    )}
                  </button>
                </div>
                {resetErrors.phone && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-1">
                    {resetErrors.phone.message}
                  </p>
                )}
              </div>

              {/* Verification Code */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Email Verification Code (OTP) *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <input
                    {...registerReset('code')}
                    type="text"
                    maxLength={32}
                    placeholder="Enter 6-digit code or paste token"
                    className="w-full pl-8 pr-2.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-semibold tracking-wider text-slate-800 placeholder-slate-400 placeholder:tracking-normal focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all"
                  />
                </div>
                {resetErrors.code && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-1">
                    {resetErrors.code.message}
                  </p>
                )}
                {codeSent && !resetErrors.code && (
                  <p className="text-[10px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span>OTP code generated & sent! Please check your email or use the code above.</span>
                  </p>
                )}
              </div>

              {/* New Password & Confirm */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    New Password *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      {...registerReset('newPassword')}
                      type={showResetNewPassword ? 'text' : 'password'}
                      placeholder="••••••"
                      className="w-full pl-8 pr-7 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showResetNewPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                  {resetErrors.newPassword && (
                    <p className="text-[10px] text-rose-500 font-semibold mt-1">
                      {resetErrors.newPassword.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      {...registerReset('confirmPassword')}
                      type={showResetConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••"
                      className="w-full pl-8 pr-7 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showResetConfirmPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                  {resetErrors.confirmPassword && (
                    <p className="text-[10px] text-rose-500 font-semibold mt-1">
                      {resetErrors.confirmPassword.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Submit Reset Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-5 rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-700 text-white text-[11px] sm:text-xs font-bold shadow-md shadow-teal-600/20 hover:shadow-lg hover:shadow-teal-600/30 transition-all hover:scale-[1.005] active:scale-[0.995] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying & Setting Password...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code & Reset Password</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              {/* Back to sign in */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetting(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
              </div>
            </form>
          ) : !isRegistering ? (
            /* MODE 2: Normal Sign In View */
            <>
              {/* Sign In Form */}
              <form onSubmit={handleLoginSubmit(onLoginSubmit)} className="space-y-3">
                {/* Email Field */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <input
                      {...registerLogin('email')}
                      type="email"
                      placeholder="you@agency.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all"
                    />
                  </div>
                  {loginErrors.email && (
                    <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                      <span>•</span> {loginErrors.email.message}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetting(true);
                        setIsRegistering(false);
                        setPendingApprovalMsg(null);
                      }}
                      className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 hover:underline cursor-pointer"
                    >
                      Reset Password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      {...registerLogin('password')}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {loginErrors.password && (
                    <p className="text-[10px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
                      <span>•</span> {loginErrors.password.message}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-5 rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-700 text-white text-[11px] sm:text-xs font-bold shadow-md shadow-teal-600/20 hover:shadow-lg hover:shadow-teal-600/30 transition-all hover:scale-[1.005] active:scale-[0.995] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Employee Registration Switch Link */}
              <div className="text-center pt-2">
                <p className="text-[11px] text-slate-500">
                  New Employee?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(true);
                      setIsResetting(false);
                      setPendingApprovalMsg(null);
                    }}
                    className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
                  >
                    Employee Registration
                  </button>
                </p>
              </div>
            </>
          ) : (
            /* MODE 3: Employee Registration Form */
            <form onSubmit={handleRegSubmit(onRegisterSubmit)} className="space-y-3">
              <div className="p-2.5 bg-indigo-50/80 border border-indigo-200/70 rounded-xl text-[11px] text-indigo-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Submit your details to request access. Admin will approve your account.</span>
              </div>

              {/* First & Last Name */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    First Name *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <input
                      {...registerReg('firstName')}
                      type="text"
                      placeholder="First name"
                      className="w-full pl-8 pr-2.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>
                  {regErrors.firstName && (
                    <p className="text-[10px] text-rose-500 font-semibold mt-1">
                      {regErrors.firstName.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Last Name *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <input
                      {...registerReg('lastName')}
                      type="text"
                      placeholder="Last name"
                      className="w-full pl-8 pr-2.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                  </div>
                  {regErrors.lastName && (
                    <p className="text-[10px] text-rose-500 font-semibold mt-1">
                      {regErrors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    {...registerReg('email')}
                    type="email"
                    placeholder="employee@agency.com"
                    className="w-full pl-8 pr-2.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                </div>
                {regErrors.email && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-1">
                    {regErrors.email.message}
                  </p>
                )}
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Phone Number *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <input
                    {...registerReg('phone')}
                    type="tel"
                    placeholder="10-digit mobile number"
                    className="w-full pl-8 pr-2.5 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                </div>
                {regErrors.phone && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-1">
                    {regErrors.phone.message}
                  </p>
                )}
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      {...registerReg('password')}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••"
                      className="w-full pl-8 pr-7 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                  {regErrors.password && (
                    <p className="text-[10px] text-rose-500 font-semibold mt-1">
                      {regErrors.password.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <input
                      {...registerReg('confirmPassword')}
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••"
                      className="w-full pl-8 pr-7 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                  {regErrors.confirmPassword && (
                    <p className="text-[10px] text-rose-500 font-semibold mt-1">
                      {regErrors.confirmPassword.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Submit Registration Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-700 hover:to-indigo-800 text-white text-[11px] sm:text-xs font-bold shadow-md shadow-indigo-600/20 hover:shadow-lg hover:shadow-indigo-600/30 transition-all hover:scale-[1.005] active:scale-[0.995] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Registration Request</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              {/* Switch back to sign in */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Already registered? Sign In</span>
                </button>
              </div>
            </form>
          )}

          {/* Security Compliance */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>256-bit Encrypted SSL Security</span>
          </div>

        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-400 font-medium mt-3">
          © {new Date().getFullYear()} Insumitra. All rights reserved.
        </p>

      </div>
    </div>
  );
}

import { useState } from 'react';
import { router } from '@inertiajs/react';
import {
    Eye, EyeOff, Loader2, Mail, Lock, Truck, Sparkles,
    ChevronRight, MapPin, ShieldCheck,
} from 'lucide-react';

const DEMO_ACCOUNTS = [
    { label: 'Admin', email: 'admin@fleetvision.ai' },
    { label: 'Driver', email: 'john.smith@example.com' },
];

export default function Login() {
    const [email, setEmail] = useState(() => localStorage.getItem('remember_email') || '');
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
    const [remember, setRemember] = useState(() => !!localStorage.getItem('remember_email'));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const json = await res.json();
            if (json.success) {
                localStorage.setItem('token', json.data.token);
                const role = json.data.user?.role || 'driver';
                localStorage.setItem('role', role);
                if (remember) localStorage.setItem('remember_email', email);
                else localStorage.removeItem('remember_email');
                router.visit(role === 'admin' ? '/admin' : '/driver');
            } else {
                setError(json.message || 'Login gagal, periksa email & password.');
            }
        } catch {
            setError('Tidak dapat terhubung ke server.');
        } finally {
            setLoading(false);
        }
    };

    const fillDemo = (demoEmail) => {
        setEmail(demoEmail);
        setPassword('password');
        setError('');
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative overflow-x-hidden">
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="orb orb-blue w-[420px] h-[420px] -top-32 -left-32" />
                <div className="orb orb-violet w-[380px] h-[380px] top-1/3 -right-28" />
                <div className="orb orb-cyan w-[260px] h-[260px] bottom-0 left-1/3" />
                <div
                    className="absolute inset-0 opacity-40"
                    style={{ backgroundImage: 'radial-gradient(rgba(148,163,184,0.16) 1px, transparent 1px)', backgroundSize: '26px 26px' }}
                />
            </div>

            {/* Centered card */}
            <div className="relative w-full max-w-md animate-fade-up">
                {/* Logo di atas card */}
                <div className="flex flex-col items-center text-center mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 via-violet-500 to-accent-500 flex items-center justify-center shadow-[0_10px_32px_rgba(59,130,246,0.45)]">
                        <Truck className="w-6 h-6 text-white" />
                    </div>
                    <p className="font-display font-bold text-dark-900 mt-2.5 leading-tight">FleetVision AI</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-dark-400">Fleet Tracking</p>
                </div>

                <div className="glass-strong rounded-3xl p-6 sm:p-8">
                    <div className="mb-6 text-center">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/25 text-primary-600">
                            <Sparkles className="w-3 h-3" /> Selamat datang kembali
                        </span>
                        <h1 className="font-display text-2xl sm:text-[26px] font-bold text-dark-900 mt-3 leading-tight">
                            Masuk ke <span className="text-gradient">FleetVision</span>
                        </h1>
                        <p className="text-sm text-dark-400 mt-1.5">Kelola armada & pantau driver secara real-time.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3.5 rounded-xl bg-danger-500/10 border border-danger-500/30 text-sm text-danger-500 flex items-start gap-2">
                                <span className="mt-0.5 flex-shrink-0">⚠️</span>
                                <span className="min-w-0">{error}</span>
                            </div>
                        )}

                        <div className="min-w-0">
                            <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
                                <input
                                    id="login-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                    className="input-glass w-full rounded-xl pl-10 pr-4 py-3 text-sm text-dark-900 placeholder-dark-300"
                                    placeholder="nama@perusahaan.com"
                                />
                            </div>
                        </div>

                        <div className="min-w-0">
                            <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
                                <input
                                    id="login-password"
                                    type={show ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    className="input-glass w-full rounded-xl pl-10 pr-11 py-3 text-sm text-dark-900 placeholder-dark-300"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShow(!show)}
                                    aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-dark-500 hover:text-dark-900 hover:bg-dark-100 transition-colors"
                                >
                                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                            <label className="flex items-center gap-2 text-dark-500 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={(e) => setRemember(e.target.checked)}
                                    className="w-3.5 h-3.5 rounded accent-[#2563eb]"
                                />
                                Ingat email saya
                            </label>
                            <span className="text-dark-300">Lupa password? Hubungi admin</span>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-glow w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold group disabled:opacity-60"
                        >
                            {loading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Masuk...</>
                            ) : (
                                <>Masuk Dashboard <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
                            )}
                        </button>

                        <div className="flex items-center justify-center gap-2">
                            <span className="text-[11px] text-dark-400 font-medium">Akun demo:</span>
                            {DEMO_ACCOUNTS.map((d) => (
                                <button
                                    key={d.label}
                                    type="button"
                                    onClick={() => fillDemo(d.email)}
                                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-dark-100/70 border border-dark-200/60 text-dark-600 hover:text-primary-600 hover:border-primary-500/40 transition-colors"
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </form>

                    <div className="mt-6">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="flex-1 h-px bg-dark-200/70" />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-dark-400">atau</span>
                            <span className="flex-1 h-px bg-dark-200/70" />
                        </div>
                        <a
                            href="/track"
                            className="glass glass-hover w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-dark-900"
                        >
                            <MapPin className="w-4 h-4 text-primary-600" /> Lacak kendaraan tanpa login
                        </a>
                        <p className="flex items-center justify-center gap-1.5 text-[11px] text-dark-400 mt-4">
                            <ShieldCheck className="w-3.5 h-3.5" /> Koneksi aman & terenkripsi
                        </p>
                    </div>
                </div>

                <p className="text-center text-[11px] text-dark-400 mt-4">© 2026 FleetVision AI</p>
            </div>
        </div>
    );
}

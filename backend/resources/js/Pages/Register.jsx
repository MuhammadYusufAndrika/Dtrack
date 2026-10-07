import { useState } from 'react';
import { router } from '@inertiajs/react';
import { Eye, EyeOff, Loader2, Mail, Lock, Truck, Sparkles, User, Phone, FileText, ClipboardCheck, AlertTriangle } from 'lucide-react';

export default function Register() {
    const [form, setForm] = useState({ name: '', email: '', phone: '', license_number: '', password: '', password_confirmation: '' });
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const serverError = (json) => {
        if (json?.errors) {
            const first = Object.values(json.errors)[0];
            if (Array.isArray(first) && first[0]) return first[0];
        }
        return json?.message || 'Pendaftaran gagal.';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (form.password !== form.password_confirmation) { setError('Konfirmasi password tidak sama.'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(form),
            });
            const json = await res.json();
            if (json.success) setDone(true);
            else setError(serverError(json));
        } catch {
            setError('Tidak dapat terhubung ke server.');
        } finally {
            setLoading(false);
        }
    };

    const inputCls = 'input-glass w-full rounded-xl pl-10 pr-4 py-3 text-sm text-dark-900 placeholder-dark-300';

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative overflow-x-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="orb orb-blue w-[420px] h-[420px] -top-32 -left-32" />
                <div className="orb orb-violet w-[380px] h-[380px] top-1/3 -right-28" />
                <div className="orb orb-cyan w-[260px] h-[260px] bottom-0 left-1/3" />
                <div className="orb orb-rose w-[220px] h-[220px] bottom-16 right-1/4" />
            </div>

            <div className="relative w-full max-w-md animate-fade-up">
                <div className="flex flex-col items-center text-center mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 via-violet-500 to-accent-500 flex items-center justify-center shadow-[0_10px_32px_rgba(59,130,246,0.45)] ring-4 ring-white/60">
                        <Truck className="w-6 h-6 text-white" />
                    </div>
                    <p className="font-display font-bold text-dark-900 mt-2.5 leading-tight">Dtrack</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gradient">Pendaftaran Sopir</p>
                </div>

                <div className="glass-strong rounded-3xl p-6 sm:p-8">
                    {done ? (
                        <div className="text-center py-6">
                            <div className="inline-flex w-16 h-16 rounded-2xl bg-success-50 border border-success-100 items-center justify-center mb-4"><ClipboardCheck className="w-8 h-8 text-success-500" /></div>
                            <h1 className="font-display text-xl font-bold text-dark-900">Pendaftaran diterima!</h1>
                            <p className="text-sm text-dark-400 mt-2">Akunmu menunggu persetujuan admin. Kamu akan bisa login setelah disetujui.</p>
                            <button onClick={() => router.visit('/login')} className="btn-glow mt-6 px-6 py-3 rounded-xl text-white text-sm font-bold">Kembali ke Login</button>
                        </div>
                    ) : (
                        <>
                            <div className="mb-6 text-center">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full bg-success-100 border border-success-200 text-success-700">
                                    <Sparkles className="w-3 h-3" /> Gabung sebagai sopir
                                </span>
                                <h1 className="font-display text-2xl font-bold text-dark-900 mt-3">Daftar Akun Sopir</h1>
                                <p className="text-sm text-dark-400 mt-1.5">Isi data di bawah — admin akan menyetujui akunmu.</p>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {error && <div className="p-3.5 rounded-xl bg-danger-50 border border-danger-200 text-sm text-danger-700 flex items-start gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}</div>}
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
                                    <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Nama lengkap" className={inputCls} />
                                </div>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
                                    <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required placeholder="nama@perusahaan.com" className={inputCls} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="relative">
                                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
                                        <input type="text" value={form.phone} onChange={(e) => set('phone', e.target.value)} required placeholder="08…" className={inputCls} />
                                    </div>
                                    <div className="relative">
                                        <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
                                        <input type="text" value={form.license_number} onChange={(e) => set('license_number', e.target.value)} required placeholder="No. SIM" className={inputCls} />
                                    </div>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
                                    <input type={show ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8} placeholder="Password (min. 8)" className="input-glass w-full rounded-xl pl-10 pr-11 py-3 text-sm text-dark-900 placeholder-dark-300" />
                                    <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-dark-500 hover:text-dark-900">
                                        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
                                    <input type={show ? 'text' : 'password'} value={form.password_confirmation} onChange={(e) => set('password_confirmation', e.target.value)} required placeholder="Ulangi password" className={inputCls} />
                                </div>
                                <button type="submit" disabled={loading} className="btn-glow w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-60">
                                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Mendaftar...</> : 'Daftar Sekarang'}
                                </button>
                                <p className="text-center text-xs text-dark-400">Sudah punya akun? <button type="button" onClick={() => router.visit('/login')} className="font-bold text-primary-600 hover:underline">Masuk</button></p>
                            </form>
                        </>
                    )}
                </div>
                <p className="text-center text-[11px] text-dark-400 mt-4">© 2026 FleetVision AI</p>
            </div>
        </div>
    );
}

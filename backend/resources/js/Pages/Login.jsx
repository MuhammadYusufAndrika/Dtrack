import { useState } from 'react';
import { router } from '@inertiajs/react';
import GuestLayout from '../Layouts/GuestLayout';
import { Truck, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
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
                router.visit(role === 'admin' ? '/admin' : '/driver');
            } else {
                setError(json.message || 'Login failed');
            }
        } catch {
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <GuestLayout>
            <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mx-auto mb-4">
                    <Truck className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-dark-50">FleetVision AI</h1>
                <p className="text-sm text-dark-400 mt-1">Sign in to your account</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/30 text-sm text-danger-400">{error}</div>}
                <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1.5">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                        className="w-full bg-dark-800 border border-dark-700 rounded-xl px-4 py-2.5 text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-all" placeholder="you@example.com" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1.5">Password</label>
                    <div className="relative">
                        <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                            className="w-full bg-dark-800 border border-dark-700 rounded-xl pl-4 pr-11 py-2.5 text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 transition-all" placeholder="••••••••" />
                        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200">
                            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
                <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white text-sm font-semibold transition-all">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? 'Signing in...' : 'Sign In'}
                </button>
            </form>
        </GuestLayout>
    );
}

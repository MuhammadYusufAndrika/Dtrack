import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../utils/api';
import { Link } from '@inertiajs/react';
import AdminLayout from '../../Layouts/AdminLayout';
import DataTable from '../../Components/DataTable';
import StatusBadge from '../../Components/StatusBadge';
import PageHeader from '../../Components/PageHeader';
import { PageLoader } from '../../Components/LoadingSpinner';
import { User, Truck, Phone, Plus, X, Check, Trash2 } from 'lucide-react';

const emptyForm = { name: '', email: '', phone: '', license_number: '', password: '' };

export default function Drivers() {
    const [drivers, setDrivers] = useState([]);
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [notice, setNotice] = useState('');

    const fetchDrivers = useCallback(() => {
        apiFetch('/api/drivers')
            .then((r) => r.json()).then((j) => { if (j.success) setDrivers(j.data); })
            .catch(() => {}).finally(() => setLoading(false));
    }, []);

    const fetchPending = useCallback(() => {
        apiFetch('/api/drivers-pending')
            .then((r) => r.json()).then((j) => { if (j.success) setPending(j.data?.data ?? j.data ?? []); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetchDrivers();
        fetchPending();
        const interval = setInterval(() => { fetchDrivers(); fetchPending(); }, 15000);
        return () => clearInterval(interval);
    }, [fetchDrivers, fetchPending]);

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const serverError = (json) => {
        if (json?.errors) {
            const first = Object.values(json.errors)[0];
            if (Array.isArray(first) && first[0]) return first[0];
        }
        return json?.message || 'Gagal menyimpan.';
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setFormError('');
        setSaving(true);
        try {
            const res = await apiFetch('/api/drivers', { method: 'POST', body: JSON.stringify(form) });
            const json = await res.json();
            if (!json.success) { setFormError(serverError(json)); return; }
            setShowForm(false);
            setForm(emptyForm);
            setNotice(json.message || 'Driver berhasil dibuat.');
            fetchDrivers();
        } catch {
            setFormError('Tidak dapat terhubung ke server.');
        } finally {
            setSaving(false);
        }
    };

    const handleApprove = async (id) => {
        try {
            const res = await apiFetch(`/api/drivers/${id}/approve`, { method: 'PATCH' });
            const json = await res.json();
            setNotice(json.message || (json.success ? 'Disetujui.' : 'Gagal.'));
            fetchDrivers();
            fetchPending();
        } catch {
            setNotice('Tidak dapat terhubung ke server.');
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Hapus driver ${name}? Akun loginnya ikut terhapus.`)) return;
        try {
            await apiFetch(`/api/drivers/${id}`, { method: 'DELETE' });
            fetchDrivers();
            fetchPending();
        } catch {}
    };

    const inputCls = 'input-glass w-full rounded-xl px-3.5 py-2.5 text-sm text-dark-900 placeholder-dark-300';

    const columns = [
        { key: 'name', header: 'Driver', render: (d) => (
            <Link href={`/admin/drivers/${d.id}`} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center"><User className="w-4 h-4 text-primary-600" /></div>
                <div><p className="font-medium text-dark-900">{d.name}</p><p className="text-xs text-dark-400">{d.email}</p></div>
            </Link>
        )},
        { key: 'phone', header: 'Phone', render: (d) => (
            <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-dark-400" /><span className="text-sm text-dark-700">{d.phone}</span></div>
        )},
        { key: 'license_number', header: 'License' },
        { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} />, sortable: true },
        { key: 'vehicle', header: 'Vehicle', render: (d) => (
            d.vehicle ? <div className="flex items-center gap-2"><Truck className="w-3.5 h-3.5 text-dark-400" /><span className="text-sm text-dark-700">{d.vehicle.plate_number}</span></div>
            : <span className="text-sm text-dark-500">—</span>
        )},
        { key: 'aksi', header: 'Aksi', render: (d) => (
            <button onClick={() => handleDelete(d.id, d.name)} title="Hapus driver + akun loginnya"
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl glass glass-hover text-danger-500">
                <Trash2 className="w-3.5 h-3.5" /> Hapus
            </button>
        )},
    ];

    const shown = tab === 'pending' ? pending : drivers;

    return (
        <AdminLayout>
            <div className="space-y-6">
                <PageHeader eyebrow="Team" title="Driver" description={`${drivers.length} driver terdaftar${pending.length ? ` · ${pending.length} menunggu persetujuan` : ''}.`}
                    action={
                    <div className="flex items-center gap-2">
                        <button onClick={() => { setShowForm(true); setFormError(''); }}
                            className="btn-glow flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold">
                            <Plus className="w-4 h-4" /> Tambah Driver
                        </button>
                        <div className="flex rounded-xl border border-dark-200/60 overflow-hidden glass">
                            {[['all', 'Semua'], ['pending', `Menunggu${pending.length ? ` (${pending.length})` : ''}`]].map(([v, l]) => (
                                <button key={v} onClick={() => setTab(v)}
                                    className={`px-3.5 py-2 text-xs font-bold transition-all ${tab === v ? 'btn-glow text-white' : 'text-dark-400 hover:text-dark-900'}`}>{l}</button>
                            ))}
                        </div>
                    </div>
                    } />
                {notice && <div className="glass rounded-2xl !border-success-500/30 p-3.5 text-sm text-success-500 animate-fade-up">✅ {notice}</div>}
                {tab === 'pending' ? (
                    <div className="space-y-3">
                        {pending.length === 0 && <div className="glass rounded-2xl p-8 text-center text-sm text-dark-400">Tidak ada pendaftar menunggu persetujuan.</div>}
                        {pending.map((d) => (
                            <div key={d.id} className="glass rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-violet-500/10 flex items-center justify-center flex-shrink-0"><User className="w-5 h-5 text-violet-500" /></div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-dark-900">{d.name}</p>
                                    <p className="text-xs text-dark-400">{d.email} · {d.phone} · SIM {d.license_number}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button onClick={() => handleApprove(d.id)} className="btn-glow flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold"><Check className="w-4 h-4" /> Setujui</button>
                                    <button onClick={() => handleDelete(d.id, d.name)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl glass glass-hover text-xs font-bold text-danger-500"><Trash2 className="w-4 h-4" /> Tolak</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <DataTable columns={columns} data={shown} keyExtractor={(d) => d.id} searchable searchKeys={['name', 'email']} searchPlaceholder="Search drivers..." />
                )}

                {showForm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowForm(false)}>
                        <div className="glass-strong rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-display text-lg font-bold text-dark-900">Tambah Driver</h3>
                                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl glass glass-hover"><X className="w-4 h-4" /></button>
                            </div>
                            {formError && <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/30 text-sm text-danger-500 mb-4">⚠️ {formError}</div>}
                            <form onSubmit={handleCreate} className="space-y-3.5">
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">Nama</label>
                                    <input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Nama lengkap" className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">Email (untuk login)</label>
                                    <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required placeholder="nama@perusahaan.com" className={inputCls} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">Telepon</label>
                                        <input value={form.phone} onChange={(e) => set('phone', e.target.value)} required placeholder="08…" className={inputCls} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">No. SIM</label>
                                        <input value={form.license_number} onChange={(e) => set('license_number', e.target.value)} required placeholder="SIM-…" className={inputCls} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wider text-dark-400 mb-1.5">Password awal</label>
                                    <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8} placeholder="min. 8 karakter" className={inputCls} />
                                </div>
                                <p className="text-[11px] text-dark-400">Akun login langsung aktif — beri tahu email + password ini ke sopirnya.</p>
                                <button type="submit" disabled={saving} className="btn-glow w-full py-3 rounded-xl text-white text-sm font-bold disabled:opacity-60">
                                    {saving ? 'Menyimpan…' : 'Simpan Driver'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

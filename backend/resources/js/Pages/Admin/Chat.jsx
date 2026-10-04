import { useEffect, useState, useRef, useCallback } from 'react';
import { apiFetch } from '../../utils/api';
import AdminLayout from '../../Layouts/AdminLayout';
import PageHeader from '../../Components/PageHeader';
import { PageLoader } from '../../Components/LoadingSpinner';
import { Send, Loader2, MessageCircle, User, Trash2 } from 'lucide-react';

const fmtTime = (ts) => ts ? new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const preview = (s) => (s || '').length > 42 ? `${s.slice(0, 42)}…` : (s || 'Belum ada pesan');

export default function AdminChat() {
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [connected, setConnected] = useState(false);
    const [sendError, setSendError] = useState('');
    const bottomRef = useRef(null);
    const selectedRef = useRef(null);

    const mergeMessages = useCallback((list) => {
        setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const fresh = (list || []).filter((m) => !ids.has(m.id));
            if (!fresh.length) return prev;
            return [...prev, ...fresh].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
    }, []);

    const loadThreads = useCallback(async () => {
        try {
            const res = await apiFetch('/api/chat/threads');
            const json = await res.json();
            if (json.success) {
                setThreads(json.data || []);
                if (!selectedRef.current && json.data?.length) selectThread(json.data[0].driver.id, false);
            }
        } catch {}
    }, []);

    const loadMessages = useCallback(async (driverId, mark = true) => {
        try {
            const res = await apiFetch(`/api/chat?driver_id=${driverId}`);
            const json = await res.json();
            if (json.success) {
                if (driverId === selectedRef.current) mergeMessages(json.data);
                if (mark) {
                    await apiFetch('/api/chat/read', { method: 'PATCH', body: JSON.stringify({ driver_id: driverId }) });
                    loadThreadsSoft();
                }
            }
        } catch {}
    }, [mergeMessages]);

    const loadThreadsSoft = useCallback(async () => {
        try {
            const res = await apiFetch('/api/chat/threads');
            const json = await res.json();
            if (json.success) setThreads(json.data || []);
        } catch {}
    }, []);

    const selectThread = (driverId, scroll = true) => {
        if (window.Echo && selectedRef.current) window.Echo.leave(`chat.driver.${selectedRef.current}`);
        selectedRef.current = driverId;
        setSelectedId(driverId);
        setMessages([]);
        setConnected(false);
        loadMessages(driverId);
        if (window.Echo) {
            window.Echo.channel(`chat.driver.${driverId}`)
                .listen('.chat.message', (data) => {
                    const msg = data.message ?? data;
                    if (msg?.id && Number(msg.driver_id) === Number(selectedRef.current)) {
                        mergeMessages([msg]);
                        apiFetch('/api/chat/read', { method: 'PATCH', body: JSON.stringify({ driver_id: selectedRef.current }) })
                            .then(() => loadThreadsSoft()).catch(() => {});
                    } else {
                        loadThreadsSoft();
                    }
                })
                .listen('.chat.deleted', (data) => {
                    if (data.cleared_thread) {
                        setMessages([]);
                        loadThreadsSoft();
                    } else if (data.message_id) {
                        setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
                    }
                })
                .subscribed(() => setConnected(true))
                .error(() => setConnected(false));
        }
        if (scroll) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 150);
    };

    useEffect(() => {
        loadThreads().finally(() => setLoading(false));
        const tPoll = setInterval(loadThreadsSoft, 10000);
        return () => clearInterval(tPoll);
    }, [loadThreads, loadThreadsSoft]);

    useEffect(() => {
        if (!selectedId) return;
        const mPoll = setInterval(() => loadMessages(selectedId, false), 5000);
        return () => clearInterval(mPoll);
    }, [selectedId, loadMessages]);

    useEffect(() => () => {
        if (selectedRef.current && window.Echo) window.Echo.leave(`chat.driver.${selectedRef.current}`);
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        const body = text.trim();
        if (!body || sending || !selectedId) return;
        setSending(true);
        setSendError('');
        try {
            const res = await apiFetch('/api/chat', { method: 'POST', body: JSON.stringify({ driver_id: selectedId, body }) });
            const json = await res.json();
            if (json.success) {
                mergeMessages([json.data]);
                setText('');
                loadThreadsSoft();
            } else {
                setSendError(json.message || 'Pesan gagal terkirim.');
            }
        } catch {
            setSendError('Tidak dapat terhubung ke server.');
        }
        setSending(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Hapus pesan ini?')) return;
        try {
            const res = await apiFetch(`/api/chat/${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                setMessages((prev) => prev.filter((m) => m.id !== id));
                loadThreadsSoft();
            } else setSendError(json.message || 'Gagal menghapus pesan.');
        } catch {
            setSendError('Tidak dapat terhubung ke server.');
        }
    };

    const handleClear = async () => {
        if (!selectedId || !window.confirm(`Hapus seluruh riwayat chat ${selected?.driver?.name || ''}? Tindakan tidak bisa dibatalkan.`)) return;
        try {
            const res = await apiFetch('/api/chat/thread', { method: 'DELETE', body: JSON.stringify({ driver_id: selectedId }) });
            const json = await res.json();
            if (json.success) {
                setMessages([]);
                loadThreadsSoft();
            } else setSendError(json.message || 'Gagal menghapus riwayat.');
        } catch {
            setSendError('Tidak dapat terhubung ke server.');
        }
    };

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;

    const selected = threads.find((t) => Number(t.driver?.id) === Number(selectedId));

    return (
        <AdminLayout>
            <div className="space-y-6">
                <PageHeader eyebrow="Komunikasi" title="Chat Sopir" description="Terima laporan kendala & jawab pertanyaan sopir secara live."
                    action={<span className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border ${connected ? 'bg-success-500/10 border-success-500/30 text-success-500' : 'bg-dark-100/60 border-dark-200/70 text-dark-500'}`}><span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success-400 animate-pulse' : 'bg-dark-500'}`} />{connected ? 'Live' : 'Polling'}</span>} />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="glass rounded-3xl overflow-hidden lg:col-span-1">
                        <div className="px-5 py-4 border-b border-dark-200/60">
                            <h3 className="text-sm font-bold text-dark-900">Percakapan ({threads.length})</h3>
                        </div>
                        <div className="max-h-[300px] lg:max-h-[560px] overflow-y-auto divide-y divide-dark-200/40">
                            {threads.length === 0 && <p className="p-6 text-sm text-dark-400 text-center">Belum ada chat masuk.</p>}
                            {threads.map((t) => {
                                const active = Number(t.driver?.id) === Number(selectedId);
                                return (
                                    <button key={t.driver?.id} onClick={() => selectThread(t.driver.id)}
                                        className={`w-full text-left px-5 py-3.5 flex items-center gap-3 transition-colors ${active ? 'bg-primary-500/10' : 'hover:bg-dark-100/50'}`}>
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0">
                                            <User className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-bold text-dark-900 truncate">{t.driver?.name || `Driver #${t.driver?.id}`}</p>
                                            <p className="text-xs text-dark-400 truncate">{t.last_message?.sender_role === 'admin' ? 'Anda: ' : ''}{preview(t.last_message?.body)}</p>
                                        </div>
                                        {t.unread > 0 && <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-danger-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">{t.unread}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="glass rounded-3xl overflow-hidden lg:col-span-2 flex flex-col" style={{ minHeight: '480px', maxHeight: '640px' }}>
                        {!selectedId ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-10 text-center">
                                <MessageCircle className="w-10 h-10 text-dark-300" />
                                <p className="text-sm text-dark-400">Pilih percakapan di kiri untuk membalas.</p>
                            </div>
                        ) : (
                            <>
                                <div className="px-5 py-3.5 border-b border-dark-200/60 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-white" /></div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-dark-900 truncate">{selected?.driver?.name}</p>
                                        <p className="text-[11px] text-dark-400 truncate">{selected?.driver?.email} {selected?.driver?.phone ? `· ${selected.driver.phone}` : ''}</p>
                                    </div>
                                    <button onClick={handleClear} title="Hapus seluruh riwayat" className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl glass glass-hover text-dark-500 hover:text-danger-500 flex-shrink-0">
                                        <Trash2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Hapus riwayat</span>
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                                    {messages.map((m) => {
                                        const mine = m.sender_role === 'admin';
                                        return (
                                            <div key={m.id} className={`flex items-center gap-1 group ${mine ? 'justify-end' : 'justify-start'}`}>
                                                <button onClick={() => handleDelete(m.id)} title="Hapus pesan"
                                                    className={`p-1.5 rounded-lg text-dark-300 hover:text-danger-500 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity flex-shrink-0 ${mine ? '' : 'order-2'}`}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${mine ? 'bg-gradient-to-r from-primary-600 to-accent-500 text-white rounded-br-md' : 'glass-strong text-dark-900 rounded-bl-md'}`}>
                                                    {!mine && <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">{selected?.driver?.name?.split(' ')[0] || 'Sopir'}</p>}
                                                    <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                                                    <p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-dark-400'}`}>{fmtTime(m.created_at)}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={bottomRef} />
                                </div>
                                <form onSubmit={handleSend} className="p-3 sm:p-4 border-t border-dark-200/60 flex gap-2">
                                    <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Balas ke ${selected?.driver?.name || 'sopir'}…`}
                                        maxLength={2000} className="input-glass flex-1 rounded-xl px-4 py-3 text-sm text-dark-900 placeholder-dark-300" />
                                    <button type="submit" disabled={sending || !text.trim()}
                                        className="btn-glow px-5 rounded-xl text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
                                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        <span className="hidden sm:inline">Kirim</span>
                                    </button>
                                </form>
                                {sendError && <p className="px-4 pb-3 text-xs text-danger-500">⚠️ {sendError}</p>}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

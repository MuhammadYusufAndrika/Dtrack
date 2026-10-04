import { useEffect, useState, useRef, useCallback } from 'react';
import DriverLayout from '../../Layouts/DriverLayout';
import PageHeader from '../../Components/PageHeader';
import { Send, Loader2, MessageCircle } from 'lucide-react';

const fmtTime = (ts) => ts ? new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

export default function DriverChat() {
    const [driver, setDriver] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [connected, setConnected] = useState(false);
    const [sendError, setSendError] = useState('');
    const bottomRef = useRef(null);
    const driverRef = useRef(null);

    const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, Accept: 'application/json' });

    const mergeMessages = useCallback((list) => {
        setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const fresh = (list || []).filter((m) => !ids.has(m.id));
            if (!fresh.length) return prev;
            return [...prev, ...fresh].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
    }, []);

    const loadMessages = useCallback(async (mark = true) => {
        try {
            const res = await fetch('/api/chat', { headers: authHeaders() });
            const json = await res.json();
            if (json.success) {
                mergeMessages(json.data);
                if (mark) fetch('/api/chat/read', { method: 'PATCH', headers: authHeaders() }).catch(() => {});
            }
        } catch {}
    }, [mergeMessages]);

    useEffect(() => {
        let poll = null;
        let channelName = null;
        (async () => {
            try {
                const meRes = await fetch('/api/auth/me', { headers: authHeaders() });
                const meJson = await meRes.json();
                const email = meJson.data?.email;
                if (!email) return;
                const dRes = await fetch('/api/drivers', { headers: authHeaders() });
                const dJson = await dRes.json();
                const myDriver = dJson.data?.find((d) => d.email === email);
                if (!myDriver) return;
                setDriver(myDriver);
                driverRef.current = myDriver;

                await loadMessages();

                if (window.Echo) {
                    channelName = `chat.driver.${myDriver.id}`;
                    window.Echo.channel(channelName)
                        .listen('.chat.message', (data) => {
                            const msg = data.message ?? data;
                            if (msg?.id) {
                                mergeMessages([msg]);
                                fetch('/api/chat/read', { method: 'PATCH', headers: authHeaders() }).catch(() => {});
                            }
                        })
                        .subscribed(() => setConnected(true))
                        .error(() => setConnected(false));
                }
                poll = setInterval(() => loadMessages(false), 5000);
            } catch {}
            setLoading(false);
        })();
        return () => {
            if (poll) clearInterval(poll);
            if (channelName && window.Echo) window.Echo.leave(channelName);
        };
    }, [loadMessages, mergeMessages]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        const body = text.trim();
        if (!body || sending) return;
        setSending(true);
        setSendError('');
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ body }),
            });
            if (res.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('role');
                window.location.href = '/login';
                return new Promise(() => {});
            }
            const json = await res.json();
            if (json.success) {
                mergeMessages([json.data]);
                setText('');
            } else {
                setSendError(json.message || 'Pesan gagal terkirim.');
            }
        } catch {
            setSendError('Tidak dapat terhubung ke server.');
        }
        setSending(false);
    };

    if (loading) return <DriverLayout><div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div></DriverLayout>;

    if (!driver) {
        return <DriverLayout><div className="glass rounded-3xl text-center py-14 px-6"><p className="text-4xl mb-3">👤</p><p className="text-dark-900 font-semibold">Belum ada profil driver</p><p className="text-dark-500 text-sm mt-1">Hubungi admin untuk menautkan akun ini.</p></div></DriverLayout>;
    }

    return (
        <DriverLayout>
            <div className="space-y-5">
                <PageHeader eyebrow="Bantuan" title="Chat Admin" description="Lapor kendala atau tanya apa pun — admin membalas langsung di sini."
                    action={<span className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border ${connected ? 'bg-success-500/10 border-success-500/30 text-success-500' : 'bg-dark-100/60 border-dark-200/70 text-dark-500'}`}><span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success-400 animate-pulse' : 'bg-dark-500'}`} />{connected ? 'Live' : 'Polling'}</span>} />
                <div className="glass rounded-3xl overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 300px)', minHeight: '420px' }}>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                        {messages.length === 0 ? (
                            <div className="text-center py-14">
                                <MessageCircle className="w-10 h-10 text-dark-300 mx-auto mb-3" />
                                <p className="text-dark-900 font-semibold text-sm">Belum ada pesan</p>
                                <p className="text-dark-500 text-xs mt-1">Contoh: ban bocor di KM 45, kendaraan mogok, tanya jadwal.</p>
                            </div>
                        ) : messages.map((m) => {
                            const mine = m.sender_role === 'driver';
                            return (
                                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 ${mine ? 'bg-gradient-to-r from-success-500 to-accent-500 text-white rounded-br-md' : 'glass-strong text-dark-900 rounded-bl-md'}`}>
                                        {!mine && <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-0.5">Admin</p>}
                                        <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                                        <p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-dark-400'}`}>{fmtTime(m.created_at)}</p>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={bottomRef} />
                    </div>
                    <form onSubmit={handleSend} className="p-3 sm:p-4 border-t border-dark-200/60 flex gap-2">
                        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis laporan / pertanyaan…"
                            maxLength={2000} className="input-glass flex-1 rounded-xl px-4 py-3 text-sm text-dark-900 placeholder-dark-300" />
                        <button type="submit" disabled={sending || !text.trim()}
                            className="btn-glow px-5 rounded-xl text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            <span className="hidden sm:inline">Kirim</span>
                        </button>
                    </form>
                    {sendError && <p className="px-4 pb-3 text-xs text-danger-500">⚠️ {sendError}</p>}
                </div>
            </div>
        </DriverLayout>
    );
}

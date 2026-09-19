const accents = {
    blue: 'from-primary-500 to-accent-500 shadow-[0_8px_24px_rgba(37,99,235,0.4)]',
    green: 'from-success-500 to-emerald-400 shadow-[0_8px_24px_rgba(34,197,94,0.35)]',
    amber: 'from-warning-500 to-orange-400 shadow-[0_8px_24px_rgba(245,158,11,0.35)]',
    red: 'from-danger-500 to-rose-400 shadow-[0_8px_24px_rgba(239,68,68,0.35)]',
    violet: 'from-violet-500 to-fuchsia-400 shadow-[0_8px_24px_rgba(139,92,246,0.35)]',
    cyan: 'from-accent-500 to-primary-400 shadow-[0_8px_24px_rgba(6,182,212,0.35)]',
};

export default function StatCard({ icon: Icon, label, value, sub, accent = 'blue', delay = '' }) {
    return (
        <div className={`glass glass-hover rounded-2xl p-4 relative overflow-hidden group animate-fade-up ${delay}`}>
            <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-primary-500/10 blur-2xl group-hover:bg-primary-500/20 transition-colors" />
            <div className="flex items-center gap-3 relative">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accents[accent] || accents.blue} flex items-center justify-center flex-shrink-0`}>
                    {Icon && <Icon className="w-5 h-5 text-white" />}
                </div>
                <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-dark-400 truncate">{label}</p>
                    <p className="font-display text-lg font-bold text-dark-900 truncate leading-tight">{value}</p>
                    {sub && <p className="text-[11px] text-dark-500 truncate">{sub}</p>}
                </div>
            </div>
        </div>
    );
}

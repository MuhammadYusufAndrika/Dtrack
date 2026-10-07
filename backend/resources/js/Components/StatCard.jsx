import { useCountUp } from './Charts';

const accents = {
    blue: {
        chip: 'from-primary-500 to-primary-600 shadow-[0_6px_18px_-6px_rgba(37,99,235,0.55)]',
        blob: 'bg-primary-500/10 group-hover:bg-primary-500/20',
    },
    green: {
        chip: 'from-success-500 to-success-600 shadow-[0_6px_18px_-6px_rgba(22,163,74,0.55)]',
        blob: 'bg-success-500/10 group-hover:bg-success-500/20',
    },
    amber: {
        chip: 'from-warning-500 to-warning-600 shadow-[0_6px_18px_-6px_rgba(217,119,6,0.55)]',
        blob: 'bg-warning-500/10 group-hover:bg-warning-500/20',
    },
    red: {
        chip: 'from-danger-500 to-danger-600 shadow-[0_6px_18px_-6px_rgba(220,38,38,0.5)]',
        blob: 'bg-danger-500/10 group-hover:bg-danger-500/20',
    },
    violet: {
        chip: 'from-violet-500 to-violet-600 shadow-[0_6px_18px_-6px_rgba(124,58,237,0.5)]',
        blob: 'bg-violet-500/10 group-hover:bg-violet-500/20',
    },
    cyan: {
        chip: 'from-accent-500 to-accent-600 shadow-[0_6px_18px_-6px_rgba(6,182,212,0.5)]',
        blob: 'bg-accent-500/10 group-hover:bg-accent-500/20',
    },
};

export default function StatCard({ icon: Icon, label, value, sub, accent = 'blue', delay = '', className = '' }) {
    const a = accents[accent] || accents.blue;
    const count = useCountUp(String(value ?? ''));

    return (
        <div className={`glass glass-hover rounded-2xl p-4 relative overflow-hidden group animate-fade-up ${delay} ${className}`}>
            <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl transition-colors ${a.blob}`} />
            <div className="flex items-center gap-3 relative">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${a.chip} flex items-center justify-center flex-shrink-0`}>
                    {Icon && <Icon className="w-5 h-5 text-white" />}
                </div>
                <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-dark-400 truncate">{label}</p>
                    <p className="font-display text-lg font-bold text-dark-900 truncate leading-tight">{count ?? value}</p>
                    {sub && <p className="text-[11px] text-dark-500 truncate">{sub}</p>}
                </div>
            </div>
        </div>
    );
}

const colors = {
    ACTIVE: 'bg-success-500/10 text-success-400 border-success-500/30 shadow-[0_0_16px_rgba(34,197,94,0.2)]',
    AVAILABLE: 'bg-success-500/10 text-success-400 border-success-500/30',
    DRIVING: 'bg-primary-500/10 text-primary-600 border-primary-500/30 shadow-[0_0_16px_rgba(59,130,246,0.25)]',
    COMPLETED: 'bg-primary-500/10 text-primary-600 border-primary-500/30',
    IN_PROGRESS: 'bg-primary-500/10 text-primary-600 border-primary-500/30 shadow-[0_0_16px_rgba(59,130,246,0.25)]',
    MAINTENANCE: 'bg-warning-500/10 text-warning-400 border-warning-500/30',
    ON_BREAK: 'bg-warning-500/10 text-warning-400 border-warning-500/30',
    HIGH: 'bg-warning-500/10 text-warning-400 border-warning-500/30',
    CRITICAL: 'bg-danger-500/15 text-danger-400 border-danger-500/40 shadow-[0_0_16px_rgba(239,68,68,0.3)]',
    CANCELLED: 'bg-danger-500/10 text-danger-400 border-danger-500/30',
    PLANNED: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
    OUT_OF_SERVICE: 'bg-danger-500/10 text-danger-400 border-danger-500/30',
    INACTIVE: 'bg-dark-100/70 text-dark-500 border-dark-200/70',
    OFF_DUTY: 'bg-dark-100/70 text-dark-500 border-dark-200/70',
};

const pulseFor = new Set(['ACTIVE', 'DRIVING', 'IN_PROGRESS', 'CRITICAL', 'AVAILABLE']);

export default function StatusBadge({ status }) {
    const key = String(status || '').toUpperCase();
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-md ${colors[key] || 'bg-dark-100/70 text-dark-500 border-dark-200/70'}`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-current ${pulseFor.has(key) ? 'animate-pulse' : 'opacity-60'}`} />
            {String(status || '—').charAt(0) + String(status || '—').slice(1).toLowerCase().replace(/_/g, ' ')}
        </span>
    );
}

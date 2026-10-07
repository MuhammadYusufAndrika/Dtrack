const colors = {
    ACTIVE: 'bg-success-100 text-success-700 border-success-200 shadow-[0_1px_2px_rgba(22,163,74,0.12)]',
    AVAILABLE: 'bg-success-100 text-success-700 border-success-200',
    DRIVING: 'bg-primary-100 text-primary-700 border-primary-200 shadow-[0_1px_2px_rgba(37,99,235,0.12)]',
    IN_PROGRESS: 'bg-primary-100 text-primary-700 border-primary-200 shadow-[0_1px_2px_rgba(37,99,235,0.12)]',
    COMPLETED: 'bg-accent-100 text-accent-700 border-accent-200',
    MAINTENANCE: 'bg-warning-100 text-warning-700 border-warning-200',
    ON_BREAK: 'bg-warning-100 text-warning-700 border-warning-200',
    HIGH: 'bg-warning-100 text-warning-700 border-warning-200',
    MEDIUM: 'bg-accent-100 text-accent-700 border-accent-200',
    LOW: 'bg-primary-100 text-primary-700 border-primary-200',
    CRITICAL: 'bg-danger-100 text-danger-700 border-danger-200 shadow-[0_1px_2px_rgba(220,38,38,0.14)]',
    CANCELLED: 'bg-danger-100 text-danger-700 border-danger-200',
    PLANNED: 'bg-violet-100 text-violet-700 border-violet-200',
    NEW: 'bg-violet-100 text-violet-700 border-violet-200',
    OUT_OF_SERVICE: 'bg-danger-100 text-danger-700 border-danger-200',
    READ: 'bg-dark-100 text-dark-500 border-dark-200',
    UNREAD: 'bg-violet-100 text-violet-700 border-violet-200',
    INACTIVE: 'bg-dark-100 text-dark-500 border-dark-200',
    OFF_DUTY: 'bg-dark-100 text-dark-500 border-dark-200',
};

const pulseFor = new Set(['ACTIVE', 'DRIVING', 'IN_PROGRESS', 'CRITICAL', 'AVAILABLE']);

export default function StatusBadge({ status }) {
    const key = String(status || '').toUpperCase();
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${colors[key] || 'bg-dark-100 text-dark-500 border-dark-200'}`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-current ${pulseFor.has(key) ? 'animate-pulse' : 'opacity-60'}`} />
            {String(status || '—').charAt(0) + String(status || '—').slice(1).toLowerCase().replace(/_/g, ' ')}
        </span>
    );
}

const colors = {
    ACTIVE: 'bg-success-500/10 text-success-400 border-success-500/20',
    INACTIVE: 'bg-dark-600/30 text-dark-400 border-dark-600/30',
    COMPLETED: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
    CANCELLED: 'bg-danger-500/10 text-danger-400 border-danger-500/20',
    MAINTENANCE: 'bg-warning-500/10 text-warning-400 border-warning-500/20',
    AVAILABLE: 'bg-success-500/10 text-success-400 border-success-500/20',
    DRIVING: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
    OFF_DUTY: 'bg-dark-600/30 text-dark-400 border-dark-600/30',
    ON_BREAK: 'bg-warning-500/10 text-warning-400 border-warning-500/20',
    OUT_OF_SERVICE: 'bg-danger-500/10 text-danger-400 border-danger-500/20',
};

export default function StatusBadge({ status }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status] || 'bg-dark-600/30 text-dark-400 border-dark-600/30'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' || status === 'AVAILABLE' || status === 'DRIVING' ? 'bg-current' : 'bg-current opacity-50'}`} />
            {status?.charAt(0) + status?.slice(1).toLowerCase().replace(/_/g, ' ')}
        </span>
    );
}

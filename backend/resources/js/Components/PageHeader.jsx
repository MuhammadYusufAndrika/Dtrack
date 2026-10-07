const ACCENTS = {
    blue: {
        label: 'text-primary-600',
        rule: 'from-primary-500 to-accent-500',
        grad: 'linear-gradient(100deg, #1d4ed8 0%, #2563eb 45%, #0891b2 100%)',
        dot: 'bg-primary-500',
    },
    cyan: {
        label: 'text-accent-600',
        rule: 'from-accent-500 to-primary-500',
        grad: 'linear-gradient(100deg, #0e7490 0%, #0891b2 45%, #2563eb 100%)',
        dot: 'bg-accent-500',
    },
    green: {
        label: 'text-success-600',
        rule: 'from-success-500 to-accent-500',
        grad: 'linear-gradient(100deg, #15803d 0%, #16a34a 45%, #0891b2 100%)',
        dot: 'bg-success-500',
    },
    violet: {
        label: 'text-violet-600',
        rule: 'from-violet-500 to-primary-500',
        grad: 'linear-gradient(100deg, #6d28d9 0%, #7c3aed 45%, #2563eb 100%)',
        dot: 'bg-violet-500',
    },
    amber: {
        label: 'text-warning-600',
        rule: 'from-warning-500 to-danger-500',
        grad: 'linear-gradient(100deg, #b45309 0%, #d97706 45%, #dc2626 100%)',
        dot: 'bg-warning-500',
    },
    rose: {
        label: 'text-danger-600',
        rule: 'from-danger-500 to-warning-500',
        grad: 'linear-gradient(100deg, #b91c1c 0%, #dc2626 45%, #d97706 100%)',
        dot: 'bg-danger-500',
    },
};

export default function PageHeader({ eyebrow, title, description, action, gradient = true, accent = 'blue' }) {
    const a = ACCENTS[accent] || ACCENTS.blue;
    return (
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between animate-fade-up">
            <div>
                {eyebrow && (
                    <p className={`text-[11px] font-bold uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2 ${a.label}`}>
                        <span className={`w-2 h-2 rounded-full ${a.dot}`} />
                        <span className={`w-6 h-px bg-gradient-to-r ${a.rule} inline-block`} />
                        {eyebrow}
                    </p>
                )}
                <h1
                    className="font-display text-2xl sm:text-3xl font-bold tracking-tight"
                    style={gradient ? { backgroundImage: a.grad, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color: '#0f1420' }}
                >
                    {title}
                </h1>
                {description && <p className="text-sm text-dark-400 mt-1.5 max-w-xl">{description}</p>}
            </div>
            {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
        </div>
    );
}

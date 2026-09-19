export default function PageHeader({ eyebrow, title, description, action, gradient = true }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between animate-fade-up">
            <div>
                {eyebrow && (
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-600 mb-1.5 flex items-center gap-2">
                        <span className="w-6 h-px bg-gradient-to-r from-primary-500 to-accent-500 inline-block" />
                        {eyebrow}
                    </p>
                )}
                <h1 className={`font-display text-2xl sm:text-3xl font-bold tracking-tight ${gradient ? 'text-gradient' : 'text-dark-50'}`}>
                    {title}
                </h1>
                {description && <p className="text-sm text-dark-400 mt-1.5 max-w-xl">{description}</p>}
            </div>
            {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
        </div>
    );
}

export default function GlassCard({ children, className = '', hover = false }) {
    return (
        <div className={`glass rounded-2xl ${hover ? 'glass-hover' : ''} ${className}`}>
            {children}
        </div>
    );
}

export function GlassSection({ title, subtitle, action, children, className = '' }) {
    return (
        <div className={`glass rounded-2xl overflow-hidden ${className}`}>
            {(title || action) && (
                <div className="px-5 py-4 border-b border-dark-200/60 flex items-center justify-between gap-3">
                    <div>
                        {title && <h3 className="text-sm font-semibold text-dark-900">{title}</h3>}
                        {subtitle && <p className="text-xs text-dark-400 mt-0.5">{subtitle}</p>}
                    </div>
                    {action}
                </div>
            )}
            <div className="p-5">{children}</div>
        </div>
    );
}

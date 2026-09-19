export function PageLoader({ label = 'Memuat...' }) {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 via-violet-500 to-accent-500 flex items-center justify-center text-2xl animate-float shadow-[0_0_40px_rgba(59,130,246,0.5)]">
                    🚛
                </div>
                <div className="absolute -inset-2 rounded-3xl border border-primary-500/30 animate-ping opacity-30" />
            </div>
            <div className="flex items-center gap-2 text-sm text-dark-400">
                <span className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                {label}
            </div>
        </div>
    );
}

export function Spinner({ className = 'w-5 h-5' }) {
    return <div className={`${className} border-2 border-white/40 border-t-white rounded-full animate-spin`} />;
}

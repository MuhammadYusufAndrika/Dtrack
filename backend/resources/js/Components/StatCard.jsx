export default function StatCard({ icon: Icon, label, value }) {
    return (
        <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                    {Icon && <Icon className="w-5 h-5 text-primary-400" />}
                </div>
                <div className="min-w-0">
                    <p className="text-xs text-dark-400 truncate">{label}</p>
                    <p className="text-sm font-semibold text-dark-100 truncate">{value}</p>
                </div>
            </div>
        </div>
    );
}

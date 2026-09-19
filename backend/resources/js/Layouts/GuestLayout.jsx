import { Truck, Radar, ShieldCheck, Navigation } from 'lucide-react';

export default function GuestLayout({ children }) {
    return (
        <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 py-10">
            <div className="absolute inset-0 pointer-events-none">
                <div className="orb orb-blue w-[480px] h-[480px] -top-40 -left-40" />
                <div className="orb orb-violet w-[420px] h-[420px] top-1/4 -right-32" />
                <div className="orb orb-cyan w-[300px] h-[300px] bottom-0 left-1/3" />
                <div className="absolute inset-0 opacity-[0.35]" style={{ backgroundImage: 'radial-gradient(rgba(148,163,184,0.18) 1px, transparent 1px)', backgroundSize: '26px 26px' }} />
            </div>

            <div className="relative w-full max-w-5xl mx-auto grid md:grid-cols-2 glass-strong rounded-3xl overflow-hidden animate-fade-up">
                <div className="hidden md:flex flex-col justify-between p-8 relative overflow-hidden bg-gradient-to-br from-primary-600 via-violet-600 to-accent-500">
                    <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
                    <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
                    <div className="relative flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500 via-violet-500 to-accent-500 flex items-center justify-center shadow-[0_10px_32px_rgba(59,130,246,0.5)]">
                            <Truck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <p className="font-display font-bold text-white leading-tight">FleetVision AI</p>
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">Fleet Tracking</p>
                        </div>
                    </div>
                    <div className="relative">
                        <h2 className="font-display text-3xl font-bold leading-tight text-white">
                            Pantau armada<br /><span className="underline decoration-white/60 underline-offset-4">real-time,</span><br />tanpa cemas.
                        </h2>
                        <div className="mt-6 space-y-3">
                            {[
                                { icon: Radar, text: 'Live GPS setiap 5 detik + peta interaktif' },
                                { icon: ShieldCheck, text: 'AI monitoring: seatbelt, fatigue, phone' },
                                { icon: Navigation, text: 'Trip & alert otomatis untuk admin' },
                            ].map(({ icon: Icon, text }) => (
                                <div key={text} className="flex items-center gap-3 text-sm text-white/90">
                                    <span className="w-8 h-8 rounded-xl bg-white/20 border border-white/25 flex items-center justify-center flex-shrink-0">
                                        <Icon className="w-4 h-4 text-white" />
                                    </span>
                                    {text}
                                </div>
                            ))}
                        </div>
                    </div>
                    <p className="relative text-[11px] text-white/70">© 2026 FleetVision AI · Secure fleet platform</p>
                </div>

                <div className="p-6 sm:p-10 flex flex-col justify-center">
                    <div className="md:hidden flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 via-violet-500 to-accent-500 flex items-center justify-center">
                            <Truck className="w-5 h-5 text-white" />
                        </div>
                        <p className="font-display font-bold text-dark-900">FleetVision AI</p>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}

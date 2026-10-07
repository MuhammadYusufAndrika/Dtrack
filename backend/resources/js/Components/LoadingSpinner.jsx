import { Truck } from 'lucide-react';

export function PageLoader({ label = 'Memuat...' }) {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-5">
            <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-primary-100" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary-500 border-r-primary-400 animate-spin" style={{ animationDuration: '1.1s' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Truck className="w-6 h-6 text-primary-600" />
                </div>
            </div>
            <p className="text-sm text-dark-400">{label}</p>
        </div>
    );
}

export function Spinner({ className = 'w-5 h-5' }) {
    return <div className={`${className} border-2 border-white/40 border-t-white rounded-full animate-spin`} />;
}

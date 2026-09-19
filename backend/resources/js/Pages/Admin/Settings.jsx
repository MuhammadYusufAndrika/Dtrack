import AdminLayout from '../../Layouts/AdminLayout';
import PageHeader from '../../Components/PageHeader';
import { Settings as SettingsIcon, User, Bell, Shield, ChevronRight } from 'lucide-react';

export default function Settings() {
    return (
        <AdminLayout>
            <div className="space-y-6">
                <PageHeader eyebrow="Preferences" title="Pengaturan" description="Kelola akun, notifikasi, dan keamanan." />
                <div className="grid sm:grid-cols-3 gap-4">
                    {[
                        { icon: User, title: 'Profil', desc: 'Data pribadi & akun', grad: 'from-primary-500 to-accent-500' },
                        { icon: Bell, title: 'Notifikasi', desc: 'Alert & preferensi', grad: 'from-warning-500 to-orange-400' },
                        { icon: Shield, title: 'Keamanan', desc: 'Password & autentikasi', grad: 'from-success-500 to-emerald-400' },
                    ].map(({ icon: Icon, title, desc, grad }) => (
                        <div key={title} className="glass glass-hover rounded-3xl p-5 cursor-pointer group">
                            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center mb-4`}><Icon className="w-5 h-5 text-white" /></div>
                            <div className="flex items-center justify-between">
                                <div><p className="text-sm font-bold text-dark-900">{title}</p><p className="text-xs text-dark-400 mt-0.5">{desc}</p></div>
                                <ChevronRight className="w-4 h-4 text-dark-500 group-hover:text-dark-900 group-hover:translate-x-0.5 transition-all" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
}

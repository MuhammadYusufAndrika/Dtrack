import AdminLayout from '../../Layouts/AdminLayout';
import PageHeader from '../../Components/PageHeader';
import { Settings as SettingsIcon, User, Bell, Shield, ChevronRight } from 'lucide-react';

export default function Settings() {
    return (
        <AdminLayout>
            <div className="space-y-6">
                <PageHeader eyebrow="Preferences" title="Pengaturan" description="Kelola akun, notifikasi, dan keamanan." accent="violet" />
                <div className="grid sm:grid-cols-3 gap-4">
                    {[
                        { icon: User, title: 'Profil', desc: 'Data pribadi & akun', grad: 'from-violet-500 to-primary-500', tint: 'tint-violet' },
                        { icon: Bell, title: 'Notifikasi', desc: 'Alert & preferensi', grad: 'from-primary-500 to-accent-500', tint: '' },
                        { icon: Shield, title: 'Keamanan', desc: 'Password & autentikasi', grad: 'from-accent-500 to-violet-500', tint: '' },
                    ].map(({ icon: Icon, title, desc, grad, tint }) => (
                        <div key={title} className={`glass glass-hover ${tint} rounded-3xl p-5 cursor-pointer group`}>
                            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center mb-4 shadow-lg`}><Icon className="w-5 h-5 text-white" /></div>
                            <div className="flex items-center justify-between">
                                <div><p className="text-sm font-bold text-dark-900">{title}</p><p className="text-xs text-dark-400 mt-0.5">{desc}</p></div>
                                <ChevronRight className="w-4 h-4 text-dark-500 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
}

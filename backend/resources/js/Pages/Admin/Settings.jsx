import AdminLayout from '../../Layouts/AdminLayout';
import { Settings as SettingsIcon, User, Bell, Shield } from 'lucide-react';

export default function Settings() {
    return (
        <AdminLayout>
            <div className="space-y-6">
                <div><h1 className="text-2xl font-bold text-dark-50">Settings</h1><p className="text-sm text-dark-400 mt-1">Manage your account and preferences</p></div>
                <div className="space-y-4">
                    {[
                        { icon: User, title: 'Profile', desc: 'Update your personal information' },
                        { icon: Bell, title: 'Notifications', desc: 'Configure alert preferences' },
                        { icon: Shield, title: 'Security', desc: 'Password and authentication settings' },
                    ].map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4 flex items-center gap-4 hover:bg-dark-800 transition-colors cursor-pointer">
                            <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center"><Icon className="w-5 h-5 text-primary-400" /></div>
                            <div><p className="text-sm font-semibold text-dark-100">{title}</p><p className="text-xs text-dark-400">{desc}</p></div>
                        </div>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
}

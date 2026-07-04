export default function GuestLayout({ children }) {
    return (
        <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">{children}</div>
        </div>
    );
}

export function PageLoader() {
    return (
        <div className="flex items-center justify-center h-[60vh]">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

export function Spinner() {
    return (
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    );
}

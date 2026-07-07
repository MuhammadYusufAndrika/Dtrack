/**
 * Authenticated fetch wrapper.
 * - Automatically attaches the Bearer token from localStorage.
 * - On a 401 Unauthorized response, clears credentials and redirects to /login.
 */
export async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('token');

    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
        // Token is invalid or expired – clear credentials and go to login
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        window.location.href = '/login';
        // Return a never-resolving promise so callers don't continue
        return new Promise(() => {});
    }

    return response;
}

'use client';
import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

const subscribe = (callback: () => void) => {
    queueMicrotask(callback);
    window.addEventListener('storage', callback);
    window.addEventListener('agroroute-auth-change', callback);

    return () => {
        window.removeEventListener('storage', callback);
        window.removeEventListener('agroroute-auth-change', callback);
    };
};
const getToken = () => localStorage.getItem('agroroute_token');
const getServerToken = () => undefined;

export default function RouteProtection({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const token = useSyncExternalStore(subscribe, getToken, getServerToken);

    useEffect(() => {
        if (token === null) {
            router.replace('/login');
        }
    }, [router, token]);

    if (!token) {
        return null;
    }

    return children;
}

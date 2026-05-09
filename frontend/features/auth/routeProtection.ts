'use client';
import { useEffect, useState } from "react";
import { createElement } from "react";
import { useRouter } from "next/navigation";
import LoadingScreen from "@/components/common/loadingScreen";

const subscribe = (callback: () => void) => {
    window.addEventListener('storage', callback);
    window.addEventListener('agroroute-auth-change', callback);

    return () => {
        window.removeEventListener('storage', callback);
        window.removeEventListener('agroroute-auth-change', callback);
    };
};

export default function RouteProtection({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [token, setToken] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        const syncToken = () => {
            setToken(localStorage.getItem('agroroute_token'));
        };

        syncToken();
        return subscribe(syncToken);
    }, []);

    useEffect(() => {
        if (token === null) {
            router.replace('/login');
        }
    }, [router, token]);

    if (token === undefined) {
        return createElement(LoadingScreen);
    }

    if (!token) {
        return null;
    }

    return children;
}

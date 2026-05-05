import RouteProtection from "@/features/auth/routeProtection";
import { NewAreaSelectionProvider } from "@/features/map/NewAreaSelectionContext";
import { Metadata } from "next";
import DashboardMap from "./DashboardMap";

export const metadata: Metadata = {
    title: "AgroRoute",
    description: "Sistema de roteamento agrícola",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {

    return (
        <RouteProtection>
            <NewAreaSelectionProvider>
                <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
                    <div style={{ flex: '0 0 auto', padding: '20px', overflowY: 'auto' }}>
                        {children}
                    </div>
                    <div style={{ flex: '1 1 auto', overflow: 'hidden' }}>
                        <DashboardMap />
                    </div>
                </div>
            </NewAreaSelectionProvider>
        </RouteProtection>
    );
}

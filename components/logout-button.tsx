"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SidebarMenuButton } from "@/components/ui/sidebar";

export function LogoutButton() {
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    };

    return (
        <SidebarMenuButton
            className="text-red-500 hover:text-red-700 hover:bg-red-50 w-full"
            onClick={handleLogout}
        >
            Sign Out
        </SidebarMenuButton>
    );
}

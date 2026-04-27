"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Monitor, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";

function LoginContent() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });

        setIsLoading(false);

        if (error) {
            toast({ title: "Login Failed", description: error.message, variant: "destructive" });
        } else {
            const inviteToken = searchParams.get('invite');
            if (inviteToken && authData.user) {
                const { data } = await supabase.rpc('accept_invite', {
                    invite_token: inviteToken,
                    user_id: authData.user.id
                });
                if (data?.success) {
                    toast({ title: `Joined ${data.organization_name}` });
                }
            }
            router.push("/dashboard");
            router.refresh();
        }
    };

    return (
        <div className="flex min-h-screen w-full bg-[#070710]">
            {/* Left panel — branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12">
                {/* Gradient orbs */}
                <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
                <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-indigo-500/10 blur-2xl" />

                {/* Grid pattern */}
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                        backgroundSize: '48px 48px'
                    }}
                />

                {/* Logo */}
                <div className="relative flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/30">
                        <Monitor className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold text-white">SignageHub</span>
                </div>

                {/* Center content */}
                <div className="relative space-y-6">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                            Digital Signage Platform
                        </div>
                        <h1 className="text-4xl font-bold leading-tight text-white">
                            Manage your entire screen network from one place
                        </h1>
                        <p className="text-slate-400 text-lg">
                            Push content, monitor displays, and orchestrate your digital signage infrastructure in real time.
                        </p>
                    </div>

                    {/* Feature list */}
                    <div className="space-y-3">
                        {[
                            "Real-time screen monitoring & heartbeat",
                            "Multi-zone layout rendering",
                            "Instant broadcast push events",
                        ].map((feature) => (
                            <div key={feature} className="flex items-center gap-3 text-slate-300 text-sm">
                                <div className="h-5 w-5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                                    <svg className="h-3 w-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                {feature}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom quote */}
                <div className="relative border-t border-white/5 pt-6">
                    <p className="text-slate-500 text-sm">&copy; {new Date().getFullYear()} SignageHub. All rights reserved.</p>
                </div>
            </div>

            {/* Right panel — login form */}
            <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-sm space-y-8">
                    {/* Mobile logo */}
                    <div className="flex lg:hidden items-center justify-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600">
                            <Monitor className="h-4.5 w-4.5 text-white" />
                        </div>
                        <span className="text-xl font-bold text-white">SignageHub</span>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-white">Welcome back</h2>
                        <p className="text-slate-400">Sign in to your account to continue</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-300 text-sm font-medium">Email address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@company.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500/20 h-11"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-slate-300 text-sm font-medium">Password</Label>
                                <Link href="#" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isLoading}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500/20 h-11 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-11 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 shadow-lg shadow-blue-500/25 text-white font-semibold gap-2"
                        >
                            {isLoading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</>
                            ) : (
                                <>Sign in <ArrowRight className="h-4 w-4" /></>
                            )}
                        </Button>
                    </form>

                    <p className="text-center text-sm text-slate-500">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
                            Create one free
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center bg-[#070710]">
                <div className="h-8 w-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    )
}

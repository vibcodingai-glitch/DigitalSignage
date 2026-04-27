"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Monitor, ArrowRight, Eye, EyeOff, Loader2, Users } from "lucide-react";

function RegisterContent() {
    const [fullName, setFullName] = useState("");
    const [organizationName, setOrganizationName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const supabase = createClient();

    const inviteToken = searchParams.get('invite');

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } }
            });

            if (authError) throw authError;

            if (authData.user) {
                if (inviteToken) {
                    const { data } = await supabase.rpc('accept_invite', {
                        invite_token: inviteToken,
                        user_id: authData.user.id
                    });
                    if (data?.success) {
                        toast({ title: `Joined ${data.organization_name}` });
                    } else {
                        toast({ title: "Failed to accept invite", variant: "destructive" });
                    }
                } else {
                    const randomStr = Math.random().toString(36).substring(2, 7);
                    const slug = `${organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${randomStr}`;

                    const { data: orgData, error: orgError } = await supabase
                        .from('organizations')
                        .insert({ name: organizationName, slug })
                        .select()
                        .single();

                    if (orgError) throw orgError;

                    const { error: profileError } = await supabase
                        .from('profiles')
                        .update({ organization_id: orgData.id, role: 'owner' })
                        .eq('id', authData.user.id);

                    if (profileError) throw profileError;

                    toast({ title: "Registration Successful", description: "Your account has been created." });
                }

                router.push("/dashboard");
                router.refresh();
            }
        } catch (error) {
            toast({
                title: "Registration Failed",
                description: (error as Error).message || "An error occurred during registration.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full bg-[#070710]">
            {/* Left panel — branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12">
                {/* Gradient orbs */}
                <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
                <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />
                <div className="absolute top-1/3 left-1/3 h-48 w-48 rounded-full bg-indigo-500/10 blur-2xl" />

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
                <div className="relative space-y-8">
                    {inviteToken ? (
                        <div className="space-y-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-600/20 border border-blue-500/20">
                                <Users className="h-7 w-7 text-blue-400" />
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-4xl font-bold text-white leading-tight">
                                    You&apos;ve been invited!
                                </h1>
                                <p className="text-slate-400 text-lg">
                                    Create your account to join your team and start collaborating on the SignageHub platform.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
                                Get started for free
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-4xl font-bold text-white leading-tight">
                                    Set up your signage network in minutes
                                </h1>
                                <p className="text-slate-400 text-lg">
                                    Create your workspace and start managing all your displays from a single, powerful dashboard.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Steps */}
                    <div className="space-y-4">
                        {[
                            { step: "1", label: "Create your account" },
                            { step: "2", label: "Add your first screen" },
                            { step: "3", label: "Upload content & go live" },
                        ].map((item) => (
                            <div key={item.step} className="flex items-center gap-4">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-xs font-bold text-white shadow-md shadow-blue-500/20">
                                    {item.step}
                                </div>
                                <span className="text-slate-300 text-sm">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative border-t border-white/5 pt-6">
                    <p className="text-slate-500 text-sm">&copy; {new Date().getFullYear()} SignageHub. All rights reserved.</p>
                </div>
            </div>

            {/* Right panel — form */}
            <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-sm space-y-8">
                    {/* Mobile logo */}
                    <div className="flex lg:hidden items-center justify-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600">
                            <Monitor className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-xl font-bold text-white">SignageHub</span>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-white">
                            {inviteToken ? "Accept your invitation" : "Create your account"}
                        </h2>
                        <p className="text-slate-400">
                            {inviteToken
                                ? "Fill in your details to join the team."
                                : "Start your free workspace today."}
                        </p>
                    </div>

                    {/* Invite banner */}
                    {inviteToken && (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                            <Users className="h-5 w-5 text-blue-400 shrink-0" />
                            <p className="text-sm text-blue-300">
                                You&apos;re joining an existing organization — no workspace setup needed.
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="full-name" className="text-slate-300 text-sm font-medium">Full name</Label>
                            <Input
                                id="full-name"
                                placeholder="Alex Johnson"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                disabled={isLoading}
                                className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500/20 h-11"
                            />
                        </div>

                        {!inviteToken && (
                            <div className="space-y-2">
                                <Label htmlFor="org-name" className="text-slate-300 text-sm font-medium">Organization name</Label>
                                <Input
                                    id="org-name"
                                    placeholder="Acme Corp"
                                    required
                                    value={organizationName}
                                    onChange={(e) => setOrganizationName(e.target.value)}
                                    disabled={isLoading}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500/20 h-11"
                                />
                            </div>
                        )}

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
                            <Label htmlFor="password" className="text-slate-300 text-sm font-medium">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Min. 8 characters"
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
                            className="w-full h-11 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 shadow-lg shadow-blue-500/25 text-white font-semibold gap-2 mt-2"
                        >
                            {isLoading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</>
                            ) : (
                                <>{inviteToken ? "Join team" : "Create account"} <ArrowRight className="h-4 w-4" /></>
                            )}
                        </Button>
                    </form>

                    <p className="text-center text-sm text-slate-500">
                        Already have an account?{" "}
                        <Link href="/login" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center bg-[#070710]">
                <div className="h-8 w-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            </div>
        }>
            <RegisterContent />
        </Suspense>
    )
}

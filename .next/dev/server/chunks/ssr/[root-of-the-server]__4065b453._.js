module.exports = [
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/src/lib/supabase.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/index.mjs [app-ssr] (ecmascript) <locals>");
;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas. Verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY');
}
const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        multiTab: false,
        storage: ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : undefined
    }
});
}),
"[project]/src/lib/profiles.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "consumePendingProfileSeed",
    ()=>consumePendingProfileSeed,
    "ensureProfileForUser",
    ()=>ensureProfileForUser,
    "hydrateParticipantsWithProfiles",
    ()=>hydrateParticipantsWithProfiles,
    "savePendingProfileSeed",
    ()=>savePendingProfileSeed
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase.ts [app-ssr] (ecmascript)");
;
const PENDING_PROFILE_KEY = 'divideai_pending_profile_seed';
function normalizeUsername(raw) {
    return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}
function fallbackFullName(user) {
    const metadata = user.user_metadata || {};
    const fromMetadata = String(metadata.full_name || '').trim();
    if (fromMetadata) return fromMetadata;
    return user.email?.split('@')[0] || 'Usuario';
}
function fallbackUsername(user) {
    const metadata = user.user_metadata || {};
    const fromMetadata = normalizeUsername(String(metadata.username || ''));
    if (fromMetadata) return fromMetadata;
    const fromEmail = normalizeUsername(user.email?.split('@')[0] || '');
    if (fromEmail) return fromEmail;
    return `user_${String(user.id).replace(/-/g, '').slice(0, 8)}`;
}
function isDuplicateError(error) {
    const code = error?.code;
    const message = String(error?.message || '').toLowerCase();
    return code === '23505' || message.includes('duplicate');
}
function isMissingProfileError(error) {
    const code = error?.code;
    return code === 'PGRST116';
}
function savePendingProfileSeed(seed) {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
}
function consumePendingProfileSeed(userId) {
    if ("TURBOPACK compile-time truthy", 1) return null;
    //TURBOPACK unreachable
    ;
    const raw = undefined;
}
async function ensureProfileForUser(user, seed) {
    const current = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('profiles').select('id,username,full_name,is_premium,created_at').eq('id', user.id).maybeSingle();
    if (current.data) return current.data;
    if (current.error && !isMissingProfileError(current.error)) {
        throw current.error;
    }
    const baseUsername = normalizeUsername(seed?.username || '') || fallbackUsername(user);
    const fullName = (seed?.fullName || '').trim() || fallbackFullName(user);
    for(let attempt = 0; attempt < 4; attempt += 1){
        const username = attempt === 0 ? baseUsername : `${baseUsername}_${attempt + 1}`;
        const insert = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('profiles').insert({
            id: user.id,
            username,
            full_name: fullName,
            is_premium: false
        }).select('id,username,full_name,is_premium,created_at').single();
        if (!insert.error) {
            return insert.data;
        }
        if (isDuplicateError(insert.error)) continue;
        throw insert.error;
    }
    throw new Error('username_already_taken');
}
async function hydrateParticipantsWithProfiles(participants) {
    if (!Array.isArray(participants) || participants.length === 0) return participants;
    const userIds = Array.from(new Set(participants.map((p)=>String(p?.user_id || '').trim()).filter(Boolean)));
    if (userIds.length === 0) return participants;
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('profiles').select('id,username').in('id', userIds);
    if (error) return participants;
    const usernameMap = new Map();
    for (const row of data || []){
        const id = String(row.id || '');
        const username = String(row.username || '');
        if (id && username) usernameMap.set(id, username);
    }
    return participants.map((p)=>{
        const userId = String(p.user_id || '').trim();
        if (!userId) return p;
        const username = usernameMap.get(userId);
        if (!username) return p;
        return {
            ...p,
            name: username,
            display_name: p.display_name || p.name || p.email || username
        };
    });
}
}),
"[project]/src/lib/invites.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "acceptInviteToken",
    ()=>acceptInviteToken,
    "clearPendingInviteToken",
    ()=>clearPendingInviteToken,
    "consumePendingInviteToken",
    ()=>consumePendingInviteToken,
    "generateSecureInviteToken",
    ()=>generateSecureInviteToken,
    "peekPendingInviteToken",
    ()=>peekPendingInviteToken,
    "savePendingInviteToken",
    ()=>savePendingInviteToken
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase.ts [app-ssr] (ecmascript)");
;
const PENDING_INVITE_TOKEN_KEY = 'invite_token';
function decodeBase64Url(bytes) {
    let binary = '';
    for(let i = 0; i < bytes.length; i += 1){
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function generateSecureInviteToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return decodeBase64Url(bytes);
}
function savePendingInviteToken(token) {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
}
function consumePendingInviteToken() {
    if ("TURBOPACK compile-time truthy", 1) return null;
    //TURBOPACK unreachable
    ;
    const token = undefined;
}
function peekPendingInviteToken() {
    if ("TURBOPACK compile-time truthy", 1) return null;
    //TURBOPACK unreachable
    ;
}
function clearPendingInviteToken() {
    if ("TURBOPACK compile-time truthy", 1) return;
    //TURBOPACK unreachable
    ;
}
async function getInviteTokenRow(token) {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('invite_tokens').select('id,group_id,token,expires_at').eq('token', token).single();
    if (error || !data) {
        throw new Error('Convite invalido');
    }
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
        throw new Error('Convite expirado');
    }
    return data;
}
async function acceptInviteToken(token, userId) {
    const invite = await getInviteTokenRow(token);
    const { data: existingParticipant, error: existingParticipantError } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('participants').select('id').eq('group_id', invite.group_id).eq('user_id', userId).maybeSingle();
    if (existingParticipantError) {
        throw existingParticipantError;
    }
    if (existingParticipant) return invite.group_id;
    try {
        const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].from('participants').insert({
            group_id: invite.group_id,
            user_id: userId,
            role: 'member'
        });
        if (error) throw error;
    } catch (error) {
        const code = String(error?.code || '');
        if (code !== '23505') {
            throw error;
        }
    }
    return invite.group_id;
}
}),
"[project]/src/context/AuthContext.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthProvider",
    ()=>AuthProvider,
    "useAuth",
    ()=>useAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$profiles$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/profiles.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$invites$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/invites.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
const AuthContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])({
    user: null,
    session: null,
    loading: true
});
function AuthProvider({ children }) {
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [session, setSession] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const ensureIdentity = async (sessionUser)=>{
            if (!sessionUser) return;
            const pendingSeed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$profiles$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["consumePendingProfileSeed"])(sessionUser.id);
            try {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$profiles$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ensureProfileForUser"])(sessionUser, {
                    username: pendingSeed?.username,
                    fullName: pendingSeed?.fullName
                });
            } catch (error) {
                const code = String(error?.code || '');
                const message = String(error?.message || '').toLowerCase();
                const expected = code === '42P01' || code === '42501' || message.includes('relation') || message.includes('profiles') || message.includes('permission denied');
                if (!expected) {
                    console.error('auth.ensure-profile-error', error);
                }
            }
            const pendingInviteToken = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$invites$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["peekPendingInviteToken"])();
            if (!pendingInviteToken) return;
            try {
                const groupId = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$invites$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["acceptInviteToken"])(pendingInviteToken, sessionUser.id);
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$invites$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clearPendingInviteToken"])();
                if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
                ;
            } catch  {
            // keep token for retry
            }
        };
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].auth.getSession().then(async ({ data: { session } })=>{
            setSession(session);
            setUser(session?.user ?? null);
            await ensureIdentity(session?.user ?? null);
            setLoading(false);
        });
        const { data: { subscription } } = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["supabase"].auth.onAuthStateChange(async (_event, session)=>{
            setSession(session);
            setUser(session?.user ?? null);
            await ensureIdentity(session?.user ?? null);
            setLoading(false);
        });
        return ()=>subscription.unsubscribe();
    }, []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthContext.Provider, {
        value: {
            user,
            session,
            loading
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/src/context/AuthContext.tsx",
        lineNumber: 85,
        columnNumber: 5
    }, this);
}
const useAuth = ()=>{
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[project]/src/components/AuthGate.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthGate",
    ()=>AuthGate
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/context/AuthContext.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
;
;
;
function AuthGate({ children }) {
    const { user, loading } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAuth"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouter"])();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["usePathname"])();
    const isInviteRoute = pathname.startsWith('/invite/');
    const isAuthRoute = pathname === '/login' || pathname === '/signup' || pathname === '/register' || pathname === '/forgot-password' || pathname === '/reset-password';
    const isPublicRoute = isAuthRoute || isInviteRoute;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (loading) return;
        // Se não tem usuário e não está em rota pública, redireciona para login
        if (!user && !isPublicRoute) {
            router.replace('/login');
        }
        // Se tem usuário e está em rota pública, redireciona para home
        if (user && isAuthRoute) {
            router.replace('/');
        }
    }, [
        user,
        loading,
        isPublicRoute,
        isAuthRoute,
        router,
        pathname
    ]);
    // Mostrar loading enquanto verifica sessão
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "min-h-screen bg-gradient-to-br from-[#5BC5A7] to-[#4AB396] flex items-center justify-center",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-white text-lg",
                children: "Carregando..."
            }, void 0, false, {
                fileName: "[project]/src/components/AuthGate.tsx",
                lineNumber: 40,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/components/AuthGate.tsx",
            lineNumber: 39,
            columnNumber: 7
        }, this);
    }
    // Se não tem usuário e não está em rota pública, não renderiza nada (vai redirecionar)
    if (!user && !isPublicRoute) {
        return null;
    }
    // Se tem usuário e está em rota pública, não renderiza nada (vai redirecionar)
    if (user && isAuthRoute) {
        return null;
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: children
    }, void 0, false);
}
}),
"[project]/src/components/AppProviders.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AppProviders",
    ()=>AppProviders
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/context/AuthContext.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$AuthGate$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/AuthGate.tsx [app-ssr] (ecmascript)");
'use client';
;
;
;
function AppProviders({ children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AuthProvider"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$AuthGate$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AuthGate"], {
            children: children
        }, void 0, false, {
            fileName: "[project]/src/components/AppProviders.tsx",
            lineNumber: 9,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/components/AppProviders.tsx",
        lineNumber: 8,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__4065b453._.js.map
(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/lib/supabase.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/index.mjs [app-client] (ecmascript) <locals>");
;
const supabaseUrl = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas. Verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY');
}
const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        multiTab: false,
        storage: ("TURBOPACK compile-time truthy", 1) ? window.localStorage : "TURBOPACK unreachable"
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/profiles.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase.ts [app-client] (ecmascript)");
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
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    window.localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(seed));
}
function consumePendingProfileSeed(userId) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const raw = window.localStorage.getItem(PENDING_PROFILE_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (String(parsed.userId) !== String(userId)) return null;
        window.localStorage.removeItem(PENDING_PROFILE_KEY);
        return parsed;
    } catch  {
        window.localStorage.removeItem(PENDING_PROFILE_KEY);
        return null;
    }
}
async function ensureProfileForUser(user, seed) {
    const current = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from('profiles').select('id,username,full_name,is_premium,created_at').eq('id', user.id).maybeSingle();
    if (current.data) return current.data;
    if (current.error && !isMissingProfileError(current.error)) {
        throw current.error;
    }
    const baseUsername = normalizeUsername(seed?.username || '') || fallbackUsername(user);
    const fullName = (seed?.fullName || '').trim() || fallbackFullName(user);
    for(let attempt = 0; attempt < 4; attempt += 1){
        const username = attempt === 0 ? baseUsername : `${baseUsername}_${attempt + 1}`;
        const insert = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from('profiles').insert({
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
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from('profiles').select('id,username').in('id', userIds);
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/lib/invites.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase.ts [app-client] (ecmascript)");
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
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    window.localStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
}
function consumePendingInviteToken() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const token = window.localStorage.getItem(PENDING_INVITE_TOKEN_KEY);
    if (token) {
        window.localStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
    }
    return token;
}
function peekPendingInviteToken() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return window.localStorage.getItem(PENDING_INVITE_TOKEN_KEY);
}
function clearPendingInviteToken() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    window.localStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
}
async function getInviteTokenRow(token) {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from('invite_tokens').select('id,group_id,token,expires_at').eq('token', token).single();
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
    const { data: existingParticipant, error: existingParticipantError } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from('participants').select('id').eq('group_id', invite.group_id).eq('user_id', userId).maybeSingle();
    if (existingParticipantError) {
        throw existingParticipantError;
    }
    if (existingParticipant) return invite.group_id;
    try {
        const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from('participants').insert({
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/context/AuthContext.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthProvider",
    ()=>AuthProvider,
    "useAuth",
    ()=>useAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$profiles$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/profiles.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$invites$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/invites.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
;
;
const AuthContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])({
    user: null,
    session: null,
    loading: true
});
function AuthProvider({ children }) {
    _s();
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [session, setSession] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthProvider.useEffect": ()=>{
            const ensureIdentity = {
                "AuthProvider.useEffect.ensureIdentity": async (sessionUser)=>{
                    if (!sessionUser) return;
                    const pendingSeed = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$profiles$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["consumePendingProfileSeed"])(sessionUser.id);
                    try {
                        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$profiles$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ensureProfileForUser"])(sessionUser, {
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
                    const pendingInviteToken = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$invites$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["peekPendingInviteToken"])();
                    if (!pendingInviteToken) return;
                    try {
                        const groupId = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$invites$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["acceptInviteToken"])(pendingInviteToken, sessionUser.id);
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$invites$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clearPendingInviteToken"])();
                        if (("TURBOPACK compile-time value", "object") !== 'undefined' && window.location.pathname !== `/group/${groupId}`) {
                            window.location.replace(`/group/${groupId}`);
                        }
                    } catch  {
                    // keep token for retry
                    }
                }
            }["AuthProvider.useEffect.ensureIdentity"];
            __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.getSession().then({
                "AuthProvider.useEffect": async ({ data: { session } })=>{
                    setSession(session);
                    setUser(session?.user ?? null);
                    await ensureIdentity(session?.user ?? null);
                    setLoading(false);
                }
            }["AuthProvider.useEffect"]);
            const { data: { subscription } } = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.onAuthStateChange({
                "AuthProvider.useEffect": async (_event, session)=>{
                    setSession(session);
                    setUser(session?.user ?? null);
                    await ensureIdentity(session?.user ?? null);
                    setLoading(false);
                }
            }["AuthProvider.useEffect"]);
            return ({
                "AuthProvider.useEffect": ()=>subscription.unsubscribe()
            })["AuthProvider.useEffect"];
        }
    }["AuthProvider.useEffect"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthContext.Provider, {
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
_s(AuthProvider, "sIDOCMze9iVqwxkgWIhOu8vskSI=");
_c = AuthProvider;
const useAuth = ()=>{
    _s1();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
_s1(useAuth, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
var _c;
__turbopack_context__.k.register(_c, "AuthProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/AuthGate.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthGate",
    ()=>AuthGate
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/context/AuthContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
function AuthGate({ children }) {
    _s();
    const { user, loading } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    const isInviteRoute = pathname.startsWith('/invite/');
    const isAuthRoute = pathname === '/login' || pathname === '/signup' || pathname === '/register' || pathname === '/forgot-password' || pathname === '/reset-password';
    const isPublicRoute = isAuthRoute || isInviteRoute;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthGate.useEffect": ()=>{
            if (loading) return;
            // Se não tem usuário e não está em rota pública, redireciona para login
            if (!user && !isPublicRoute) {
                router.replace('/login');
            }
            // Se tem usuário e está em rota pública, redireciona para home
            if (user && isAuthRoute) {
                router.replace('/');
            }
        }
    }["AuthGate.useEffect"], [
        user,
        loading,
        isPublicRoute,
        isAuthRoute,
        router,
        pathname
    ]);
    // Mostrar loading enquanto verifica sessão
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "min-h-screen bg-gradient-to-br from-[#5BC5A7] to-[#4AB396] flex items-center justify-center",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: children
    }, void 0, false);
}
_s(AuthGate, "+V/1yikrC2yNn6BpNR6HilodE6g=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"]
    ];
});
_c = AuthGate;
var _c;
__turbopack_context__.k.register(_c, "AuthGate");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/AppProviders.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AppProviders",
    ()=>AppProviders
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/context/AuthContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$AuthGate$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/AuthGate.tsx [app-client] (ecmascript)");
'use client';
;
;
;
function AppProviders({ children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$context$2f$AuthContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AuthProvider"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$AuthGate$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AuthGate"], {
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
_c = AppProviders;
var _c;
__turbopack_context__.k.register(_c, "AppProviders");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=src_a519165f._.js.map
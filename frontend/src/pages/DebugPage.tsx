import { useEffect, useState } from "react";

export default function DebugPage() {
    const [info, setInfo] = useState<any>({});

    useEffect(() => {
        setInfo({
            origin: window.location.origin,
            href: window.location.href,
            googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ? "Present" : "Missing",
            supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? "Present" : "Missing"
        });
    }, []);

    return (
        <div style={{ padding: 40, fontFamily: 'monospace' }}>
            <h1>Debug Info</h1>
            <pre>{JSON.stringify(info, null, 2)}</pre>
            <hr />
            <button onClick={() => {
                const redirectUri = window.location.origin + '/admin';
                alert("Redirect URI would be: " + redirectUri);
            }}>
                Test Redirect URI
            </button>
        </div>
    );
}

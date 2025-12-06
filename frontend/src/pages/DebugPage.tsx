import { useEffect, useState } from "react";

export default function DebugPage() {
    const [info, setInfo] = useState<any>({});
    const [testResult, setTestResult] = useState<string>("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setInfo({
            origin: window.location.origin,
            href: window.location.href,
            googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ? "Present" : "Missing",
            supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? "Present" : "Missing",
            supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? "Present" : "Missing",
        });
    }, []);

    const testHandleChat = async () => {
        setLoading(true);
        setTestResult("Testing connection...");
        try {
            const { supabase } = await import("../supabaseClient");

            // 1. Test Ping (Reachability & Env Vars)
            const startPing = Date.now();
            const { data: pingData, error: pingError } = await supabase.functions.invoke('handle-chat', {
                body: { action: 'ping' }
            });
            const pingDuration = Date.now() - startPing;

            let resultMsg = "";

            if (pingError) {
                console.error("Ping Error:", pingError);
                resultMsg += `❌ Connection Failed (${pingDuration}ms)\nError: ${pingError.message || JSON.stringify(pingError)}\n\nPossible causes:\n- Edge Functions not running (run 'supabase start')\n- CORS issues\n- Wrong VITE_SUPABASE_URL`;
            } else {
                resultMsg += `✅ Connection Successful (${pingDuration}ms)\nResponse: ${JSON.stringify(pingData, null, 2)}\n\n`;

                // 2. Test actual chat if ping worked
                if (pingData?.success) {
                    resultMsg += "Testing Chat Logic...\n";
                    const startChat = Date.now();
                    const { data: chatData, error: chatError } = await supabase.functions.invoke('handle-chat', {
                        body: { userMessage: "Hello, debug test." }
                    });
                    const chatDuration = Date.now() - startChat;

                    if (chatError) {
                        resultMsg += `❌ Chat Logic Failed (${chatDuration}ms): ${chatError.message}`;
                    } else {
                        resultMsg += `✅ Chat Logic Success (${chatDuration}ms): \n${JSON.stringify(chatData, null, 2)}`;
                    }
                }
            }
            setTestResult(resultMsg);

        } catch (err: any) {
            setTestResult(`Exception: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const testAuthRedirect = async () => {
        const { supabase } = await import("../supabaseClient");
        const redirectUrl = window.location.origin + '/admin';
        alert(`Please ensure '${redirectUrl}' is added to your Supabase Auth -> URL Configuration -> Redirect URLs.`);
    };

    return (
        <div style={{ padding: 40, fontFamily: 'monospace' }}>
            <h1>Debug Info</h1>
            <pre>{JSON.stringify(info, null, 2)}</pre>
            <hr />
            <div style={{ display: 'flex', gap: 10, flexDirection: 'column', maxWidth: 400 }}>
                <button disabled={loading} onClick={testHandleChat} style={{ padding: 10, cursor: 'pointer' }}>
                    Test 'handle-chat' Function
                </button>
                <button onClick={testAuthRedirect} style={{ padding: 10, cursor: 'pointer' }}>
                    Check Auth Redirect URL
                </button>
            </div>

            <div style={{ marginTop: 20, whiteSpace: 'pre-wrap', background: '#f0f0f0', padding: 10 }}>
                <strong>Test Result:</strong>
                <br />
                {testResult}
            </div>
        </div>
    );
}

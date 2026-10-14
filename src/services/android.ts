// The APK exposes only HTTPS quote reads and Android's document save picker.
// Web builds continue to use the existing Node API and browser downloads.
declare global {
  interface Window {
    AssetAndroid?: { request(id: string, method: string, payload: string): void };
    assetAndroidResult?: (id: string, result: { value?: unknown; error?: string }) => void;
  }
}
export const isAndroidApp = () => typeof window !== "undefined" && !!window.AssetAndroid;
const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
let sequence = 0;
export function nativeRequest<T>(method: "fetch" | "save", payload: unknown, timeout = 20_000): Promise<T> {
  if (!isAndroidApp()) return Promise.reject(new Error("Android 앱에서만 사용할 수 있습니다."));
  window.assetAndroidResult = (id, result) => {
    const call = pending.get(id);
    if (!call) return;
    if (result.error) call.reject(new Error(result.error)); else call.resolve(result.value);
  };
  return new Promise<T>((resolve, reject) => {
    const id = String(++sequence);
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("요청 시간이 초과되었습니다.")); }, timeout);
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); pending.delete(id); resolve(value as T); },
      reject: (error) => { clearTimeout(timer); pending.delete(id); reject(error); },
    });
    try { window.AssetAndroid!.request(id, method, JSON.stringify(payload)); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
}

package com.assetstrategy.dashboard;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.view.View;
import android.view.WindowInsets;
import org.json.JSONObject;
import java.io.*;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String ORIGIN = "https://" + HOST;
    private WebView web;
    private final ExecutorService workers = Executors.newFixedThreadPool(4);
    private ValueCallback<Uri[]> fileCallback;
    private String saveId, saveContent;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        android.widget.FrameLayout root = new android.widget.FrameLayout(this);
        root.addView(web, new android.widget.FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        // Account for Android 15 edge-to-edge and the keyboard without hiding controls.
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets.consumeSystemWindowInsets();
        });
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // SAF-picked JSON file input, no broad storage permission.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.addJavascriptInterface(new NativeBridge(), "AssetAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!HOST.equals(uri.getHost()) || !"https".equals(uri.getScheme())) return null;
                String path = uri.getPath();
                if (path == null || path.equals("/")) path = "/index.html";
                if (path.contains("..") || path.contains("\\")) return missing();
                try {
                    String mime = path.endsWith(".js") ? "text/javascript" : path.endsWith(".css") ? "text/css" : path.endsWith(".svg") ? "image/svg+xml" : "text/html";
                    WebResourceResponse result = new WebResourceResponse(mime, "UTF-8", getAssets().open("public" + path));
                    result.setResponseHeaders(Map.of("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss://api.upbit.com; frame-src 'none'; object-src 'none'; base-uri 'none'", "X-Content-Type-Options", "nosniff"));
                    return result;
                } catch (IOException e) { return missing(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost()) && "https".equals(uri.getScheme())) return false;
                if (request.isForMainFrame() && "https".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
                try { startActivityForResult(intent, 100); }
                catch (Exception e) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
            @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new android.app.AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("확인", (d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();
                return true;
            }
        });
        web.loadUrl(ORIGIN + "/index.html");
    }
    private WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", Map.of(), new ByteArrayInputStream(new byte[0]));
    }
    private void complete(String id, Object value, String error) {
        try {
            JSONObject result = new JSONObject();
            if (error != null) result.put("error", error); else result.put("value", value);
            String script = "window.assetAndroidResult&&window.assetAndroidResult(" + JSONObject.quote(id) + "," + result + ")";
            runOnUiThread(() -> { if (!isDestroyed()) web.evaluateJavascript(script, null); });
        } catch (Exception ignored) {}
    }
    final class NativeBridge {
        @JavascriptInterface public void request(String id, String method, String raw) {
            if (id == null || !id.matches("[0-9]{1,12}") || raw == null || raw.length() > 1_100_000) return;
            try {
                JSONObject input = new JSONObject(raw);
                if (method.equals("fetch")) {
                    final String url = input.getString("url");
                    if (!allowedQuoteUrl(url)) { complete(id, null, "허용되지 않는 시세 주소입니다."); return; }
                    workers.execute(() -> fetchQuote(id, url));
                } else if (method.equals("save")) {
                    String content = input.getString("content");
                    String name = input.getString("name");
                    if (content.length() > 1_000_000 || !name.matches("[a-zA-Z0-9_-]+\\.json")) throw new Exception();
                    runOnUiThread(() -> {
                        if (saveId != null) { complete(id, null, "열려 있는 저장 창을 먼저 닫으세요."); return; }
                        saveId = id; saveContent = content;
                        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE, name);
                        try { startActivityForResult(intent, 101); }
                        catch (Exception e) { saveId = null; saveContent = null; complete(id, null, "파일 저장 창을 열 수 없습니다."); }
                    });
                } else complete(id, null, "지원하지 않는 요청입니다.");
            } catch (Exception e) { complete(id, null, "요청 형식을 확인하세요."); }
        }
    }
    static boolean allowedQuoteUrl(String raw) {
        try {
            URL url = new URL(raw);
            if (!url.getProtocol().equals("https") || url.getUserInfo() != null || url.getPort() != -1 || url.getRef() != null) return false;
            if (url.getHost().equals("api.upbit.com")) return url.getPath().equals("/v1/ticker") && "markets=KRW-CC".equals(url.getQuery());
            if (!url.getHost().equals("query1.finance.yahoo.com") && !url.getHost().equals("query2.finance.yahoo.com")) return false;
            return "interval=1m&range=1d".equals(url.getQuery()) && url.getPath().matches("/v8/finance/chart/(?:[A-Z]{1,10}(?:[.-][A-Z]{1,2})?|[0-9]{6}\\.K[QS]|KRW%3DX)");
        } catch (Exception e) { return false; }
    }
    private void fetchQuote(String id, String address) {
        HttpsURLConnection connection = null;
        try {
            connection = (HttpsURLConnection) new URL(address).openConnection();
            connection.setConnectTimeout(7000); connection.setReadTimeout(7000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 AssetStrategyDashboard/1.0");
            connection.setRequestProperty("Accept", "application/json");
            int status = connection.getResponseCode();
            String body = "{}";
            if (status >= 200 && status < 300) {
                try (InputStream stream = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[8192]; int size;
                    while ((size = stream.read(buffer)) != -1) {
                        if (out.size() + size > 2_000_000) throw new IOException("response too large");
                        out.write(buffer, 0, size);
                    }
                    body = out.toString(StandardCharsets.UTF_8.name());
                }
            }
            complete(id, new JSONObject().put("status", status).put("body", body), null);
        } catch (Exception e) { complete(id, null, "시세 HTTPS 연결에 실패했습니다. 인터넷 연결을 확인하세요."); }
        finally { if (connection != null) connection.disconnect(); }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
        if (request == 100 && fileCallback != null) {
            fileCallback.onReceiveValue(uri == null ? null : new Uri[]{uri}); fileCallback = null;
        }
        if (request == 101 && saveId != null) {
            String id = saveId, content = saveContent; saveId = null; saveContent = null;
            if (uri == null) { complete(id, false, null); return; }
            workers.execute(() -> {
                try (OutputStream output = getContentResolver().openOutputStream(uri, "wt")) {
                    if (output == null) throw new IOException();
                    output.write(content.getBytes(StandardCharsets.UTF_8));
                    complete(id, true, null);
                    runOnUiThread(() -> android.widget.Toast.makeText(this, "JSON 백업을 저장했습니다.", android.widget.Toast.LENGTH_LONG).show());
                } catch (Exception e) { complete(id, null, "백업 파일을 저장하지 못했습니다."); }
            });
        }
    }
    @Override public void onBackPressed() {
        web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return true}return false})()", value -> {
            if (!"true".equals(value)) new android.app.AlertDialog.Builder(this).setMessage("앱을 닫을까요? 입력값은 이 기기에 저장됩니다.").setNegativeButton("취소",null).setPositiveButton("닫기",(d,w)->finish()).show();
        });
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        web.removeJavascriptInterface("AssetAndroid"); web.destroy(); workers.shutdownNow();
        super.onDestroy();
    }
}

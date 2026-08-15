package app.ligazikachu;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.URLUtil;
import android.widget.Toast;

import com.google.firebase.messaging.FirebaseMessaging;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://liga-zikachu.vercel.app";
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 1002;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingUrl = null;

    // JavaScript bridge para comunicação WebView ↔ Android
    public class AndroidBridge {
        @JavascriptInterface
        public String getFcmToken() {
            return getSharedPreferences("fcm", MODE_PRIVATE).getString("token", "");
        }

        @JavascriptInterface
        public void reportFcmRegistration(int status) {
            getSharedPreferences("fcm", MODE_PRIVATE).edit()
                .putInt("web_http_status", status)
                .putLong("web_attempted_at", System.currentTimeMillis())
                .apply();
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#1A1A2E"));
        window.setNavigationBarColor(Color.parseColor("#020617"));

        webView = new WebView(this);
        webView.setSystemUiVisibility(0);
        setContentView(webView);

        requestNotificationPermissionIfNeeded();

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Expor bridge para o JavaScript
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("liga-zikachu.vercel.app".equals(uri.getHost())) {
                    return false;
                }
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                CookieManager.getInstance().flush();
                if (pendingUrl != null && !url.contains("/login")) {
                    String target = pendingUrl;
                    pendingUrl = null;
                    view.loadUrl(withCacheBuster(target));
                    return;
                }
                // Após carregar a página, registrar o token FCM no servidor
                registerFcmToken();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                WebView view,
                ValueCallback<Uri[]> callback,
                FileChooserParams params
            ) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (Exception error) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                openInExternalBrowser(url);
                return;
            }
            try {
                String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setTitle(fileName);
                request.setDescription("Baixando atualização da Liga Zikachu");
                request.setMimeType(mimeType);
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                if (userAgent != null) request.addRequestHeader("User-Agent", userAgent);
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null && !cookies.isEmpty()) request.addRequestHeader("Cookie", cookies);

                DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (manager == null) throw new IllegalStateException("Gerenciador de downloads indisponível");
                manager.enqueue(request);
                Toast.makeText(this, "Download iniciado. Acompanhe pela notificação do Android.", Toast.LENGTH_LONG).show();
            } catch (Exception error) {
                openInExternalBrowser(url);
            }
        });

        refreshFcmTokenIfNeeded();

        // Verificar se abriu por notificação com URL específica
        pendingUrl = resolveNotificationUrl(getIntent());

        if (pendingUrl != null) {
            webView.loadUrl(withCacheBuster(APP_URL + "/dashboard"));
        } else if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    private void refreshFcmTokenIfNeeded() {
        final String refreshVersion = "firebase-app-restored-0.7.6";
        final android.content.SharedPreferences preferences =
            getSharedPreferences("fcm", MODE_PRIVATE);

        if (!refreshVersion.equals(preferences.getString("refresh_version", ""))) {
            // O app Firebase foi restaurado no mesmo projeto. Tokens mantidos por
            // instalações anteriores podem existir localmente, mas o FCM já os
            // considera inválidos. A renovação acontece uma única vez nesta versão.
            FirebaseMessaging.getInstance().deleteToken().addOnCompleteListener(task -> {
                preferences.edit().remove("token").apply();
                requestAndStoreFcmToken(preferences, refreshVersion);
            });
            return;
        }

        requestAndStoreFcmToken(preferences, refreshVersion);
    }

    private void requestAndStoreFcmToken(
        android.content.SharedPreferences preferences,
        String refreshVersion
    ) {
        preferences.edit().putString("token_status", "requesting").apply();
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
            preferences.edit()
                .putString("token", token)
                .putString("refresh_version", refreshVersion)
                .putString("token_status", "ready")
                .apply();
            // O token chega depois de a primeira página terminar de carregar.
            // Registre-o imediatamente, sem depender de uma nova navegação.
            if (webView != null) webView.post(() -> registerFcmToken(0));
        }).addOnFailureListener(error -> preferences.edit()
            .putString("token_status", "error:" + error.getClass().getSimpleName())
            .apply());
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onStop() {
        CookieManager.getInstance().flush();
        super.onStop();
    }

    private void registerFcmToken() {
        registerFcmToken(0);
    }

    private void registerFcmToken(int attempt) {
        String token = getSharedPreferences("fcm", MODE_PRIVATE).getString("token", "");
        if (token.isEmpty()) {
            if (attempt < 6 && webView != null) {
                webView.postDelayed(() -> registerFcmToken(attempt + 1), 5000);
            }
            return;
        }

        registerFcmTokenViaJavascript();
        final String sessionCookies = CookieManager.getInstance().getCookie(APP_URL);

        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL endpoint = new URL(APP_URL + "/api/fcm-token");
                connection = (HttpURLConnection) endpoint.openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                if (sessionCookies != null && !sessionCookies.isEmpty()) {
                    connection.setRequestProperty("Cookie", sessionCookies);
                }
                String json = "{\"token\":\"" + token
                    .replace("\\", "\\\\")
                    .replace("\"", "\\\"") + "\"}";
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(json.getBytes(StandardCharsets.UTF_8));
                }
                int status = connection.getResponseCode();
                getSharedPreferences("fcm", MODE_PRIVATE).edit()
                    .putInt("native_http_status", status)
                    .putLong("native_attempted_at", System.currentTimeMillis())
                    .apply();
                if (status < 200 || status >= 300) throw new IllegalStateException("HTTP " + status);
                getSharedPreferences("fcm", MODE_PRIVATE).edit()
                    .putLong("registered_at", System.currentTimeMillis())
                    .apply();
            } catch (Exception error) {
                getSharedPreferences("fcm", MODE_PRIVATE).edit()
                    .putString("native_error", error.getClass().getSimpleName())
                    .apply();
                if (attempt < 6 && webView != null) {
                    webView.postDelayed(() -> registerFcmToken(attempt + 1), 5000);
                }
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    private void registerFcmTokenViaJavascript() {
        String token = getSharedPreferences("fcm", MODE_PRIVATE).getString("token", "");
        if (token.isEmpty()) return;

        // Chamar API para registrar o token (o JavaScript tem acesso aos cookies de sessão)
        String js = "fetch('/api/fcm-token', {" +
            "method: 'POST'," +
            "credentials: 'include'," +
            "headers: {'Content-Type': 'application/json'}," +
            "body: JSON.stringify({token: '" + token.replace("'", "\\'") + "'})" +
            "}).then(function(r){AndroidBridge.reportFcmRegistration(r.status);})" +
            ".catch(function(){AndroidBridge.reportFcmRegistration(0);});";

        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                new String[] { Manifest.permission.POST_NOTIFICATIONS },
                NOTIFICATION_PERMISSION_REQUEST
            );
        }
    }

    private void openInExternalBrowser(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception error) {
            Toast.makeText(this, "Não foi possível abrir o download.", Toast.LENGTH_LONG).show();
        }
    }

    private String resolveNotificationUrl(Intent intent) {
        if (intent == null || !intent.hasExtra("url")) return null;
        String url = intent.getStringExtra("url");
        if (url == null || url.isEmpty()) return null;
        if (url.startsWith("https://") || url.startsWith("http://")) return url;
        return APP_URL + (url.startsWith("/") ? url : "/" + url);
    }

    private String withCacheBuster(String url) {
        return url + (url.contains("?") ? "&" : "?") + "push_open=" + System.currentTimeMillis();
    }

    private void openNotificationUrl(String url) {
        pendingUrl = url;
        if (webView == null) return;
        webView.stopLoading();
        webView.clearCache(false);
        webView.loadUrl(withCacheBuster(APP_URL + "/dashboard"));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String url = resolveNotificationUrl(intent);
        if (url != null) openNotificationUrl(url);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || filePathCallback == null) return;
        Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}

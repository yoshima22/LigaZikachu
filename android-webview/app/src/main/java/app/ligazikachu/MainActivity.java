package app.ligazikachu;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://liga-zikachu.vercel.app";
    private static final int FILE_CHOOSER_REQUEST = 1001;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingUrl = null;

    // JavaScript bridge para comunicação WebView ↔ Android
    public class AndroidBridge {
        @JavascriptInterface
        public String getFcmToken() {
            return getSharedPreferences("fcm", MODE_PRIVATE).getString("token", "");
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

        // Buscar/atualizar token FCM
        FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
            getSharedPreferences("fcm", MODE_PRIVATE).edit().putString("token", token).apply();
        });

        // Verificar se abriu por notificação com URL específica
        if (getIntent() != null && getIntent().hasExtra("url")) {
            pendingUrl = getIntent().getStringExtra("url");
        }

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
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
        String token = getSharedPreferences("fcm", MODE_PRIVATE).getString("token", "");
        if (token.isEmpty()) return;

        // Chamar API para registrar o token (o JavaScript tem acesso aos cookies de sessão)
        String js = "fetch('/api/fcm-token', {" +
            "method: 'POST'," +
            "headers: {'Content-Type': 'application/json'}," +
            "body: JSON.stringify({token: '" + token.replace("'", "\\'") + "'})" +
            "}).catch(function(){});";

        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent.hasExtra("url")) {
            String url = intent.getStringExtra("url");
            if (url != null && !url.isEmpty()) {
                webView.loadUrl(url);
            }
        }
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

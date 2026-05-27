# Liga Zikachu Android

Wrapper Android simples para empacotar a aplicação web/PWA da Liga Zikachu em um APK.

## Gerar APK debug

```powershell
$env:JAVA_HOME="C:\Program Files\Android\openjdk\jdk-21.0.8"
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
& "$env:USERPROFILE\.gradle\wrapper\dists\gradle-8.9-all\6m0mbzute7p0zdleavqlib88a\gradle-8.9\bin\gradle.bat" -p android-webview assembleDebug
```

O APK gerado fica em:

```text
android-webview/app/build/outputs/apk/debug/app-debug.apk
```

Este APK aponta para `https://liga-zikachu.vercel.app`.

## Observações

- O APK debug é instalável manualmente, mas não é ideal para publicação em loja.
- Para distribuição pública, gere uma versão release assinada com uma chave própria.
- Este wrapper usa WebView e depende do app web em produção.

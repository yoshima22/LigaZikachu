# Configurar Firebase para Push Notifications

## 1. Criar projeto no Firebase

1. Acesse: https://console.firebase.google.com
2. Clique em "Adicionar projeto" → nome: "Liga Zikachu"
3. Desative Google Analytics (opcional)
4. Clique em "Criar projeto"

## 2. Adicionar app Android

1. Na tela do projeto, clique no ícone Android (</> Android)
2. Package name: `app.ligazikachu`
3. Nome do app: Liga Zikachu
4. Clique "Registrar app"
5. **Baixe o `google-services.json`**
6. Coloque o arquivo em: `android-webview/app/google-services.json`

## 3. Obter FCM Server Key

1. No Firebase Console → seu projeto
2. Clique na engrenagem ⚙️ → "Configurações do projeto"
3. Aba "Cloud Messaging"
4. Copie a "Chave do servidor" (Server Key)

## 4. Configurar na Vercel

1. Acesse: vercel.com → seu projeto → Settings → Environment Variables
2. Adicione: `FCM_SERVER_KEY` = (a chave do servidor copiada acima)

## 5. Gerar o APK

No terminal, dentro da pasta `android-webview/`:
```
./gradlew assembleDebug
```

O APK será gerado em:
`android-webview/app/build/outputs/apk/debug/app-debug.apk`

## Eventos que geram notificações

- 🎴 **Figurinha recebida**: quando alguém te manda uma figurinha duplicada
- 🏆 **Ganhou na ZikaLoot**: quando seu número é sorteado
- ⚔️ **Desafio recebido**: quando alguém te desafia em um torneio

## Nota importante

O arquivo `google-services.json` NÃO deve ser commitado no Git (contém chaves privadas).
Adicione `android-webview/app/google-services.json` ao `.gitignore`.

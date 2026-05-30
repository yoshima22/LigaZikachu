package app.ligazikachu;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class LigaFirebaseService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "liga_zikachu";
    private static final String CHANNEL_NAME = "Liga Zikachu";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        // Salvar token atualizado — MainActivity vai enviar ao servidor quando abrir
        getSharedPreferences("fcm", MODE_PRIVATE)
            .edit()
            .putString("token", token)
            .apply();
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        String title = "Liga Zikachu";
        String body = "";
        String url = "https://liga-zikachu.vercel.app/dashboard";

        if (remoteMessage.getNotification() != null) {
            if (remoteMessage.getNotification().getTitle() != null)
                title = remoteMessage.getNotification().getTitle();
            if (remoteMessage.getNotification().getBody() != null)
                body = remoteMessage.getNotification().getBody();
        }

        if (remoteMessage.getData().containsKey("url"))
            url = "https://liga-zikachu.vercel.app" + remoteMessage.getData().get("url");

        showNotification(title, body, url);
    }

    private void showNotification(String title, String body, String url) {
        createChannel();

        Intent intent = new Intent(this, MainActivity.class);
        intent.putExtra("url", url);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        PendingIntent pending = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pending);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null)
            manager.notify((int) System.currentTimeMillis(), builder.build());
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notificações da Liga Zikachu");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }
}

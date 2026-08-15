package app.ligazikachu;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.Toast;
import java.io.InputStream;
import java.security.MessageDigest;

public class UpdateDownloadReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;
        long completed = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
        long expected = context.getSharedPreferences("app_update", Context.MODE_PRIVATE).getLong("download_id", -2L);
        if (completed != expected) return;
        DownloadManager manager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        Uri apk = manager == null ? null : manager.getUriForDownloadedFile(completed);
        if (apk == null) return;
        String expectedHash = context.getSharedPreferences("app_update", Context.MODE_PRIVATE).getString("expected_sha256", "");
        if (!expectedHash.isEmpty() && !expectedHash.equalsIgnoreCase(fileSha256(context, apk))) {
            Toast.makeText(context, "A atualização baixada falhou na verificação de segurança.", Toast.LENGTH_LONG).show();
            return;
        }
        Intent install = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(apk, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        context.startActivity(install);
    }

    private String fileSha256(Context context, Uri uri) {
        try (InputStream input = context.getContentResolver().openInputStream(uri)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int count;
            while (input != null && (count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
            StringBuilder result = new StringBuilder();
            for (byte value : digest.digest()) result.append(String.format("%02X", value));
            return result.toString();
        } catch (Exception error) {
            return "";
        }
    }
}

CREATE TABLE "spec_chat_messages" (
  "id" TEXT NOT NULL,
  "streamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userName" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "spec_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "spec_chat_messages_streamId_createdAt_idx" ON "spec_chat_messages"("streamId", "createdAt");

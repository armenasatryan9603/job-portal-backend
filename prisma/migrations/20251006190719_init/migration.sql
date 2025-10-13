-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

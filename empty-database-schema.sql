-- Empty Database Schema for Google Cloud SQL
-- Generated from Prisma schema.prisma
-- This creates all tables with proper structure but no data

-- Enable UUID extension if needed
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clean up existing data (optional - uncomment if you want to start fresh)
-- TRUNCATE TABLE "ReviewReason" CASCADE;
-- TRUNCATE TABLE "Reason" CASCADE;
-- TRUNCATE TABLE "ReferralReward" CASCADE;
-- TRUNCATE TABLE "OrderPricing" CASCADE;
-- TRUNCATE TABLE "Message" CASCADE;
-- TRUNCATE TABLE "ConversationParticipant" CASCADE;
-- TRUNCATE TABLE "Conversation" CASCADE;
-- TRUNCATE TABLE "Notification" CASCADE;
-- TRUNCATE TABLE "phone_verification" CASCADE;
-- TRUNCATE TABLE "Card" CASCADE;
-- TRUNCATE TABLE "MediaFile" CASCADE;
-- TRUNCATE TABLE "Review" CASCADE;
-- TRUNCATE TABLE "OrderProposal" CASCADE;
-- TRUNCATE TABLE "Order" CASCADE;
-- TRUNCATE TABLE "UserService" CASCADE;
-- TRUNCATE TABLE "Service" CASCADE;
-- TRUNCATE TABLE "User" CASCADE;

-- Create tables in dependency order

-- Users table
CREATE TABLE IF NOT EXISTS "User" (
    "id" SERIAL PRIMARY KEY,
    "role" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "email" VARCHAR UNIQUE,
    "phone" VARCHAR UNIQUE,
    "passwordHash" VARCHAR NOT NULL,
    "avatarUrl" VARCHAR,
    "bio" VARCHAR,
    "creditBalance" DOUBLE PRECISION DEFAULT 0,
    "verified" BOOLEAN DEFAULT false,
    "otpCode" VARCHAR,
    "otpExpiresAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "referralCode" VARCHAR UNIQUE,
    "referredBy" INTEGER,
    "referralCredits" DOUBLE PRECISION DEFAULT 0,
    "fcmToken" VARCHAR,
    "experienceYears" INTEGER,
    "priceMin" DOUBLE PRECISION,
    "priceMax" DOUBLE PRECISION,
    "location" VARCHAR,
    FOREIGN KEY ("referredBy") REFERENCES "User"("id")
);

-- Services table
CREATE TABLE IF NOT EXISTS "Service" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR NOT NULL,
    "description" VARCHAR,
    "nameEn" VARCHAR,
    "nameRu" VARCHAR,
    "nameHy" VARCHAR,
    "descriptionEn" VARCHAR,
    "descriptionRu" VARCHAR,
    "descriptionHy" VARCHAR,
    "parentId" INTEGER,
    "averagePrice" DOUBLE PRECISION,
    "minPrice" DOUBLE PRECISION,
    "maxPrice" DOUBLE PRECISION,
    "features" TEXT[] DEFAULT '{}',
    "technologies" TEXT[] DEFAULT '{}',
    "completionRate" DOUBLE PRECISION DEFAULT 0,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("parentId") REFERENCES "Service"("id")
);

-- UserServices junction table
CREATE TABLE IF NOT EXISTS "UserService" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "notificationsEnabled" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE,
    UNIQUE("userId", "serviceId")
);

-- Orders table
CREATE TABLE IF NOT EXISTS "Order" (
    "id" SERIAL PRIMARY KEY,
    "clientId" INTEGER NOT NULL,
    "serviceId" INTEGER,
    "title" VARCHAR,
    "description" VARCHAR,
    "budget" DOUBLE PRECISION,
    "availableDates" TEXT[] DEFAULT '{}',
    "location" VARCHAR,
    "skills" TEXT[] DEFAULT '{}',
    "status" VARCHAR DEFAULT 'open',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("clientId") REFERENCES "User"("id"),
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
);

-- OrderProposals table
CREATE TABLE IF NOT EXISTS "OrderProposal" (
    "id" SERIAL PRIMARY KEY,
    "orderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "price" DOUBLE PRECISION,
    "message" VARCHAR,
    "status" VARCHAR DEFAULT 'pending',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("orderId") REFERENCES "Order"("id"),
    FOREIGN KEY ("userId") REFERENCES "User"("id")
);

-- Reviews table
CREATE TABLE IF NOT EXISTS "Review" (
    "id" SERIAL PRIMARY KEY,
    "orderId" INTEGER NOT NULL,
    "reviewerId" INTEGER NOT NULL,
    "specialistId" INTEGER,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR,
    "feedbackType" VARCHAR DEFAULT 'completed',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("orderId") REFERENCES "Order"("id"),
    FOREIGN KEY ("reviewerId") REFERENCES "User"("id"),
    FOREIGN KEY ("specialistId") REFERENCES "User"("id")
);

-- MediaFiles table
CREATE TABLE IF NOT EXISTS "MediaFile" (
    "id" SERIAL PRIMARY KEY,
    "orderId" INTEGER NOT NULL,
    "fileName" VARCHAR NOT NULL,
    "fileUrl" VARCHAR NOT NULL,
    "fileType" VARCHAR NOT NULL,
    "mimeType" VARCHAR NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE,
    FOREIGN KEY ("uploadedBy") REFERENCES "User"("id")
);

-- Cards table
CREATE TABLE IF NOT EXISTS "Card" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "paymentMethodId" VARCHAR UNIQUE NOT NULL,
    "brand" VARCHAR NOT NULL,
    "last4" VARCHAR NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "holderName" VARCHAR,
    "isDefault" BOOLEAN DEFAULT false,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- PhoneVerification table
CREATE TABLE IF NOT EXISTS "phone_verification" (
    "id" SERIAL PRIMARY KEY,
    "phone_hash" VARCHAR(64) UNIQUE NOT NULL,
    "first_signup_at" TIMESTAMP DEFAULT NOW(),
    "last_signup_at" TIMESTAMP DEFAULT NOW(),
    "signup_count" INTEGER DEFAULT 1
);

-- Notifications table
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "type" VARCHAR NOT NULL,
    "title" VARCHAR NOT NULL,
    "message" VARCHAR NOT NULL,
    "isRead" BOOLEAN DEFAULT false,
    "data" JSONB,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Conversations table
CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" SERIAL PRIMARY KEY,
    "orderId" INTEGER,
    "title" VARCHAR,
    "status" VARCHAR DEFAULT 'active',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE
);

-- ConversationParticipants table
CREATE TABLE IF NOT EXISTS "ConversationParticipant" (
    "id" SERIAL PRIMARY KEY,
    "conversationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP DEFAULT NOW(),
    "lastReadAt" TIMESTAMP,
    "isActive" BOOLEAN DEFAULT true,
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    UNIQUE("conversationId", "userId")
);

-- Messages table
CREATE TABLE IF NOT EXISTS "Message" (
    "id" SERIAL PRIMARY KEY,
    "conversationId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "content" VARCHAR NOT NULL,
    "messageType" VARCHAR DEFAULT 'text',
    "metadata" JSONB,
    "isEdited" BOOLEAN DEFAULT false,
    "editedAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE,
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- OrderPricing table
CREATE TABLE IF NOT EXISTS "OrderPricing" (
    "id" SERIAL PRIMARY KEY,
    "minBudget" DOUBLE PRECISION NOT NULL,
    "maxBudget" DOUBLE PRECISION,
    "creditCost" DOUBLE PRECISION NOT NULL,
    "refundPercentage" DOUBLE PRECISION DEFAULT 0.5,
    "description" VARCHAR,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- ReferralReward table
CREATE TABLE IF NOT EXISTS "ReferralReward" (
    "id" SERIAL PRIMARY KEY,
    "referrerId" INTEGER NOT NULL,
    "referredUserId" INTEGER NOT NULL,
    "rewardAmount" DOUBLE PRECISION NOT NULL,
    "bonusAmount" DOUBLE PRECISION DEFAULT 0,
    "status" VARCHAR DEFAULT 'pending',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "completedAt" TIMESTAMP,
    FOREIGN KEY ("referrerId") REFERENCES "User"("id"),
    FOREIGN KEY ("referredUserId") REFERENCES "User"("id")
);

-- Reason table
CREATE TABLE IF NOT EXISTS "Reason" (
    "id" SERIAL PRIMARY KEY,
    "code" VARCHAR UNIQUE NOT NULL,
    "nameEn" VARCHAR NOT NULL,
    "nameRu" VARCHAR NOT NULL,
    "nameHy" VARCHAR NOT NULL,
    "descriptionEn" VARCHAR,
    "descriptionRu" VARCHAR,
    "descriptionHy" VARCHAR,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- ReviewReason junction table
CREATE TABLE IF NOT EXISTS "ReviewReason" (
    "id" SERIAL PRIMARY KEY,
    "reviewId" INTEGER NOT NULL,
    "reasonId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE,
    FOREIGN KEY ("reasonId") REFERENCES "Reason"("id") ON DELETE CASCADE,
    UNIQUE("reviewId", "reasonId")
);

-- Create indexes for better performance (with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_phone_idx" ON "User"("phone");
CREATE INDEX IF NOT EXISTS "User_referralCode_idx" ON "User"("referralCode");
CREATE INDEX IF NOT EXISTS "User_referredBy_idx" ON "User"("referredBy");

CREATE INDEX IF NOT EXISTS "Service_parentId_idx" ON "Service"("parentId");
CREATE INDEX IF NOT EXISTS "Service_isActive_idx" ON "Service"("isActive");

CREATE INDEX IF NOT EXISTS "UserService_userId_idx" ON "UserService"("userId");
CREATE INDEX IF NOT EXISTS "UserService_serviceId_idx" ON "UserService"("serviceId");

CREATE INDEX IF NOT EXISTS "Order_clientId_idx" ON "Order"("clientId");
CREATE INDEX IF NOT EXISTS "Order_serviceId_idx" ON "Order"("serviceId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");

CREATE INDEX IF NOT EXISTS "OrderProposal_orderId_idx" ON "OrderProposal"("orderId");
CREATE INDEX IF NOT EXISTS "OrderProposal_userId_idx" ON "OrderProposal"("userId");

CREATE INDEX IF NOT EXISTS "Review_orderId_idx" ON "Review"("orderId");
CREATE INDEX IF NOT EXISTS "Review_reviewerId_idx" ON "Review"("reviewerId");
CREATE INDEX IF NOT EXISTS "Review_specialistId_idx" ON "Review"("specialistId");
CREATE INDEX IF NOT EXISTS "Review_feedbackType_idx" ON "Review"("feedbackType");

CREATE INDEX IF NOT EXISTS "MediaFile_orderId_idx" ON "MediaFile"("orderId");
CREATE INDEX IF NOT EXISTS "MediaFile_uploadedBy_idx" ON "MediaFile"("uploadedBy");

CREATE INDEX IF NOT EXISTS "Card_userId_idx" ON "Card"("userId");
CREATE INDEX IF NOT EXISTS "Card_paymentMethodId_idx" ON "Card"("paymentMethodId");

CREATE INDEX IF NOT EXISTS "phone_verification_phone_hash_idx" ON "phone_verification"("phone_hash");

CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_isRead_idx" ON "Notification"("isRead");
CREATE INDEX IF NOT EXISTS "Notification_type_idx" ON "Notification"("type");

CREATE INDEX IF NOT EXISTS "Conversation_orderId_idx" ON "Conversation"("orderId");
CREATE INDEX IF NOT EXISTS "Conversation_createdAt_idx" ON "Conversation"("createdAt");
CREATE INDEX IF NOT EXISTS "Conversation_status_idx" ON "Conversation"("status");

CREATE INDEX IF NOT EXISTS "ConversationParticipant_conversationId_idx" ON "ConversationParticipant"("conversationId");
CREATE INDEX IF NOT EXISTS "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

CREATE INDEX IF NOT EXISTS "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX IF NOT EXISTS "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX IF NOT EXISTS "Message_createdAt_idx" ON "Message"("createdAt");

CREATE INDEX IF NOT EXISTS "OrderPricing_minBudget_idx" ON "OrderPricing"("minBudget");
CREATE INDEX IF NOT EXISTS "OrderPricing_maxBudget_idx" ON "OrderPricing"("maxBudget");
CREATE INDEX IF NOT EXISTS "OrderPricing_isActive_idx" ON "OrderPricing"("isActive");

CREATE INDEX IF NOT EXISTS "ReferralReward_referrerId_idx" ON "ReferralReward"("referrerId");
CREATE INDEX IF NOT EXISTS "ReferralReward_referredUserId_idx" ON "ReferralReward"("referredUserId");
CREATE INDEX IF NOT EXISTS "ReferralReward_status_idx" ON "ReferralReward"("status");

CREATE INDEX IF NOT EXISTS "Reason_code_idx" ON "Reason"("code");
CREATE INDEX IF NOT EXISTS "Reason_isActive_idx" ON "Reason"("isActive");

CREATE INDEX IF NOT EXISTS "ReviewReason_reviewId_idx" ON "ReviewReason"("reviewId");
CREATE INDEX IF NOT EXISTS "ReviewReason_reasonId_idx" ON "ReviewReason"("reasonId");

-- Create sequences for auto-incrementing IDs (with IF NOT EXISTS)
CREATE SEQUENCE IF NOT EXISTS "User_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "Service_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "UserService_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "Order_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "OrderProposal_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "Review_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "MediaFile_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "Card_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "phone_verification_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "Notification_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "Conversation_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "ConversationParticipant_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "Message_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "OrderPricing_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "ReferralReward_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "Reason_id_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "ReviewReason_id_seq" START WITH 1 INCREMENT BY 1;

-- Set default values for sequences
ALTER SEQUENCE "User_id_seq" OWNED BY "User"."id";
ALTER SEQUENCE "Service_id_seq" OWNED BY "Service"."id";
ALTER SEQUENCE "UserService_id_seq" OWNED BY "UserService"."id";
ALTER SEQUENCE "Order_id_seq" OWNED BY "Order"."id";
ALTER SEQUENCE "OrderProposal_id_seq" OWNED BY "OrderProposal"."id";
ALTER SEQUENCE "Review_id_seq" OWNED BY "Review"."id";
ALTER SEQUENCE "MediaFile_id_seq" OWNED BY "MediaFile"."id";
ALTER SEQUENCE "Card_id_seq" OWNED BY "Card"."id";
ALTER SEQUENCE "phone_verification_id_seq" OWNED BY "phone_verification"."id";
ALTER SEQUENCE "Notification_id_seq" OWNED BY "Notification"."id";
ALTER SEQUENCE "Conversation_id_seq" OWNED BY "Conversation"."id";
ALTER SEQUENCE "ConversationParticipant_id_seq" OWNED BY "ConversationParticipant"."id";
ALTER SEQUENCE "Message_id_seq" OWNED BY "Message"."id";
ALTER SEQUENCE "OrderPricing_id_seq" OWNED BY "OrderPricing"."id";
ALTER SEQUENCE "ReferralReward_id_seq" OWNED BY "ReferralReward"."id";
ALTER SEQUENCE "Reason_id_seq" OWNED BY "Reason"."id";
ALTER SEQUENCE "ReviewReason_id_seq" OWNED BY "ReviewReason"."id";

-- Insert comprehensive review reasons data (with ON CONFLICT handling)
INSERT INTO "Reason" (code, "nameEn", "nameRu", "nameHy", "descriptionEn", "descriptionRu", "descriptionHy", "isActive", "createdAt", "updatedAt") VALUES

-- Communication Issues
('poor_communication', 'Poor Communication', 'Плохая коммуникация', 'Վատ հաղորդակցություն', 'Specialist was unresponsive or unclear in communication', 'Специалист не отвечал или был неясен в общении', 'Մասնագետը չէր պատասխանում կամ անհասկանալի էր հաղորդակցության մեջ', true, NOW(), NOW()),
('unprofessional_behavior', 'Unprofessional Behavior', 'Непрофессиональное поведение', 'Անմասնագիտական վարք', 'Specialist behaved inappropriately or unprofessionally', 'Специалист вел себя неподходящим или непрофессиональным образом', 'Մասնագետը վարվում էր ոչ պատշաճ կամ անմասնագիտական կերպով', true, NOW(), NOW()),
('language_barrier', 'Language Barrier', 'Языковой барьер', 'Լեզվական խոչընդոտ', 'Difficulty communicating due to language differences', 'Трудности в общении из-за языковых различий', 'Հաղորդակցության դժվարություններ լեզվական տարբերությունների պատճառով', true, NOW(), NOW()),
('timezone_issues', 'Timezone Issues', 'Проблемы с часовыми поясами', 'Ժամային գոտու խնդիրներ', 'Difficult to coordinate due to different time zones', 'Сложно координировать из-за разных часовых поясов', 'Դժվար է համակարգել տարբեր ժամային գոտիների պատճառով', true, NOW(), NOW()),
('slow_response', 'Slow Response', 'Медленный ответ', 'Դանդաղ պատասխան', 'Specialist took too long to respond to messages', 'Специалист слишком долго отвечал на сообщения', 'Մասնագետը շատ երկար էր պատասխանում հաղորդագրություններին', true, NOW(), NOW()),
('ignored_messages', 'Ignored Messages', 'Игнорирование сообщений', 'Անտեսված հաղորդագրություններ', 'Specialist ignored or did not respond to messages', 'Специалист игнорировал или не отвечал на сообщения', 'Մասնագետը անտեսում էր կամ չէր պատասխանում հաղորդագրություններին', true, NOW(), NOW()),

-- Quality Issues
('poor_quality_work', 'Poor Quality Work', 'Плохое качество работы', 'Վատ որակի աշխատանք', 'The work delivered was below expected quality standards', 'Выполненная работа была ниже ожидаемых стандартов качества', 'Կատարված աշխատանքը ցածր էր սպասվող որակի ստանդարտներից', true, NOW(), NOW()),
('incomplete_work', 'Incomplete Work', 'Незавершенная работа', 'Անավարտ աշխատանք', 'Specialist did not complete the project as agreed', 'Специалист не завершил проект согласно договоренности', 'Մասնագետը չավարտեց նախագիծը համաձայնեցվածի համաձայն', true, NOW(), NOW()),
('delayed_delivery', 'Delayed Delivery', 'Задержка поставки', 'Առաքման ուշացում', 'Project was delivered significantly later than promised', 'Проект был поставлен значительно позже обещанного', 'Նախագիծը առաքվեց զգալիորեն ուշ, քան խոստացված էր', true, NOW(), NOW()),
('not_as_described', 'Not As Described', 'Не как описано', 'Ոչ այնպես, ինչպես նկարագրված', 'The final result did not match the original description', 'Окончательный результат не соответствовал первоначальному описанию', 'Վերջնական արդյունքը չէր համապատասխանում սկզբնական նկարագրությանը', true, NOW(), NOW()),
('sloppy_work', 'Sloppy Work', 'Неряшливая работа', 'Անփույթ աշխատանք', 'Work was done carelessly with many mistakes', 'Работа была выполнена небрежно с множеством ошибок', 'Աշխատանքը կատարվել էր անփույթ կերպով շատ սխալներով', true, NOW(), NOW()),
('missing_requirements', 'Missing Requirements', 'Отсутствующие требования', 'Բացակայող պահանջներ', 'Important requirements were not addressed', 'Важные требования не были учтены', 'Կարևոր պահանջները հաշվի չէին առնվել', true, NOW(), NOW()),
('wrong_approach', 'Wrong Approach', 'Неправильный подход', 'Սխալ մոտեցում', 'Specialist used an approach that was not suitable', 'Специалист использовал подход, который не подходил', 'Մասնագետը օգտագործեց մոտեցում, որը հարմար չէր', true, NOW(), NOW()),

-- Technical Issues
('technical_problems', 'Technical Problems', 'Технические проблемы', 'Տեխնիկական խնդիրներ', 'Encountered technical difficulties during the project', 'Возникли технические трудности во время проекта', 'Նախագծի ընթացքում առաջացան տեխնիկական դժվարություններ', true, NOW(), NOW()),
('compatibility_issues', 'Compatibility Issues', 'Проблемы совместимости', 'Համատեղելիության խնդիրներ', 'Work was not compatible with existing systems', 'Работа не была совместима с существующими системами', 'Աշխատանքը համատեղելի չէր գոյություն ունեցող համակարգերի հետ', true, NOW(), NOW()),
('security_concerns', 'Security Concerns', 'Проблемы безопасности', 'Անվտանգության խնդիրներ', 'Security vulnerabilities were introduced in the work', 'В работе были обнаружены уязвимости безопасности', 'Աշխատանքում հայտնաբերվեցին անվտանգության խոցելիություններ', true, NOW(), NOW()),
('performance_issues', 'Performance Issues', 'Проблемы производительности', 'Արտադրողականության խնդիրներ', 'The delivered solution had performance problems', 'Поставленное решение имело проблемы с производительностью', 'Առաքված լուծումը ուներ արտադրողականության խնդիրներ', true, NOW(), NOW()),
('bugs_issues', 'Bugs and Issues', 'Ошибки и проблемы', 'Խնդիրներ և սխալներ', 'Deliverable contains many bugs and issues', 'Результат содержит много ошибок и проблем', 'Արդյունքը պարունակում է շատ սխալներ և խնդիրներ', true, NOW(), NOW()),
('not_working', 'Not Working', 'Не работает', 'Չի աշխատում', 'Final deliverable does not work as expected', 'Окончательный результат не работает как ожидалось', 'Վերջնական արդյունքը չի աշխատում, ինչպես սպասվում էր', true, NOW(), NOW()),
('outdated_technology', 'Outdated Technology', 'Устаревшая технология', 'Հնացած տեխնոլոգիա', 'Specialist used outdated or obsolete technology', 'Специалист использовал устаревшую или устаревшую технологию', 'Մասնագետը օգտագործում էր հնացած կամ հնացած տեխնոլոգիա', true, NOW(), NOW()),

-- Budget and Pricing Issues
('budget_mismatch', 'Budget Mismatch', 'Несоответствие бюджета', 'Բյուջեի անհամապատասխանություն', 'Project costs exceeded the agreed budget', 'Стоимость проекта превысила согласованный бюджет', 'Նախագծի արժեքը գերազանցեց համաձայնեցված բյուջեն', true, NOW(), NOW()),
('hidden_costs', 'Hidden Costs', 'Скрытые расходы', 'Թաքնված ծախսեր', 'Additional costs were not disclosed upfront', 'Дополнительные расходы не были раскрыты заранее', 'Լրացուցիչ ծախսերը նախապես չէին բացահայտվել', true, NOW(), NOW()),
('price_increase', 'Price Increase', 'Повышение цены', 'Գնի բարձրացում', 'Specialist increased the price after starting work', 'Специалист повысил цену после начала работы', 'Մասնագետը բարձրացրեց գինը աշխատանքը սկսելուց հետո', true, NOW(), NOW()),
('unfair_pricing', 'Unfair Pricing', 'Несправедливое ценообразование', 'Անարդար գնագոյացում', 'The pricing was not fair for the work provided', 'Ценообразование было несправедливым для предоставленной работы', 'Գնագոյացումը արդար չէր տրամադրված աշխատանքի համար', true, NOW(), NOW()),
('overpriced', 'Overpriced', 'Завышенная цена', 'Գերագնահատված գին', 'The service was significantly overpriced', 'Услуга была значительно завышена в цене', 'Ծառայությունը զգալիորեն գերագնահատված էր', true, NOW(), NOW()),
('billing_errors', 'Billing Errors', 'Ошибки в выставлении счетов', 'Հաշվարկային սխալներ', 'Incorrect billing or invoicing', 'Неправильное выставление счетов или инвойсов', 'Սխալ հաշիվների կամ ինվոյսների ներկայացում', true, NOW(), NOW()),

-- Timeline and Availability Issues
('unavailable', 'Unavailable', 'Недоступен', 'Անհասանելի', 'Specialist became unavailable during the project', 'Специалист стал недоступен во время проекта', 'Մասնագետը դարձավ անհասանելի նախագծի ընթացքում', true, NOW(), NOW()),
('schedule_conflicts', 'Schedule Conflicts', 'Конфликты расписания', 'Ժամանակացույցի հակամարտություններ', 'Unable to coordinate schedules effectively', 'Не удалось эффективно координировать расписания', 'Հնարավոր չէր արդյունավետ համակարգել ժամանակացույցերը', true, NOW(), NOW()),
('rushed_timeline', 'Rushed Timeline', 'Спешный график', 'Շտապ ժամանակացույց', 'Timeline was too rushed for quality work', 'График был слишком спешным для качественной работы', 'Ժամանակացույցը շատ շտապ էր որակյալ աշխատանքի համար', true, NOW(), NOW()),
('missed_deadlines', 'Missed Deadlines', 'Пропущенные сроки', 'Բաց թողնված ժամկետներ', 'Specialist consistently missed agreed deadlines', 'Специалист постоянно пропускал согласованные сроки', 'Մասնագետը անընդհատ բաց թողնում էր համաձայնեցված ժամկետները', true, NOW(), NOW()),
('no_show', 'No Show', 'Не явился', 'Չի եկել', 'Specialist did not show up for scheduled meetings', 'Специалист не явился на запланированные встречи', 'Մասնագետը չի եկել նախատեսված հանդիպումներին', true, NOW(), NOW()),
('frequent_cancellations', 'Frequent Cancellations', 'Частые отмены', 'Հաճախակի չեղարկումներ', 'Specialist frequently cancelled or rescheduled', 'Специалист часто отменял или переносил встречи', 'Մասնագետը հաճախ չեղարկում էր կամ հետաձգում հանդիպումները', true, NOW(), NOW()),

-- Scope and Requirements Issues
('scope_creep', 'Scope Creep', 'Расширение объема', 'Շրջանակի ընդլայնում', 'Project scope expanded beyond original agreement', 'Объем проекта расширился за пределы первоначального соглашения', 'Նախագծի շրջանակը ընդլայնվեց սկզբնական համաձայնության սահմաններից դուրս', true, NOW(), NOW()),
('unclear_requirements', 'Unclear Requirements', 'Неясные требования', 'Անհասկանալի պահանջներ', 'Requirements were not clearly defined from the start', 'Требования не были четко определены с самого начала', 'Պահանջները սկզբից հստակ չէին սահմանված', true, NOW(), NOW()),
('feature_missing', 'Missing Features', 'Отсутствующие функции', 'Բացակայող հատկություններ', 'Agreed upon features were not implemented', 'Согласованные функции не были реализованы', 'Համաձայնեցված հատկությունները չէին իրականացվել', true, NOW(), NOW()),
('scope_reduction', 'Scope Reduction', 'Сокращение объема', 'Շրջանակի կրճատում', 'Specialist reduced the scope without agreement', 'Специалист сократил объем без согласования', 'Մասնագետը կրճատեց շրջանակը առանց համաձայնության', true, NOW(), NOW()),
('requirement_changes', 'Requirement Changes', 'Изменения требований', 'Պահանջների փոփոխություններ', 'Specialist changed requirements without approval', 'Специалист изменил требования без одобрения', 'Մասնագետը փոխեց պահանջները առանց հավանության', true, NOW(), NOW()),

-- Professionalism and Ethics
('unethical_behavior', 'Unethical Behavior', 'Неэтичное поведение', 'Անբարոյական վարք', 'Specialist engaged in unethical practices', 'Специалист занимался неэтичными практиками', 'Մասնագետը զբաղվում էր անբարոյական գործելակերպով', true, NOW(), NOW()),
('confidentiality_breach', 'Confidentiality Breach', 'Нарушение конфиденциальности', 'Գաղտնիության խախտում', 'Specialist violated confidentiality agreements', 'Специалист нарушил соглашения о конфиденциальности', 'Մասնագետը խախտեց գաղտնիության համաձայնությունները', true, NOW(), NOW()),
('plagiarism', 'Plagiarism', 'Плагиат', 'Գրագողություն', 'Work contained plagiarized content', 'Работа содержала плагиат', 'Աշխատանքը պարունակում էր գրագողության բովանդակություն', true, NOW(), NOW()),
('copyright_violation', 'Copyright Violation', 'Нарушение авторских прав', 'Հեղինակային իրավունքի խախտում', 'Work violated copyright or intellectual property rights', 'Работа нарушала авторские права или права интеллектуальной собственности', 'Աշխատանքը խախտում էր հեղինակային իրավունքները կամ մտավոր սեփականության իրավունքները', true, NOW(), NOW()),
('inappropriate_content', 'Inappropriate Content', 'Неподходящий контент', 'Անհարմար բովանդակություն', 'Work contained inappropriate or offensive content', 'Работа содержала неподходящий или оскорбительный контент', 'Աշխատանքը պարունակում էր անհարմար կամ վիրավորական բովանդակություն', true, NOW(), NOW()),
('data_misuse', 'Data Misuse', 'Неправильное использование данных', 'Տվյալների սխալ օգտագործում', 'Specialist misused or mishandled client data', 'Специалист неправильно использовал или обрабатывал данные клиента', 'Մասնագետը սխալ օգտագործում էր կամ մշակում էր հաճախորդի տվյալները', true, NOW(), NOW()),

-- Customer Service Issues
('poor_customer_service', 'Poor Customer Service', 'Плохое обслуживание клиентов', 'Վատ հաճախորդների սպասարկում', 'Specialist provided poor customer service', 'Специалист предоставил плохое обслуживание клиентов', 'Մասնագետը ապահովեց վատ հաճախորդների սպասարկում', true, NOW(), NOW()),
('unresponsive', 'Unresponsive', 'Не отвечает', 'Չի պատասխանում', 'Specialist was unresponsive to messages and calls', 'Специалист не отвечал на сообщения и звонки', 'Մասնագետը չէր պատասխանում հաղորդագրություններին և զանգերին', true, NOW(), NOW()),
('rude_behavior', 'Rude Behavior', 'Грубое поведение', 'Կոպիտ վարք', 'Specialist was rude or disrespectful', 'Специалист был грубым или неуважительным', 'Մասնագետը կոպիտ կամ անհարգալից էր', true, NOW(), NOW()),
('unprofessional_communication', 'Unprofessional Communication', 'Непрофессиональное общение', 'Անմասնագիտական հաղորդակցություն', 'Communication style was unprofessional', 'Стиль общения был непрофессиональным', 'Հաղորդակցության ոճը անմասնագիտական էր', true, NOW(), NOW()),
('disrespectful', 'Disrespectful', 'Неуважительный', 'Անհարգալից', 'Specialist was disrespectful or condescending', 'Специалист был неуважительным или снисходительным', 'Մասնագետը անհարգալից կամ արհամարհական էր', true, NOW(), NOW()),
('argumentative', 'Argumentative', 'Спорный', 'Բանավեճային', 'Specialist was argumentative or confrontational', 'Специалист был спорным или конфронтационным', 'Մասնագետը բանավեճային կամ հակամարտական էր', true, NOW(), NOW()),

-- Project Management Issues
('poor_project_management', 'Poor Project Management', 'Плохое управление проектом', 'Վատ նախագծի կառավարում', 'Specialist failed to manage the project effectively', 'Специалист не смог эффективно управлять проектом', 'Մասնագետը չկարողացավ արդյունավետ կառավարել նախագիծը', true, NOW(), NOW()),
('lack_of_updates', 'Lack of Updates', 'Отсутствие обновлений', 'Թարմացումների բացակայություն', 'Specialist did not provide regular project updates', 'Специалист не предоставлял регулярные обновления проекта', 'Մասնագետը չէր տրամադրում նախագծի կանոնավոր թարմացումներ', true, NOW(), NOW()),
('no_documentation', 'No Documentation', 'Отсутствие документации', 'Փաստաթղթավորման բացակայություն', 'Specialist did not provide proper documentation', 'Специалист не предоставил надлежащую документацию', 'Մասնագետը չտրամադրեց պատշաճ փաստաթղթավորում', true, NOW(), NOW()),
('poor_planning', 'Poor Planning', 'Плохое планирование', 'Վատ պլանավորում', 'Project was poorly planned from the beginning', 'Проект был плохо спланирован с самого начала', 'Նախագիծը վատ էր պլանավորված սկզբից', true, NOW(), NOW()),
('scope_misunderstanding', 'Scope Misunderstanding', 'Непонимание объема', 'Շրջանակի չհասկացում', 'Specialist misunderstood the project scope', 'Специалист неправильно понял объем проекта', 'Մասնագետը սխալ հասկացավ նախագծի շրջանակը', true, NOW(), NOW()),
('timeline_mismanagement', 'Timeline Mismanagement', 'Неправильное управление временем', 'Ժամանակի սխալ կառավարում', 'Specialist poorly managed project timeline', 'Специалист плохо управлял временными рамками проекта', 'Մասնագետը վատ կառավարում էր նախագծի ժամանակային շրջանակները', true, NOW(), NOW()),

-- Technology and Tools Issues
('wrong_tools', 'Wrong Tools', 'Неправильные инструменты', 'Սխալ գործիքներ', 'Specialist used inappropriate tools for the job', 'Специалист использовал неподходящие инструменты для работы', 'Մասնագետը օգտագործում էր անհարմար գործիքներ աշխատանքի համար', true, NOW(), NOW()),
('compatibility_problems', 'Compatibility Problems', 'Проблемы совместимости', 'Համատեղելիության խնդիրներ', 'Tools and software were not compatible', 'Инструменты и программное обеспечение не были совместимы', 'Գործիքները և ծրագրային ապահովումը համատեղելի չէին', true, NOW(), NOW()),
('learning_curve', 'Steep Learning Curve', 'Крутая кривая обучения', 'Կտրուկ ուսուցման կոր', 'Specialist had difficulty learning required tools', 'Специалисту было трудно изучить необходимые инструменты', 'Մասնագետին դժվար էր սովորել անհրաժեշտ գործիքները', true, NOW(), NOW()),
('tool_limitations', 'Tool Limitations', 'Ограничения инструментов', 'Գործիքների սահմանափակումներ', 'Chosen tools had significant limitations', 'Выбранные инструменты имели значительные ограничения', 'Ընտրված գործիքները ունեին զգալի սահմանափակումներ', true, NOW(), NOW()),
('inefficient_workflow', 'Inefficient Workflow', 'Неэффективный рабочий процесс', 'Անարդյունավետ աշխատանքային գործընթաց', 'Specialist used inefficient workflow or processes', 'Специалист использовал неэффективный рабочий процесс', 'Մասնագետը օգտագործում էր անարդյունավետ աշխատանքային գործընթաց', true, NOW(), NOW()),

-- Final Project Issues
('not_user_friendly', 'Not User Friendly', 'Неудобный для пользователя', 'Օգտագործողի համար անհարմար', 'Final product is not user-friendly or intuitive', 'Окончательный продукт не удобен для пользователя или интуитивен', 'Վերջնական արտադրանքը օգտագործողի համար հարմար կամ ինտուիտիվ չէ', true, NOW(), NOW()),
('maintenance_issues', 'Maintenance Issues', 'Проблемы обслуживания', 'Սպասարկման խնդիրներ', 'Deliverable requires constant maintenance and fixes', 'Результат требует постоянного обслуживания и исправлений', 'Արդյունքը պահանջում է մշտական սպասարկում և ուղղումներ', true, NOW(), NOW()),
('scalability_issues', 'Scalability Issues', 'Проблемы масштабируемости', 'Մասշտաբավորման խնդիրներ', 'Solution does not scale well', 'Решение не масштабируется хорошо', 'Լուծումը լավ չի մասշտաբավորվում', true, NOW(), NOW()),
('integration_problems', 'Integration Problems', 'Проблемы интеграции', 'Ինտեգրման խնդիրներ', 'Difficult to integrate with existing systems', 'Сложно интегрировать с существующими системами', 'Դժվար է ինտեգրել գոյություն ունեցող համակարգերի հետ', true, NOW(), NOW()),
('testing_issues', 'Testing Issues', 'Проблемы тестирования', 'Փորձարկման խնդիրներ', 'Insufficient testing or quality assurance', 'Недостаточное тестирование или обеспечение качества', 'Անբավարար փորձարկում կամ որակի ապահովում', true, NOW(), NOW()),

-- Positive Reasons (for good reviews)
('excellent_communication', 'Excellent Communication', 'Отличная коммуникация', 'Գերազանց հաղորդակցություն', 'Specialist maintained excellent communication throughout', 'Специалист поддерживал отличную коммуникацию на протяжении всего времени', 'Մասնագետը պահպանեց գերազանց հաղորդակցություն ամբողջ ընթացքում', true, NOW(), NOW()),
('high_quality_work', 'High Quality Work', 'Высокое качество работы', 'Բարձր որակի աշխատանք', 'Work exceeded quality expectations', 'Работа превзошла ожидания по качеству', 'Աշխատանքը գերազանցեց որակի ակնկալիքները', true, NOW(), NOW()),
('on_time_delivery', 'On Time Delivery', 'Своевременная поставка', 'Ժամանակին առաքում', 'Project was delivered on time or early', 'Проект был поставлен вовремя или раньше', 'Նախագիծը առաքվեց ժամանակին կամ շուտ', true, NOW(), NOW()),
('exceeded_expectations', 'Exceeded Expectations', 'Превысил ожидания', 'Գերազանցեց ակնկալիքները', 'Work went above and beyond expectations', 'Работа превзошла ожидания', 'Աշխատանքը գերազանցեց ակնկալիքները', true, NOW(), NOW()),
('professional_approach', 'Professional Approach', 'Профессиональный подход', 'Մասնագիտական մոտեցում', 'Specialist demonstrated high professionalism', 'Специалист продемонстрировал высокий профессионализм', 'Մասնագետը ցուցաբերեց բարձր մասնագիտականություն', true, NOW(), NOW()),
('creative_solutions', 'Creative Solutions', 'Креативные решения', 'Կրեատիվ լուծումներ', 'Specialist provided innovative and creative solutions', 'Специалист предоставил инновационные и креативные решения', 'Մասնագետը տրամադրեց նորարարական և կրեատիվ լուծումներ', true, NOW(), NOW()),
('great_customer_service', 'Great Customer Service', 'Отличное обслуживание клиентов', 'Գերազանց հաճախորդների սպասարկում', 'Specialist provided exceptional customer service', 'Специалист предоставил исключительное обслуживание клиентов', 'Մասնագետը ապահովեց բացառիկ հաճախորդների սպասարկում', true, NOW(), NOW()),
('value_for_money', 'Great Value for Money', 'Отличное соотношение цены и качества', 'Գերազանց գնի և որակի հարաբերակցություն', 'Work provided excellent value for the money spent', 'Работа предоставила отличную ценность за потраченные деньги', 'Աշխատանքը տրամադրեց գերազանց արժեք ծախսված գումարի համար', true, NOW(), NOW()),
('reliable_partner', 'Reliable Partner', 'Надежный партнер', 'Հուսալի գործընկեր', 'Specialist was reliable and trustworthy throughout', 'Специалист был надежным и заслуживающим доверия на протяжении всего времени', 'Մասնագետը հուսալի և վստահելի էր ամբողջ ընթացքում', true, NOW(), NOW()),
('quick_response', 'Quick Response', 'Быстрый ответ', 'Արագ պատասխան', 'Specialist responded quickly to all communications', 'Специалист быстро отвечал на все сообщения', 'Մասնագետը արագ պատասխանում էր բոլոր հաղորդագրություններին', true, NOW(), NOW()),
('attention_to_detail', 'Attention to Detail', 'Внимание к деталям', 'Մանրուքների նկատմամբ ուշադրություն', 'Specialist paid excellent attention to details', 'Специалист уделял отличное внимание деталям', 'Մասնագետը գերազանց ուշադրություն էր դարձնում մանրուքներին', true, NOW(), NOW()),
('problem_solving', 'Problem Solving', 'Решение проблем', 'Խնդիրների լուծում', 'Specialist excelled at problem-solving', 'Специалист преуспел в решении проблем', 'Մասնագետը գերազանցում էր խնդիրների լուծման մեջ', true, NOW(), NOW()),
('flexible_approach', 'Flexible Approach', 'Гибкий подход', 'Ճկուն մոտեցում', 'Specialist was flexible and adaptable', 'Специалист был гибким и адаптивным', 'Մասնագետը ճկուն և հարմարվող էր', true, NOW(), NOW()),
('knowledgeable', 'Knowledgeable', 'Знающий', 'Գիտակ', 'Specialist demonstrated deep knowledge and expertise', 'Специалист продемонстрировал глубокие знания и экспертизу', 'Մասնագետը ցուցաբերեց խորը գիտելիքներ և փորձագիտություն', true, NOW(), NOW()),
('helpful_suggestions', 'Helpful Suggestions', 'Полезные предложения', 'Օգտակար առաջարկություններ', 'Specialist provided valuable suggestions and improvements', 'Специалист предоставил ценные предложения и улучшения', 'Մասնագետը տրամադրեց արժեքավոր առաջարկություններ և բարելավումներ', true, NOW(), NOW()),
('clean_code', 'Clean Code', 'Чистый код', 'Մաքուր կոդ', 'Code was well-written and maintainable', 'Код был хорошо написан и поддерживаем', 'Կոդը լավ էր գրված և պահպանելի', true, NOW(), NOW()),
('good_documentation', 'Good Documentation', 'Хорошая документация', 'Լավ փաստաթղթավորում', 'Specialist provided comprehensive documentation', 'Специалист предоставил исчерпывающую документацию', 'Մասնագետը տրամադրեց համապարփակ փաստաթղթավորում', true, NOW(), NOW()),
('timely_updates', 'Timely Updates', 'Своевременные обновления', 'Ժամանակին թարմացումներ', 'Specialist provided regular and timely updates', 'Специалист предоставлял регулярные и своевременные обновления', 'Մասնագետը տրամադրում էր կանոնավոր և ժամանակին թարմացումներ', true, NOW(), NOW()),
('exceeded_scope', 'Exceeded Scope', 'Превысил объем', 'Գերազանցեց շրջանակը', 'Specialist delivered more than what was agreed', 'Специалист поставил больше, чем было согласовано', 'Մասնագետը առաքեց ավելին, քան համաձայնեցված էր', true, NOW(), NOW()),
('future_recommendation', 'Future Recommendation', 'Рекомендация на будущее', 'Ապագա առաջարկություն', 'Would definitely work with this specialist again', 'Определенно буду работать с этим специалистом снова', 'Վստահաբար կաշխատեմ այս մասնագետի հետ կրկին', true, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
    "nameEn" = EXCLUDED."nameEn",
    "nameRu" = EXCLUDED."nameRu", 
    "nameHy" = EXCLUDED."nameHy",
    "descriptionEn" = EXCLUDED."descriptionEn",
    "descriptionRu" = EXCLUDED."descriptionRu",
    "descriptionHy" = EXCLUDED."descriptionHy",
    "isActive" = EXCLUDED."isActive",
    "updatedAt" = NOW();

-- Display completion message
SELECT 'Empty database schema with comprehensive review reasons created successfully!' as status;
SELECT 'All tables, indexes, sequences, and review reasons have been created.' as message;
SELECT 'You can now upload this to your Google Cloud SQL instance.' as instruction;
SELECT COUNT(*) as total_review_reasons FROM "Reason";

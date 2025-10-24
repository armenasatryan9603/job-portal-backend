-- PostgreSQL Dummy Data Script for Marketplace Backend
-- This script will populate all tables with realistic dummy data

-- Clear existing data (in correct order due to foreign key constraints)
DELETE FROM "Message";
DELETE FROM "ConversationParticipant";
DELETE FROM "Conversation";
DELETE FROM "MediaFile";
DELETE FROM "Review";
DELETE FROM "OrderProposal";
DELETE FROM "Order";
DELETE FROM "Card";
DELETE FROM "ServiceTechnology";
DELETE FROM "ServiceFeature";
DELETE FROM "Technology";
DELETE FROM "Feature";
DELETE FROM "UserService";
DELETE FROM "Service";
DELETE FROM "ReferralReward";
DELETE FROM "User";
DELETE FROM "OrderPricing";

-- Reset sequences
ALTER SEQUENCE "User_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Service_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Order_id_seq" RESTART WITH 1;
ALTER SEQUENCE "OrderProposal_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Review_id_seq" RESTART WITH 1;
ALTER SEQUENCE "MediaFile_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Card_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Conversation_id_seq" RESTART WITH 1;
ALTER SEQUENCE "ConversationParticipant_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Message_id_seq" RESTART WITH 1;
ALTER SEQUENCE "UserService_id_seq" RESTART WITH 1;
ALTER SEQUENCE "OrderPricing_id_seq" RESTART WITH 1;
ALTER SEQUENCE "ReferralReward_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Feature_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Technology_id_seq" RESTART WITH 1;
ALTER SEQUENCE "ServiceFeature_id_seq" RESTART WITH 1;
ALTER SEQUENCE "ServiceTechnology_id_seq" RESTART WITH 1;

-- Sequences are already reset to start from 1 above

-- Insert Features
INSERT INTO "Feature" (name, "nameEn", "nameRu", "nameHy", description, "descriptionEn", "descriptionRu", "descriptionHy", "isActive", "createdAt", "updatedAt") VALUES
('Responsive Design', 'Responsive Design', 'Адаптивный дизайн', 'Ադապտիվ դիզայն', 'Mobile-friendly design that works on all devices', 'Mobile-friendly design that works on all devices', 'Мобильный дизайн, который работает на всех устройствах', 'Բջջային դիզայն, որը աշխատում է բոլոր սարքերում', true, NOW(), NOW()),
('SEO Optimization', 'SEO Optimization', 'SEO оптимизация', 'SEO օպտիմիզացում', 'Search engine optimization for better visibility', 'Search engine optimization for better visibility', 'Оптимизация поисковых систем для лучшей видимости', 'Որոնման համակարգերի օպտիմիզացում ավելի լավ տեսանելիության համար', true, NOW(), NOW()),
('Payment Integration', 'Payment Integration', 'Интеграция платежей', 'Վճարումների ինտեգրացիա', 'Secure payment processing with multiple gateways', 'Secure payment processing with multiple gateways', 'Безопасная обработка платежей с несколькими шлюзами', 'Անվտանգ վճարումների մշակում բազմաթիվ դարպասներով', true, NOW(), NOW()),
('User Authentication', 'User Authentication', 'Аутентификация пользователей', 'Օգտագործողների իսկության ստուգում', 'Secure login and user management system', 'Secure login and user management system', 'Безопасная система входа и управления пользователями', 'Անվտանգ մուտքի և օգտագործողների կառավարման համակարգ', true, NOW(), NOW()),
('Real-time Updates', 'Real-time Updates', 'Обновления в реальном времени', 'Ժամանակակից թարմացումներ', 'Live updates and notifications', 'Live updates and notifications', 'Живые обновления и уведомления', 'Կենդանի թարմացումներ և ծանուցումներ', true, NOW(), NOW()),
('Admin Dashboard', 'Admin Dashboard', 'Панель администратора', 'Ադմինիստրատորի վահանակ', 'Comprehensive admin panel for management', 'Comprehensive admin panel for management', 'Комплексная панель администратора для управления', 'Ընդհանուր ադմինիստրատորի վահանակ կառավարման համար', true, NOW(), NOW()),
('Analytics & Reporting', 'Analytics & Reporting', 'Аналитика и отчетность', 'Վերլուծություն և հաշվետվություն', 'Detailed analytics and business intelligence', 'Detailed analytics and business intelligence', 'Детальная аналитика и бизнес-аналитика', 'Մանրամասն վերլուծություն և բիզնես-վերլուծություն', true, NOW(), NOW()),
('Content Management', 'Content Management', 'Управление контентом', 'Բովանդակության կառավարում', 'Easy content creation and editing system', 'Easy content creation and editing system', 'Простая система создания и редактирования контента', 'Հեշտ բովանդակության ստեղծման և խմբագրման համակարգ', true, NOW(), NOW());

-- Insert Technologies
INSERT INTO "Technology" (name, "nameEn", "nameRu", "nameHy", description, "descriptionEn", "descriptionRu", "descriptionHy", "isActive", "createdAt", "updatedAt") VALUES
('React', 'React', 'React', 'React', 'Modern JavaScript library for building user interfaces', 'Modern JavaScript library for building user interfaces', 'Современная JavaScript библиотека для создания пользовательских интерфейсов', 'Ժամանակակից JavaScript գրադարան օգտագործողի ինտերֆեյսներ ստեղծելու համար', true, NOW(), NOW()),
('Node.js', 'Node.js', 'Node.js', 'Node.js', 'JavaScript runtime for server-side development', 'JavaScript runtime for server-side development', 'JavaScript среда выполнения для серверной разработки', 'JavaScript կատարման միջավայր սերվերային մշակման համար', true, NOW(), NOW()),
('TypeScript', 'TypeScript', 'TypeScript', 'TypeScript', 'Typed superset of JavaScript for better development', 'Typed superset of JavaScript for better development', 'Типизированное надмножество JavaScript для лучшей разработки', 'JavaScript-ի տիպիզացված գերբազմություն ավելի լավ մշակման համար', true, NOW(), NOW()),
('PostgreSQL', 'PostgreSQL', 'PostgreSQL', 'PostgreSQL', 'Advanced open-source relational database', 'Advanced open-source relational database', 'Передовая открытая реляционная база данных', 'Ընդլայնված բաց կոդով ռելացիոն տվյալների բազա', true, NOW(), NOW()),
('MongoDB', 'MongoDB', 'MongoDB', 'MongoDB', 'NoSQL document database for flexible data storage', 'NoSQL document database for flexible data storage', 'NoSQL документная база данных для гибкого хранения данных', 'NoSQL փաստաթղթային տվյալների բազա ճկուն տվյալների պահպանման համար', true, NOW(), NOW()),
('AWS', 'AWS', 'AWS', 'AWS', 'Amazon Web Services cloud platform', 'Amazon Web Services cloud platform', 'Облачная платформа Amazon Web Services', 'Amazon Web Services ամպային հարթակ', true, NOW(), NOW()),
('Docker', 'Docker', 'Docker', 'Docker', 'Containerization platform for application deployment', 'Containerization platform for application deployment', 'Платформа контейнеризации для развертывания приложений', 'Կոնտեյներացման հարթակ հավելվածների տեղակայման համար', true, NOW(), NOW()),
('Figma', 'Figma', 'Figma', 'Figma', 'Collaborative design tool for UI/UX', 'Collaborative design tool for UI/UX', 'Инструмент совместного дизайна для UI/UX', 'UI/UX համագործակցային դիզայնի գործիք', true, NOW(), NOW()),
('Adobe Creative Suite', 'Adobe Creative Suite', 'Adobe Creative Suite', 'Adobe Creative Suite', 'Professional design and creative software', 'Professional design and creative software', 'Профессиональное программное обеспечение для дизайна и творчества', 'Պրոֆեսիոնալ դիզայնի և ստեղծագործական ծրագրակազմ', true, NOW(), NOW()),
('Google Analytics', 'Google Analytics', 'Google Analytics', 'Google Analytics', 'Web analytics service for tracking and reporting', 'Web analytics service for tracking and reporting', 'Веб-аналитический сервис для отслеживания и отчетности', 'Վեբ վերլուծական ծառայություն հետևման և հաշվետվության համար', true, NOW(), NOW()),
('Stripe', 'Stripe', 'Stripe', 'Stripe', 'Payment processing platform for online businesses', 'Payment processing platform for online businesses', 'Платформа обработки платежей для онлайн-бизнеса', 'Վճարումների մշակման հարթակ առցանց բիզնեսի համար', true, NOW(), NOW()),
('Mailchimp', 'Mailchimp', 'Mailchimp', 'Mailchimp', 'Email marketing and automation platform', 'Email marketing and automation platform', 'Платформа email-маркетинга и автоматизации', 'Email մարքեթինգի և ավտոմատացման հարթակ', true, NOW(), NOW());

-- Insert Services (hierarchical structure)
INSERT INTO "Service" (name, description, "nameEn", "nameRu", "nameHy", "descriptionEn", "descriptionRu", "descriptionHy", "parentId", "averagePrice", "minPrice", "maxPrice", "updatedAt") VALUES
-- Parent services
('Technology', 'Software development, IT consulting, and technical services', 'Technology', 'Технологии', 'Տեխնոլոգիա', 'Software development, IT consulting, and technical services', 'Разработка программного обеспечения, ИТ-консалтинг и технические услуги', 'Ծրագրային ապահովման մշակում, ՏՏ խորհրդատվություն և տեխնիկական ծառայություններ', NULL, 75.00, 50.00, 150.00, NOW()),
('Design', 'Creative design services for digital and print media', 'Design', 'Дизайн', 'Դիզայն', 'Creative design services for digital and print media', 'Креативные дизайнерские услуги для цифровых и печатных медиа', 'Կրեատիվ դիզայնի ծառայություններ թվային և տպագիր մեդիայի համար', NULL, 60.00, 30.00, 120.00, NOW()),
('Marketing', 'Digital marketing, advertising, and promotional services', 'Marketing', 'Маркетинг', 'Մարքեթինգ', 'Digital marketing, advertising, and promotional services', 'Цифровой маркетинг, реклама и рекламные услуги', 'Թվային մարքեթինգ, գովազդ և գովազդային ծառայություններ', NULL, 50.00, 25.00, 100.00, NOW()),
('Business', 'Business consulting, strategy, and operational services', 'Business', 'Бизнес', 'Բիզնես', 'Business consulting, strategy, and operational services', 'Бизнес-консалтинг, стратегия и операционные услуги', 'Բիզնես խորհրդատվություն, ռազմավարություն և գործառնական ծառայություններ', NULL, 80.00, 40.00, 150.00, NOW()),
('Writing', 'Content creation, copywriting, and editorial services', 'Writing', 'Письмо', 'Գրել', 'Content creation, copywriting, and editorial services', 'Создание контента, копирайтинг и редакционные услуги', 'Բովանդակության ստեղծում, կոպիրայթինգ և խմբագրական ծառայություններ', NULL, 35.00, 20.00, 70.00, NOW()),

-- Technology sub-services
('Web Development', 'Custom website and web application development', 'Web Development', 'Веб-разработка', 'Վեբ մշակում', 'Custom website and web application development', 'Разработка пользовательских веб-сайтов и веб-приложений', 'Անհատական կայքերի և վեբ հավելվածների մշակում', 1, 80.00, 50.00, 150.00, NOW()),
('Mobile Development', 'iOS and Android app development', 'Mobile Development', 'Мобильная разработка', 'Բջջային մշակում', 'iOS and Android app development', 'Разработка приложений для iOS и Android', 'iOS և Android հավելվածների մշակում', 1, 90.00, 60.00, 180.00, NOW()),
('Backend Development', 'Server-side development and API creation', 'Backend Development', 'Backend разработка', 'Backend մշակում', 'Server-side development and API creation', 'Серверная разработка и создание API', 'Սերվերի մշակում և API ստեղծում', 1, 85.00, 55.00, 160.00, NOW()),
('DevOps', 'Infrastructure, deployment, and automation services', 'DevOps', 'DevOps', 'DevOps', 'Infrastructure, deployment, and automation services', 'Инфраструктура, развертывание и услуги автоматизации', 'Ինֆրակառուցվածք, տեղակայում և ավտոմատացման ծառայություններ', 1, 95.00, 65.00, 170.00, NOW()),
('Data Science', 'Data analysis, machine learning, and AI solutions', 'Data Science', 'Наука о данных', 'Տվյալների գիտություն', 'Data analysis, machine learning, and AI solutions', 'Анализ данных, машинное обучение и решения ИИ', 'Տվյալների վերլուծություն, մեքենայական ուսուցում և AI լուծումներ', 1, 100.00, 70.00, 200.00, NOW()),

-- Design sub-services
('UI/UX Design', 'User interface and user experience design', 'UI/UX Design', 'UI/UX Дизайн', 'UI/UX Դիզայն', 'User interface and user experience design', 'Дизайн пользовательского интерфейса и пользовательского опыта', 'Օգտագործողի ինտերֆեյսի և օգտագործողի փորձի դիզայն', 2, 70.00, 40.00, 130.00, NOW()),
('Graphic Design', 'Logo design, branding, and visual identity', 'Graphic Design', 'Графический дизайн', 'Գրաֆիկական դիզայն', 'Logo design, branding, and visual identity', 'Дизайн логотипов, брендинг и визуальная идентичность', 'Լոգոյի դիզայն, բրենդինգ և տեսողական ինքնություն', 2, 55.00, 30.00, 100.00, NOW()),
('Web Design', 'Website layout and visual design', 'Web Design', 'Веб-дизайн', 'Վեբ դիզայն', 'Website layout and visual design', 'Макет веб-сайта и визуальный дизайн', 'Կայքի դասավորություն և տեսողական դիզայն', 2, 65.00, 35.00, 120.00, NOW()),
('Print Design', 'Business cards, flyers, and print materials', 'Print Design', 'Печатный дизайн', 'Տպագիր դիզայն', 'Business cards, flyers, and print materials', 'Визитки, флаеры и печатные материалы', 'Այցեքարտեր, թռուցիկներ և տպագիր նյութեր', 2, 45.00, 25.00, 80.00, NOW()),

-- Marketing sub-services
('Digital Marketing', 'Online marketing strategies and campaigns', 'Digital Marketing', 'Цифровой маркетинг', 'Թվային մարքեթինգ', 'Online marketing strategies and campaigns', 'Онлайн маркетинговые стратегии и кампании', 'Առցանց մարքեթինգային ռազմավարություններ և արշավներ', 3, 60.00, 30.00, 120.00, NOW()),
('SEO', 'Search engine optimization services', 'SEO', 'SEO', 'SEO', 'Search engine optimization services', 'Услуги по оптимизации поисковых систем', 'Որոնման համակարգերի օպտիմիզացման ծառայություններ', 3, 55.00, 25.00, 100.00, NOW()),
('Social Media Marketing', 'Social media strategy and management', 'Social Media Marketing', 'Маркетинг в социальных сетях', 'Սոցիալական մեդիայի մարքեթինգ', 'Social media strategy and management', 'Стратегия и управление социальными сетями', 'Սոցիալական մեդիայի ռազմավարություն և կառավարում', 3, 45.00, 20.00, 80.00, NOW()),
('Content Marketing', 'Content strategy and creation', 'Content Marketing', 'Контент-маркетинг', 'Բովանդակության մարքեթինգ', 'Content strategy and creation', 'Стратегия контента и создание', 'Բովանդակության ռազմավարություն և ստեղծում', 3, 50.00, 25.00, 90.00, NOW()),

-- Business sub-services
('Business Consulting', 'Strategic business advice and planning', 'Business Consulting', 'Бизнес-консалтинг', 'Բիզնես խորհրդատվություն', 'Strategic business advice and planning', 'Стратегические бизнес-советы и планирование', 'Ռազմավարական բիզնես խորհուրդներ և պլանավորում', 4, 90.00, 50.00, 180.00, NOW()),
('Project Management', 'Project planning and execution services', 'Project Management', 'Управление проектами', 'Ծրագրերի կառավարում', 'Project planning and execution services', 'Услуги планирования и выполнения проектов', 'Ծրագրերի պլանավորման և կատարման ծառայություններ', 4, 70.00, 40.00, 130.00, NOW()),
('Financial Consulting', 'Financial planning and analysis', 'Financial Consulting', 'Финансовый консалтинг', 'Ֆինանսական խորհրդատվություն', 'Financial planning and analysis', 'Финансовое планирование и анализ', 'Ֆինանսական պլանավորում և վերլուծություն', 4, 85.00, 45.00, 160.00, NOW()),

-- Writing sub-services
('Content Writing', 'Blog posts, articles, and web content', 'Content Writing', 'Написание контента', 'Բովանդակության գրում', 'Blog posts, articles, and web content', 'Блог-посты, статьи и веб-контент', 'Բլոգ գրառումներ, հոդվածներ և վեբ բովանդակություն', 5, 30.00, 15.00, 60.00, NOW()),
('Copywriting', 'Sales copy and marketing materials', 'Copywriting', 'Копирайтинг', 'Կոպիրայթինգ', 'Sales copy and marketing materials', 'Продающие тексты и маркетинговые материалы', 'Վաճառքի տեքստեր և մարքեթինգային նյութեր', 5, 40.00, 20.00, 80.00, NOW()),
('Technical Writing', 'Documentation and technical content', 'Technical Writing', 'Техническое письмо', 'Տեխնիկական գրում', 'Documentation and technical content', 'Документация и технический контент', 'Փաստաթղթավորում և տեխնիկական բովանդակություն', 5, 45.00, 25.00, 85.00, NOW());

-- Insert ServiceFeature relationships
INSERT INTO "ServiceFeature" ("serviceId", "featureId", "createdAt") VALUES
-- Web Development features
(6, 1, NOW()), -- Responsive Design
(6, 2, NOW()), -- SEO Optimization
(6, 3, NOW()), -- Payment Integration
(6, 4, NOW()), -- User Authentication
(6, 5, NOW()), -- Real-time Updates
(6, 6, NOW()), -- Admin Dashboard
(6, 7, NOW()), -- Analytics & Reporting
(6, 8, NOW()), -- Content Management

-- Mobile Development features
(7, 1, NOW()), -- Responsive Design
(7, 4, NOW()), -- User Authentication
(7, 5, NOW()), -- Real-time Updates
(7, 6, NOW()), -- Admin Dashboard
(7, 7, NOW()), -- Analytics & Reporting

-- Backend Development features
(8, 3, NOW()), -- Payment Integration
(8, 4, NOW()), -- User Authentication
(8, 5, NOW()), -- Real-time Updates
(8, 6, NOW()), -- Admin Dashboard
(8, 7, NOW()), -- Analytics & Reporting

-- DevOps features
(9, 6, NOW()), -- Admin Dashboard
(9, 7, NOW()), -- Analytics & Reporting

-- Data Science features
(10, 6, NOW()), -- Admin Dashboard
(10, 7, NOW()), -- Analytics & Reporting

-- UI/UX Design features
(11, 1, NOW()), -- Responsive Design
(11, 8, NOW()), -- Content Management

-- Graphic Design features
(12, 8, NOW()), -- Content Management

-- Web Design features
(13, 1, NOW()), -- Responsive Design
(13, 2, NOW()), -- SEO Optimization
(13, 8, NOW()), -- Content Management

-- Print Design features
(14, 8, NOW()), -- Content Management

-- Digital Marketing features
(15, 2, NOW()), -- SEO Optimization
(15, 7, NOW()), -- Analytics & Reporting
(15, 8, NOW()), -- Content Management

-- SEO features
(16, 2, NOW()), -- SEO Optimization
(16, 7, NOW()), -- Analytics & Reporting

-- Social Media Marketing features
(17, 7, NOW()), -- Analytics & Reporting
(17, 8, NOW()), -- Content Management

-- Content Marketing features
(18, 2, NOW()), -- SEO Optimization
(18, 7, NOW()), -- Analytics & Reporting
(18, 8, NOW()), -- Content Management

-- Business Consulting features
(19, 6, NOW()), -- Admin Dashboard
(19, 7, NOW()), -- Analytics & Reporting

-- Project Management features
(20, 6, NOW()), -- Admin Dashboard
(20, 7, NOW()), -- Analytics & Reporting

-- Financial Consulting features
(21, 6, NOW()), -- Admin Dashboard
(21, 7, NOW()), -- Analytics & Reporting

-- Content Writing features
(22, 8, NOW()), -- Content Management

-- Copywriting features
(23, 8, NOW()), -- Content Management

-- Technical Writing features
(24, 8, NOW()); -- Content Management

-- Insert ServiceTechnology relationships
INSERT INTO "ServiceTechnology" ("serviceId", "technologyId", "createdAt") VALUES
-- Web Development technologies
(6, 1, NOW()), -- React
(6, 2, NOW()), -- Node.js
(6, 3, NOW()), -- TypeScript
(6, 4, NOW()), -- PostgreSQL
(6, 10, NOW()), -- Stripe

-- Mobile Development technologies
(7, 1, NOW()), -- React
(7, 2, NOW()), -- Node.js
(7, 3, NOW()), -- TypeScript
(7, 4, NOW()), -- PostgreSQL

-- Backend Development technologies
(8, 2, NOW()), -- Node.js
(8, 3, NOW()), -- TypeScript
(8, 4, NOW()), -- PostgreSQL
(8, 5, NOW()), -- MongoDB

-- DevOps technologies
(9, 6, NOW()), -- AWS
(9, 7, NOW()), -- Docker

-- Data Science technologies
(10, 4, NOW()), -- PostgreSQL
(10, 5, NOW()), -- MongoDB
(10, 6, NOW()), -- AWS

-- UI/UX Design technologies
(11, 8, NOW()), -- Figma

-- Graphic Design technologies
(12, 9, NOW()), -- Adobe Creative Suite

-- Web Design technologies
(13, 1, NOW()), -- React
(13, 8, NOW()), -- Figma

-- Print Design technologies
(14, 9, NOW()), -- Adobe Creative Suite

-- Digital Marketing technologies
(15, 10, NOW()), -- Google Analytics
(15, 12, NOW()), -- Mailchimp

-- SEO technologies
(16, 10, NOW()), -- Google Analytics

-- Social Media Marketing technologies
(17, 10, NOW()), -- Google Analytics
(17, 12, NOW()), -- Mailchimp

-- Content Marketing technologies
(18, 10, NOW()), -- Google Analytics
(18, 12, NOW()); -- Mailchimp

-- Insert Users (mix of clients and specialists)
INSERT INTO "User" (role, name, email, phone, "passwordHash", "avatarUrl", bio, "creditBalance", verified, "experienceYears", "priceMin", "priceMax", location, "createdAt") VALUES
-- Test User Armen (for comprehensive testing)
('client', 'Armen', 'armen@test.com', '+374-91-123456', '$2b$10$Z2y36TXw9NMn2ncGEoZK0u1c0SrhM6SQ4LDgEmK8T7Py8SR.BfI2K', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'Test user for comprehensive feature testing across all platform functionality.', 1000.00, true, NULL, NULL, NULL, 'Yerevan, Armenia', NOW() - INTERVAL '1 day'),
-- Test User 15 (for chat action buttons testing)
('client', 'Test User 15', 'user15@test.com', '+374-91-123457', '$2b$10$Z2y36TXw9NMn2ncGEoZK0u1c0SrhM6SQ4LDgEmK8T7Py8SR.BfI2K', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'Test user for chat action buttons functionality testing.', 100.00, true, NULL, NULL, NULL, 'Yerevan, Armenia', NOW() - INTERVAL '1 day'),
-- Clients
('client', 'John Smith', 'john.smith@email.com', '+1-555-0101', '$2b$10$example.hash.1', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'Looking for quality services for my business needs.', 150.00, true, NULL, NULL, NULL, NULL, NOW() - INTERVAL '30 days'),
('client', 'Sarah Johnson', 'sarah.j@email.com', '+1-555-0102', '$2b$10$example.hash.2', 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150', 'Entrepreneur seeking professional services.', 200.00, true, NULL, NULL, NULL, NULL, NOW() - INTERVAL '25 days'),
('client', 'Mike Wilson', 'mike.wilson@email.com', '+1-555-0103', '$2b$10$example.hash.3', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', 'Small business owner looking for reliable partners.', 75.00, false, NULL, NULL, NULL, NULL, NOW() - INTERVAL '20 days'),
('client', 'Emily Davis', 'emily.davis@email.com', '+1-555-0104', '$2b$10$example.hash.4', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', 'Startup founder in need of various services.', 300.00, true, NULL, NULL, NULL, NULL, NOW() - INTERVAL '15 days'),
('client', 'David Brown', 'david.brown@email.com', '+1-555-0105', '$2b$10$example.hash.5', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', 'Corporate executive seeking premium services.', 500.00, true, NULL, NULL, NULL, NULL, NOW() - INTERVAL '10 days'),

-- Specialists
('specialist', 'Alex Chen', 'alex.chen@email.com', '+1-555-0201', '$2b$10$example.hash.6', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'Full-stack developer with 5+ years experience in React, Node.js, and Python.', 0.00, true, 5, 50.00, 100.00, 'San Francisco, CA', NOW() - INTERVAL '45 days'),
('specialist', 'Maria Rodriguez', 'maria.rodriguez@email.com', '+1-555-0202', '$2b$10$example.hash.7', 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150', 'UI/UX Designer specializing in mobile and web applications.', 0.00, true, 4, 40.00, 80.00, 'New York, NY', NOW() - INTERVAL '40 days'),
('specialist', 'James Taylor', 'james.taylor@email.com', '+1-555-0203', '$2b$10$example.hash.8', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', 'Digital marketing expert with proven track record in SEO and social media.', 0.00, true, 6, 30.00, 60.00, 'Los Angeles, CA', NOW() - INTERVAL '35 days'),
('specialist', 'Lisa Wang', 'lisa.wang@email.com', '+1-555-0204', '$2b$10$example.hash.9', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', 'Content writer and copywriter with expertise in tech and business writing.', 0.00, false, 3, 25.00, 50.00, 'Chicago, IL', NOW() - INTERVAL '30 days'),
('specialist', 'Robert Kim', 'robert.kim@email.com', '+1-555-0205', '$2b$10$example.hash.10', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', 'DevOps engineer specializing in AWS, Docker, and CI/CD pipelines.', 0.00, true, 7, 60.00, 120.00, 'Seattle, WA', NOW() - INTERVAL '25 days'),
('specialist', 'Jennifer Lee', 'jennifer.lee@email.com', '+1-555-0206', '$2b$10$example.hash.11', 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150', 'Data scientist with expertise in machine learning and analytics.', 0.00, true, 4, 45.00, 90.00, 'Austin, TX', NOW() - INTERVAL '20 days'),
('specialist', 'Michael Garcia', 'michael.garcia@email.com', '+1-555-0207', '$2b$10$example.hash.12', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', 'Graphic designer creating stunning visuals for brands and businesses.', 0.00, true, 3, 35.00, 70.00, 'Miami, FL', NOW() - INTERVAL '15 days'),
('specialist', 'Amanda White', 'amanda.white@email.com', '+1-555-0208', '$2b$10$example.hash.13', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', 'Project manager with expertise in agile methodologies and team leadership.', 0.00, false, 5, 40.00, 80.00, 'Denver, CO', NOW() - INTERVAL '10 days');

-- Insert UserService relationships (specialists and their services)
-- Alex Chen (Full-stack developer) - Web Development, Mobile Development, Backend Development
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 6, true, NOW() - INTERVAL '45 days', NOW() FROM "User" u WHERE u.email = 'alex.chen@email.com';
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 7, true, NOW() - INTERVAL '45 days', NOW() FROM "User" u WHERE u.email = 'alex.chen@email.com';
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 8, true, NOW() - INTERVAL '45 days', NOW() FROM "User" u WHERE u.email = 'alex.chen@email.com';

-- Maria Rodriguez (UI/UX Designer) - UI/UX Design, Graphic Design
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 11, true, NOW() - INTERVAL '40 days', NOW() FROM "User" u WHERE u.email = 'maria.rodriguez@email.com';
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 12, true, NOW() - INTERVAL '40 days', NOW() FROM "User" u WHERE u.email = 'maria.rodriguez@email.com';

-- James Taylor (Digital Marketing Expert) - Digital Marketing, SEO, Social Media Marketing
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 15, true, NOW() - INTERVAL '35 days', NOW() FROM "User" u WHERE u.email = 'james.taylor@email.com';
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 16, true, NOW() - INTERVAL '35 days', NOW() FROM "User" u WHERE u.email = 'james.taylor@email.com';
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 17, true, NOW() - INTERVAL '35 days', NOW() FROM "User" u WHERE u.email = 'james.taylor@email.com';

-- Lisa Wang (Content Writer) - Content Writing, Copywriting, Technical Writing
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 22, true, NOW() - INTERVAL '30 days', NOW() FROM "User" u WHERE u.email = 'lisa.wang@email.com';
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 23, true, NOW() - INTERVAL '30 days', NOW() FROM "User" u WHERE u.email = 'lisa.wang@email.com';
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 24, true, NOW() - INTERVAL '30 days', NOW() FROM "User" u WHERE u.email = 'lisa.wang@email.com';

-- Robert Kim (DevOps Engineer) - DevOps, Backend Development
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 9, true, NOW() - INTERVAL '25 days', NOW() FROM "User" u WHERE u.email = 'robert.kim@email.com';
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 8, true, NOW() - INTERVAL '25 days', NOW() FROM "User" u WHERE u.email = 'robert.kim@email.com';

-- Jennifer Lee (Data Scientist) - Data Science, Web Development
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 10, true, NOW() - INTERVAL '20 days', NOW() FROM "User" u WHERE u.email = 'jennifer.lee@email.com';
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 6, true, NOW() - INTERVAL '20 days', NOW() FROM "User" u WHERE u.email = 'jennifer.lee@email.com';

-- Michael Garcia (Graphic Designer) - Graphic Design, Web Design
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 12, true, NOW() - INTERVAL '15 days', NOW() FROM "User" u WHERE u.email = 'michael.garcia@email.com';
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 13, true, NOW() - INTERVAL '15 days', NOW() FROM "User" u WHERE u.email = 'michael.garcia@email.com';

-- Amanda White (Project Manager) - Business Consulting, Project Management
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 19, true, NOW() - INTERVAL '10 days', NOW() FROM "User" u WHERE u.email = 'amanda.white@email.com';
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled", "createdAt", "updatedAt") 
SELECT u.id, 20, true, NOW() - INTERVAL '10 days', NOW() FROM "User" u WHERE u.email = 'amanda.white@email.com';

-- Insert Cards (payment methods for users)
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123armen', 'visa', '1234', 12, 2027, 'Armen', true, true, NOW() - INTERVAL '1 day', NOW() FROM "User" u WHERE u.email = 'armen@test.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123armen2', 'mastercard', '5678', 8, 2026, 'Armen', false, true, NOW() - INTERVAL '1 day', NOW() FROM "User" u WHERE u.email = 'armen@test.com';

INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123abc', 'visa', '1234', 12, 2027, 'John Smith', true, true, NOW() - INTERVAL '25 days', NOW() FROM "User" u WHERE u.email = 'john.smith@email.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123def', 'mastercard', '5678', 8, 2026, 'John Smith', false, true, NOW() - INTERVAL '20 days', NOW() FROM "User" u WHERE u.email = 'john.smith@email.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123ghi', 'visa', '9012', 5, 2028, 'Sarah Johnson', true, true, NOW() - INTERVAL '22 days', NOW() FROM "User" u WHERE u.email = 'sarah.j@email.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123jkl', 'amex', '3456', 11, 2025, 'Mike Wilson', true, true, NOW() - INTERVAL '18 days', NOW() FROM "User" u WHERE u.email = 'mike.wilson@email.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123mno', 'visa', '7890', 3, 2029, 'Emily Davis', true, true, NOW() - INTERVAL '12 days', NOW() FROM "User" u WHERE u.email = 'emily.davis@email.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123pqr', 'mastercard', '2345', 9, 2027, 'Emily Davis', false, true, NOW() - INTERVAL '10 days', NOW() FROM "User" u WHERE u.email = 'emily.davis@email.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123stu', 'visa', '6789', 6, 2030, 'David Brown', true, true, NOW() - INTERVAL '8 days', NOW() FROM "User" u WHERE u.email = 'david.brown@email.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123vwx', 'amex', '0123', 2, 2026, 'David Brown', false, true, NOW() - INTERVAL '5 days', NOW() FROM "User" u WHERE u.email = 'david.brown@email.com';

-- Cards for specialists (for receiving payments)
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123yz1', 'visa', '4567', 7, 2028, 'Alex Chen', true, true, NOW() - INTERVAL '40 days', NOW() FROM "User" u WHERE u.email = 'alex.chen@email.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123yz2', 'mastercard', '8901', 4, 2027, 'Maria Rodriguez', true, true, NOW() - INTERVAL '35 days', NOW() FROM "User" u WHERE u.email = 'maria.rodriguez@email.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123yz3', 'visa', '2345', 10, 2029, 'James Taylor', true, true, NOW() - INTERVAL '30 days', NOW() FROM "User" u WHERE u.email = 'james.taylor@email.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123yz4', 'amex', '6789', 1, 2026, 'Lisa Wang', true, true, NOW() - INTERVAL '25 days', NOW() FROM "User" u WHERE u.email = 'lisa.wang@email.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123yz5', 'visa', '0123', 8, 2028, 'Robert Kim', true, true, NOW() - INTERVAL '20 days', NOW() FROM "User" u WHERE u.email = 'robert.kim@email.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123yz6', 'mastercard', '4567', 12, 2027, 'Jennifer Lee', true, true, NOW() - INTERVAL '15 days', NOW() FROM "User" u WHERE u.email = 'jennifer.lee@email.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123yz7', 'visa', '8901', 5, 2030, 'Michael Garcia', true, true, NOW() - INTERVAL '12 days', NOW() FROM "User" u WHERE u.email = 'michael.garcia@email.com';
INSERT INTO "Card" ("userId", "paymentMethodId", brand, last4, "expMonth", "expYear", "holderName", "isDefault", "isActive", "createdAt", "updatedAt") 
SELECT u.id, 'pm_1HvX9Y2eZvKYlo2C4z123yz8', 'mastercard', '2345', 9, 2026, 'Amanda White', true, true, NOW() - INTERVAL '8 days', NOW() FROM "User" u WHERE u.email = 'amanda.white@email.com';

-- Insert Orders
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 6, 'Armen''s E-commerce Platform', 'Need a comprehensive e-commerce platform for my online business with advanced features, payment integration, and inventory management.', 7500.00, 'open', NOW() - INTERVAL '1 day' FROM "User" u WHERE u.email = 'armen@test.com';
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 7, 'Armen''s Mobile App', 'Looking to develop a mobile application for my startup with both iOS and Android versions. Need modern UI/UX and real-time features.', 12000.00, 'in_progress', NOW() - INTERVAL '1 day' FROM "User" u WHERE u.email = 'armen@test.com';
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 11, 'Armen''s Brand Identity', 'Complete brand identity package including logo design, business cards, letterhead, and brand guidelines for my new company.', 2000.00, 'completed', NOW() - INTERVAL '1 day' FROM "User" u WHERE u.email = 'armen@test.com';
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 15, 'Armen''s Digital Marketing', 'Comprehensive digital marketing strategy and execution for my business including SEO, social media, and content marketing.', 3000.00, 'open', NOW() - INTERVAL '1 day' FROM "User" u WHERE u.email = 'armen@test.com';
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 19, 'Armen''s Business Strategy', 'Strategic business consultation for scaling my startup, including market analysis, growth strategy, and funding advice.', 1500.00, 'in_progress', NOW() - INTERVAL '1 day' FROM "User" u WHERE u.email = 'armen@test.com';

-- Test Order for User 15 (chat action buttons testing)
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 1, 'User 15 Test Order', 'This is a test order created by user 15 to test client functionality.', 5000.00, 'open', NOW() - INTERVAL '1 day' FROM "User" u WHERE u.email = 'user15@test.com';

-- Other orders
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 6, 'E-commerce Website Development', 'Need a modern e-commerce website for my clothing store with payment integration and inventory management.', 5000.00, 'open', NOW() - INTERVAL '5 days' FROM "User" u WHERE u.email = 'john.smith@email.com';
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 6, 'Corporate Website Redesign', 'Looking to redesign our company website with modern UI/UX and mobile responsiveness.', 3000.00, 'in_progress', NOW() - INTERVAL '3 days' FROM "User" u WHERE u.email = 'sarah.j@email.com';
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 7, 'Mobile App for Restaurant', 'Need a mobile app for food ordering and delivery for my restaurant business.', 8000.00, 'open', NOW() - INTERVAL '2 days' FROM "User" u WHERE u.email = 'mike.wilson@email.com';

-- Design orders
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 11, 'Brand Identity Design', 'Complete brand identity package including logo, business cards, and brand guidelines.', 1500.00, 'completed', NOW() - INTERVAL '10 days' FROM "User" u WHERE u.email = 'emily.davis@email.com';
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 12, 'Website UI/UX Design', 'Design user interface and user experience for a SaaS application.', 2500.00, 'open', NOW() - INTERVAL '1 day' FROM "User" u WHERE u.email = 'david.brown@email.com';

-- Marketing orders
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 15, 'Digital Marketing Campaign', 'Launch a comprehensive digital marketing campaign for my new product.', 2000.00, 'open', NOW() - INTERVAL '4 days' FROM "User" u WHERE u.email = 'armen@test.com';
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 16, 'SEO Optimization', 'Improve search engine rankings for my business website.', 1200.00, 'in_progress', NOW() - INTERVAL '6 days' FROM "User" u WHERE u.email = 'john.smith@email.com';

-- Business orders
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 19, 'Business Strategy Consultation', 'Need strategic advice for scaling my startup business.', 1000.00, 'completed', NOW() - INTERVAL '8 days' FROM "User" u WHERE u.email = 'mike.wilson@email.com';
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 20, 'Project Management Setup', 'Set up project management processes and tools for my team.', 800.00, 'open', NOW() - INTERVAL '7 days' FROM "User" u WHERE u.email = 'emily.davis@email.com';

-- Writing orders
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 21, 'Content Marketing Strategy', 'Develop content marketing strategy and create initial content pieces.', 900.00, 'in_progress', NOW() - INTERVAL '9 days' FROM "User" u WHERE u.email = 'david.brown@email.com';
INSERT INTO "Order" ("clientId", "serviceId", title, description, budget, status, "createdAt") 
SELECT u.id, 22, 'Sales Copy for Landing Page', 'Write compelling sales copy for our new product landing page.', 500.00, 'open', NOW() - INTERVAL '12 days' FROM "User" u WHERE u.email = 'armen@test.com';

-- Insert Order Proposals
INSERT INTO "OrderProposal" ("orderId", "userId", price, message, status, "createdAt") VALUES
-- Proposals for Armen's orders (comprehensive testing)
-- Armen's E-commerce Platform (Order 1)
(1, 8, 7000.00, 'Hi Armen! I can deliver a comprehensive e-commerce platform with all the advanced features you need. I have extensive experience with React, Node.js, and payment integrations.', 'pending', NOW() - INTERVAL '1 day'),
(1, 9, 7200.00, 'Hello Armen! I specialize in e-commerce solutions and can provide a scalable platform with modern UI/UX design and advanced features.', 'pending', NOW() - INTERVAL '1 day'),
(1, 8, 6800.00, 'Hi! I can create a robust e-commerce platform with excellent performance and security features. Let''s discuss your specific requirements.', 'pending', NOW() - INTERVAL '1 day'),

-- Armen's Mobile App (Order 2)
(2, 8, 11000.00, 'Hi Armen! I can develop your mobile app for both iOS and Android with modern UI/UX and real-time features. I have extensive experience with React Native.', 'accepted', NOW() - INTERVAL '1 day'),
(2, 9, 11500.00, 'Hello Armen! I specialize in mobile app UI/UX design and can create an intuitive user experience for your startup app.', 'pending', NOW() - INTERVAL '1 day'),

-- Armen's Brand Identity (Order 3)
(3, 9, 1800.00, 'Hi Armen! I can create a complete brand identity package that perfectly represents your new company. I have extensive experience in branding and logo design.', 'accepted', NOW() - INTERVAL '1 day'),
(3, 14, 1900.00, 'Hello Armen! I specialize in brand identity design and can create a professional brand package for your company.', 'pending', NOW() - INTERVAL '1 day'),

-- Armen's Digital Marketing (Order 4)
(4, 10, 2800.00, 'Hi Armen! I can create a comprehensive digital marketing strategy for your business including SEO, social media, and content marketing.', 'pending', NOW() - INTERVAL '1 day'),
(4, 10, 2900.00, 'Hello Armen! I specialize in digital marketing and can help you reach your target audience effectively.', 'pending', NOW() - INTERVAL '1 day'),

-- Armen's Business Strategy (Order 5)
(5, 11, 1400.00, 'Hi Armen! I can provide strategic business consultation for scaling your startup, including market analysis and growth strategy.', 'accepted', NOW() - INTERVAL '1 day'),
(5, 15, 1450.00, 'Hello Armen! I specialize in business strategy and project management, and can help you scale your startup effectively.', 'pending', NOW() - INTERVAL '1 day'),

-- Test data for User 15 (chat action buttons testing)
-- User 15's Test Order (Order 6)
(6, 1, 4500.00, 'I would like to apply for this project', 'pending', NOW() - INTERVAL '1 day'),

-- Other proposals
-- Proposals for Order 7 (E-commerce Website)
(7, 8, 4500.00, 'I can deliver a modern e-commerce website with all the features you need. I have extensive experience with React and Node.js.', 'pending', NOW() - INTERVAL '4 days'),
(7, 8, 4800.00, 'I specialize in e-commerce solutions and can provide a scalable platform with advanced features.', 'pending', NOW() - INTERVAL '3 days'),

-- Proposals for Order 8 (Corporate Website Redesign)
(8, 8, 2800.00, 'I can help redesign your website with modern technologies and ensure mobile responsiveness.', 'accepted', NOW() - INTERVAL '2 days'),

-- Proposals for Order 9 (Mobile App)
(9, 8, 7500.00, 'I have experience building restaurant apps with ordering and delivery features.', 'pending', NOW() - INTERVAL '1 day'),

-- Proposals for Order 10 (Brand Identity)
(10, 9, 1400.00, 'I can create a comprehensive brand identity that reflects your business values.', 'accepted', NOW() - INTERVAL '9 days'),

-- Proposals for Order 11 (Website UI/UX)
(11, 9, 2200.00, 'I specialize in SaaS UI/UX design and can create an intuitive user experience.', 'pending', NOW() - INTERVAL '1 day'),

-- Proposals for Order 12 (Digital Marketing)
(12, 10, 1800.00, 'I can create a comprehensive digital marketing strategy to boost your product visibility.', 'pending', NOW() - INTERVAL '3 days'),

-- Proposals for Order 13 (SEO)
(13, 10, 1100.00, 'I have a proven track record of improving website rankings through SEO optimization.', 'accepted', NOW() - INTERVAL '5 days'),

-- Proposals for Order 14 (Business Strategy)
(14, 11, 900.00, 'I can provide strategic guidance to help scale your startup effectively.', 'accepted', NOW() - INTERVAL '7 days'),

-- Proposals for Order 15 (Project Management)
(15, 15, 700.00, 'I can set up efficient project management processes and recommend the best tools for your team.', 'pending', NOW() - INTERVAL '6 days'),

-- Proposals for Order 16 (Content Marketing)
(16, 11, 850.00, 'I can develop a content strategy that aligns with your business goals and target audience.', 'accepted', NOW() - INTERVAL '8 days'),

-- Proposals for Order 17 (Sales Copy)
(17, 11, 450.00, 'I specialize in conversion-focused copywriting and can create compelling sales copy for your landing page.', 'pending', NOW() - INTERVAL '11 days');

-- Insert Reviews
INSERT INTO "Review" ("orderId", "reviewerId", "specialistId", rating, comment, "createdAt", "updatedAt") VALUES
-- Reviews for Armen's completed orders
(3, 1, 9, 5, 'Excellent work! The brand identity perfectly captures my company values. Maria was very professional and creative. Highly recommended!', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(5, 1, 11, 5, 'Outstanding business strategy consultation! Lisa provided valuable insights that helped me identify key growth opportunities. Will definitely work together again.', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
-- Reviews for other completed orders
(10, 6, 9, 5, 'Excellent work! The brand identity perfectly captures our company values. Very professional and creative.', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
(14, 5, 11, 4, 'Great strategic advice that helped us identify key growth opportunities. Highly recommended!', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
(16, 7, 11, 5, 'Outstanding content strategy. The content pieces are engaging and well-researched. Will definitely work together again.', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');

-- Insert Media Files
INSERT INTO "MediaFile" ("orderId", "fileName", "fileUrl", "fileType", "mimeType", "fileSize", "uploadedBy", "createdAt") VALUES
-- Media files for Armen's orders (comprehensive testing)
-- Armen's E-commerce Platform (Order 1)
(1, 'armen-current-website.png', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-current-website.png', 'image', 'image/png', 2048576, 1, NOW() - INTERVAL '1 day'),
(1, 'armen-business-requirements.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-business-requirements.pdf', 'document', 'application/pdf', 1024000, 1, NOW() - INTERVAL '1 day'),
(1, 'armen-brand-guidelines.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-brand-guidelines.pdf', 'document', 'application/pdf', 512000, 1, NOW() - INTERVAL '1 day'),

-- Armen's Mobile App (Order 2)
(2, 'armen-app-wireframes.fig', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-app-wireframes.fig', 'design', 'application/octet-stream', 2048000, 1, NOW() - INTERVAL '1 day'),
(2, 'armen-app-requirements.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-app-requirements.pdf', 'document', 'application/pdf', 768000, 1, NOW() - INTERVAL '1 day'),
(2, 'armen-app-mockups.png', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-app-mockups.png', 'image', 'image/png', 1536000, 1, NOW() - INTERVAL '1 day'),

-- Armen's Brand Identity (Order 3)
(3, 'armen-company-values.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-company-values.pdf', 'document', 'application/pdf', 256000, 1, NOW() - INTERVAL '1 day'),
(3, 'armen-brand-inspiration.jpg', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-brand-inspiration.jpg', 'image', 'image/jpeg', 1024000, 1, NOW() - INTERVAL '1 day'),
(3, 'armen-logo-ideas.png', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-logo-ideas.png', 'image', 'image/png', 512000, 1, NOW() - INTERVAL '1 day'),

-- Armen's Digital Marketing (Order 4)
(4, 'armen-business-overview.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-business-overview.pdf', 'document', 'application/pdf', 512000, 1, NOW() - INTERVAL '1 day'),
(4, 'armen-target-audience.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-target-audience.pdf', 'document', 'application/pdf', 384000, 1, NOW() - INTERVAL '1 day'),
(4, 'armen-competitor-analysis.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-competitor-analysis.pdf', 'document', 'application/pdf', 640000, 1, NOW() - INTERVAL '1 day'),

-- Armen's Business Strategy (Order 5)
(5, 'armen-business-plan.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-business-plan.pdf', 'document', 'application/pdf', 1024000, 1, NOW() - INTERVAL '1 day'),
(5, 'armen-financial-statements.xlsx', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-financial-statements.xlsx', 'spreadsheet', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 256000, 1, NOW() - INTERVAL '1 day'),
(5, 'armen-market-research.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/armen-market-research.pdf', 'document', 'application/pdf', 768000, 1, NOW() - INTERVAL '1 day'),

-- Other media files
-- Media files for Order 6 (E-commerce Website Development)
(6, 'current-website-screenshot.jpg', 'https://s3.amazonaws.com/marketplace-bucket/uploads/current-website-screenshot.jpg', 'image', 'image/jpeg', 2048576, 2, NOW() - INTERVAL '5 days'),
(1, 'requirements-document.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/requirements-document.pdf', 'document', 'application/pdf', 1024000, 1, NOW() - INTERVAL '5 days'),
(1, 'brand-guidelines.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/brand-guidelines.pdf', 'document', 'application/pdf', 512000, 1, NOW() - INTERVAL '4 days'),

-- Media files for Order 2 (Corporate Website Redesign)
(2, 'current-homepage.png', 'https://s3.amazonaws.com/marketplace-bucket/uploads/current-homepage.png', 'image', 'image/png', 1536000, 2, NOW() - INTERVAL '3 days'),
(2, 'competitor-analysis.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/competitor-analysis.pdf', 'document', 'application/pdf', 768000, 2, NOW() - INTERVAL '3 days'),
(2, 'wireframes-sketch.jpg', 'https://s3.amazonaws.com/marketplace-bucket/uploads/wireframes-sketch.jpg', 'image', 'image/jpeg', 1024000, 2, NOW() - INTERVAL '2 days'),

-- Media files for Order 3 (Mobile App for Restaurant)
(3, 'restaurant-menu.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/restaurant-menu.pdf', 'document', 'application/pdf', 256000, 3, NOW() - INTERVAL '2 days'),
(3, 'restaurant-photos.zip', 'https://s3.amazonaws.com/marketplace-bucket/uploads/restaurant-photos.zip', 'archive', 'application/zip', 5120000, 3, NOW() - INTERVAL '2 days'),
(3, 'app-mockup.fig', 'https://s3.amazonaws.com/marketplace-bucket/uploads/app-mockup.fig', 'design', 'application/octet-stream', 2048000, 3, NOW() - INTERVAL '1 day'),

-- Media files for Order 4 (Brand Identity Design)
(4, 'current-logo.png', 'https://s3.amazonaws.com/marketplace-bucket/uploads/current-logo.png', 'image', 'image/png', 512000, 4, NOW() - INTERVAL '10 days'),
(4, 'brand-inspiration-board.jpg', 'https://s3.amazonaws.com/marketplace-bucket/uploads/brand-inspiration-board.jpg', 'image', 'image/jpeg', 1536000, 4, NOW() - INTERVAL '10 days'),
(4, 'company-values.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/company-values.pdf', 'document', 'application/pdf', 128000, 4, NOW() - INTERVAL '9 days'),

-- Media files for Order 5 (Website UI/UX Design)
(5, 'current-saas-screenshot.png', 'https://s3.amazonaws.com/marketplace-bucket/uploads/current-saas-screenshot.png', 'image', 'image/png', 2048000, 5, NOW() - INTERVAL '1 day'),
(5, 'user-personas.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/user-personas.pdf', 'document', 'application/pdf', 384000, 5, NOW() - INTERVAL '1 day'),
(5, 'feature-requirements.docx', 'https://s3.amazonaws.com/marketplace-bucket/uploads/feature-requirements.docx', 'document', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 256000, 5, NOW() - INTERVAL '1 day'),

-- Media files for Order 6 (Digital Marketing Campaign)
(6, 'product-photos.zip', 'https://s3.amazonaws.com/marketplace-bucket/uploads/product-photos.zip', 'archive', 'application/zip', 8192000, 1, NOW() - INTERVAL '4 days'),
(6, 'target-audience-analysis.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/target-audience-analysis.pdf', 'document', 'application/pdf', 512000, 1, NOW() - INTERVAL '4 days'),
(6, 'competitor-ads-collection.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/competitor-ads-collection.pdf', 'document', 'application/pdf', 1024000, 1, NOW() - INTERVAL '3 days'),

-- Media files for Order 7 (SEO Optimization)
(7, 'current-website-audit.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/current-website-audit.pdf', 'document', 'application/pdf', 768000, 2, NOW() - INTERVAL '6 days'),
(7, 'keyword-research.xlsx', 'https://s3.amazonaws.com/marketplace-bucket/uploads/keyword-research.xlsx', 'spreadsheet', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 256000, 2, NOW() - INTERVAL '6 days'),
(7, 'competitor-analysis-seo.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/competitor-analysis-seo.pdf', 'document', 'application/pdf', 640000, 2, NOW() - INTERVAL '5 days'),

-- Media files for Order 8 (Business Strategy Consultation)
(8, 'business-plan-draft.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/business-plan-draft.pdf', 'document', 'application/pdf', 1024000, 3, NOW() - INTERVAL '8 days'),
(8, 'financial-statements.xlsx', 'https://s3.amazonaws.com/marketplace-bucket/uploads/financial-statements.xlsx', 'spreadsheet', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 384000, 3, NOW() - INTERVAL '8 days'),
(8, 'market-research-data.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/market-research-data.pdf', 'document', 'application/pdf', 1536000, 3, NOW() - INTERVAL '7 days'),

-- Media files for Order 9 (Project Management Setup)
(9, 'current-processes.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/current-processes.pdf', 'document', 'application/pdf', 512000, 4, NOW() - INTERVAL '7 days'),
(9, 'team-structure-chart.png', 'https://s3.amazonaws.com/marketplace-bucket/uploads/team-structure-chart.png', 'image', 'image/png', 256000, 4, NOW() - INTERVAL '7 days'),
(9, 'project-timeline-template.xlsx', 'https://s3.amazonaws.com/marketplace-bucket/uploads/project-timeline-template.xlsx', 'spreadsheet', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 128000, 4, NOW() - INTERVAL '6 days'),

-- Media files for Order 10 (Content Marketing Strategy)
(10, 'current-content-audit.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/current-content-audit.pdf', 'document', 'application/pdf', 768000, 5, NOW() - INTERVAL '9 days'),
(10, 'content-calendar-template.xlsx', 'https://s3.amazonaws.com/marketplace-bucket/uploads/content-calendar-template.xlsx', 'spreadsheet', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 192000, 5, NOW() - INTERVAL '9 days'),
(10, 'brand-voice-guidelines.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/brand-voice-guidelines.pdf', 'document', 'application/pdf', 384000, 5, NOW() - INTERVAL '8 days'),

-- Media files for Order 11 (Sales Copy for Landing Page)
(11, 'current-landing-page.png', 'https://s3.amazonaws.com/marketplace-bucket/uploads/current-landing-page.png', 'image', 'image/png', 1024000, 1, NOW() - INTERVAL '12 days'),
(11, 'product-features-list.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/product-features-list.pdf', 'document', 'application/pdf', 256000, 1, NOW() - INTERVAL '12 days'),
(11, 'target-customer-profile.pdf', 'https://s3.amazonaws.com/marketplace-bucket/uploads/target-customer-profile.pdf', 'document', 'application/pdf', 320000, 1, NOW() - INTERVAL '11 days');

-- Update credit balances based on transactions
-- Armen's transactions (comprehensive testing)
UPDATE "User" SET "creditBalance" = "creditBalance" - 2000.00 WHERE id = 1; -- Armen paid for brand identity
UPDATE "User" SET "creditBalance" = "creditBalance" - 1500.00 WHERE id = 1; -- Armen paid for business strategy
UPDATE "User" SET "creditBalance" = "creditBalance" + 1800.00 WHERE id = 9; -- Maria earned from Armen's brand identity
UPDATE "User" SET "creditBalance" = "creditBalance" + 1400.00 WHERE id = 11; -- Lisa earned from Armen's business strategy

-- Other transactions
UPDATE "User" SET "creditBalance" = "creditBalance" - 1500.00 WHERE id = 6; -- Paid for brand identity
UPDATE "User" SET "creditBalance" = "creditBalance" - 1000.00 WHERE id = 5; -- Paid for business strategy
UPDATE "User" SET "creditBalance" = "creditBalance" - 900.00 WHERE id = 7; -- Paid for content marketing

-- Add some earnings to specialists
UPDATE "User" SET "creditBalance" = "creditBalance" + 1400.00 WHERE id = 9; -- Earned from brand identity
UPDATE "User" SET "creditBalance" = "creditBalance" + 1000.00 WHERE id = 11; -- Earned from business strategy
UPDATE "User" SET "creditBalance" = "creditBalance" + 900.00 WHERE id = 11; -- Earned from content marketing

-- Insert Conversations (chat rooms)
INSERT INTO "Conversation" (id, "orderId", title, status, "createdAt", "updatedAt") VALUES
-- Armen's order-based conversations (comprehensive testing)
(1, 1, 'Armen''s E-commerce Platform Discussion', 'active', NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 minutes'),
(2, 2, 'Armen''s Mobile App Development Chat', 'active', NOW() - INTERVAL '1 day', NOW() - INTERVAL '15 minutes'),
(3, 3, 'Armen''s Brand Identity Design Discussion', 'active', NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 hours'),
(4, 4, 'Armen''s Digital Marketing Strategy Chat', 'active', NOW() - INTERVAL '1 day', NOW() - INTERVAL '45 minutes'),
(5, 5, 'Armen''s Business Strategy Consultation', 'active', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 hour'),
-- Test conversation for User 15 (chat action buttons testing)
(16, 17, 'User 15 Test Order Discussion', 'active', NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 minutes'),
-- Additional Armen conversations for comprehensive testing
(13, NULL, 'Armen - General Tech Discussion', 'active', NOW() - INTERVAL '1 day', NOW() - INTERVAL '20 minutes'),
(14, NULL, 'Armen - Startup Networking', 'active', NOW() - INTERVAL '1 day', NOW() - INTERVAL '10 minutes'),
(15, NULL, 'Armen - Project Collaboration', 'active', NOW() - INTERVAL '1 day', NOW() - INTERVAL '5 minutes'),
-- Other order-based conversations
(6, 6, 'E-commerce Website Development Discussion', 'active', NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 hour'),
(7, 7, 'Corporate Website Redesign Chat', 'active', NOW() - INTERVAL '2 days', NOW() - INTERVAL '30 minutes'),
(8, 8, 'Brand Identity Design Discussion', 'active', NOW() - INTERVAL '9 days', NOW() - INTERVAL '2 days'),
(9, 9, 'Business Strategy Consultation', 'active', NOW() - INTERVAL '7 days', NOW() - INTERVAL '1 day'),
(10, 10, 'Content Marketing Strategy Chat', 'active', NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 hours'),
-- General conversations (not order-based)
(11, NULL, 'General Discussion', 'active', NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 hours'),
(12, NULL, 'Project Collaboration', 'active', NOW() - INTERVAL '3 days', NOW() - INTERVAL '45 minutes');

-- Insert Conversation Participants
INSERT INTO "ConversationParticipant" ("conversationId", "userId", "joinedAt", "lastReadAt", "isActive") VALUES
-- Armen's conversations (comprehensive testing)
-- Conversation 1: Armen + Alex Chen - E-commerce Platform (Armen has unread messages)
(1, 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '3 hours', true),
(1, 6, NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 minutes', true),

-- Conversation 2: Armen + Alex Chen - Mobile App (Both have read all messages)
(2, 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '15 minutes', true),
(2, 6, NOW() - INTERVAL '1 day', NOW() - INTERVAL '15 minutes', true),

-- Conversation 3: Armen + Maria Rodriguez - Brand Identity (Both have read all messages)
(3, 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 hours', true),
(3, 7, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 hours', true),

-- Conversation 4: Armen + James Taylor - Digital Marketing (Armen has unread messages)
(4, 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 hours', true),
(4, 8, NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 minutes', true),

-- Conversation 5: Armen + Lisa Wang - Business Strategy (Armen has unread messages)
(5, 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 hours', true),
(5, 9, NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 minutes', true),

-- Test conversation for User 15 (chat action buttons testing)
-- Conversation 16: User 15 (client) + User 1 (applicant) - Test Order Discussion
(16, 15, NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 minutes', true),
(16, 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 minutes', true),

-- Additional Armen conversations
-- Conversation 13: Armen + Jennifer Lee (Data Scientist) - General Tech Discussion (Armen has unread messages)
(13, 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 hours', true),
(13, 11, NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 minutes', true),

-- Conversation 14: Armen + Michael Garcia (Graphic Designer) - Startup Networking (Both have read all messages)
(14, 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '10 minutes', true),
(14, 12, NOW() - INTERVAL '1 day', NOW() - INTERVAL '10 minutes', true),

-- Conversation 15: Armen + Amanda White (Project Manager) - Project Collaboration (Armen has unread messages)
(15, 1, NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 hours', true),
(15, 13, NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 minutes', true),

-- Other conversations
-- Conversation 6: John Smith + Alex Chen - E-commerce Website (John has unread messages)
(6, 2, NOW() - INTERVAL '4 days', NOW() - INTERVAL '2 hours', true),
(6, 6, NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 hour', true),

-- Conversation 7: Sarah Johnson (client) + Alex Chen (specialist) - Corporate Website (Both have read all messages)
(7, 2, NOW() - INTERVAL '2 days', NOW() - INTERVAL '30 minutes', true),
(7, 6, NOW() - INTERVAL '2 days', NOW() - INTERVAL '30 minutes', true),

-- Conversation 8: Emily Davis (client) + Maria Rodriguez (specialist) - Brand Identity (Maria has unread messages)
(8, 4, NOW() - INTERVAL '9 days', NOW() - INTERVAL '1 day', true),
(8, 7, NOW() - INTERVAL '9 days', NOW() - INTERVAL '2 days', true),

-- Conversation 9: Mike Wilson (client) + Lisa Wang (specialist) - Business Strategy (Mike has unread messages)
(9, 3, NOW() - INTERVAL '7 days', NOW() - INTERVAL '2 hours', true),
(9, 9, NOW() - INTERVAL '7 days', NOW() - INTERVAL '1 day', true),

-- Conversation 10: David Brown (client) + Lisa Wang (specialist) - Content Marketing (Both have read all messages)
(10, 5, NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 hours', true),
(10, 9, NOW() - INTERVAL '8 days', NOW() - INTERVAL '3 hours', true),

-- Conversation 11: General discussion between John Smith and Sarah Johnson (Sarah has unread messages)
(11, 2, NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 hours', true),
(11, 3, NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 hour', true),

-- Conversation 12: Project collaboration between Alex Chen and Maria Rodriguez (Alex has unread messages)
(12, 6, NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 hour', true),
(12, 7, NOW() - INTERVAL '3 days', NOW() - INTERVAL '45 minutes', true);

-- Insert Messages
INSERT INTO "Message" ("conversationId", "senderId", content, "messageType", "metadata", "isEdited", "createdAt") VALUES
-- Armen's conversations (comprehensive testing)
-- Conversation 1: Armen's E-commerce Platform Discussion
(1, 1, 'Hi Alex! I saw your proposal for my e-commerce platform project. I really like your approach with React and Node.js. Can we discuss the timeline?', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '2 hours'),
(1, 6, 'Hi Armen! Thank you for considering my proposal. I can deliver your e-commerce platform in 8-10 weeks with all the advanced features you need. What specific features are most important to you?', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '2 hours 15 minutes'),
(1, 1, 'I need payment integration, inventory management, and a modern admin dashboard. Also, mobile responsiveness is crucial for my business.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '2 hours 30 minutes'),
(1, 6, 'Perfect! I have extensive experience with all those features. I can create a scalable platform with Stripe integration, real-time inventory tracking, and a responsive design. Does this timeline work for you?', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '2 hours 45 minutes'),
(1, 1, 'That sounds excellent! The timeline works well for my business launch. Let''s move forward with the project. I''ll send you the detailed requirements document.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '3 hours'),
(1, 6, 'Great! I''ll review the requirements and send you a detailed project plan by tomorrow. Looking forward to working with you on this exciting project!', 'text', NULL, false, NOW() - INTERVAL '30 minutes'),

-- Conversation 2: Armen's Mobile App Development
(2, 1, 'Hi Alex! I accepted your proposal for the mobile app development. When can we start the project?', 'text', NULL, false, NOW() - INTERVAL '1 day'),
(2, 6, 'Hi Armen! Great news! I can start immediately. I''ll need to review your app requirements and create wireframes first. Do you have any specific design preferences?', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '30 minutes'),
(2, 1, 'I want a modern, intuitive interface with real-time features. The app should work seamlessly on both iOS and Android. I''ve uploaded some reference designs.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '1 hour'),
(2, 6, 'Perfect! I can see the references. I''ll create wireframes and share them with you for feedback before proceeding with development. The real-time features will be implemented using WebSocket connections.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '1 hour 30 minutes'),
(2, 1, 'That sounds like a great approach. I''m excited to see the wireframes! When can I expect to see the first draft?', 'text', NULL, false, NOW() - INTERVAL '15 minutes'),

-- Conversation 3: Armen's Brand Identity Design
(3, 1, 'Hi Maria! I''m really impressed with your brand identity proposal. Can you tell me more about your design process?', 'text', NULL, false, NOW() - INTERVAL '1 day'),
(3, 7, 'Hi Armen! Thank you! I start with understanding your brand values and target audience, then create mood boards and initial concepts. I''ll need to know more about your company''s personality and goals.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '1 hour'),
(3, 1, 'My company focuses on innovation and user experience. I want a modern, professional look that appeals to tech-savvy customers. I''ve uploaded some inspiration images.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '2 hours'),
(3, 7, 'Excellent! I can see the inspiration. I''ll create a comprehensive brand identity that reflects innovation and professionalism. I''ll start with logo concepts and color palette options.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '2 hours 30 minutes'),
(3, 1, 'Perfect! I''m looking forward to seeing your creative concepts. When can I expect to see the first logo designs?', 'text', NULL, false, NOW() - INTERVAL '2 hours'),

-- Conversation 4: Armen's Digital Marketing Strategy
(4, 1, 'Hi James! I''m interested in your digital marketing proposal. Can you explain your strategy for reaching my target audience?', 'text', NULL, false, NOW() - INTERVAL '1 day'),
(4, 8, 'Hi Armen! I''d be happy to explain my approach. I start with comprehensive audience research, then create targeted campaigns across multiple channels. What''s your primary business goal?', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '30 minutes'),
(4, 1, 'I want to increase brand awareness and drive sales for my new e-commerce platform. My target audience is tech-savvy professionals aged 25-45.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '1 hour'),
(4, 8, 'Perfect! I can create a multi-channel strategy including SEO, social media marketing, and content marketing. I''ll focus on LinkedIn and Instagram for your target demographic.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '1 hour 30 minutes'),
(4, 1, 'That sounds comprehensive! I''m excited to see your detailed marketing plan. When can we start the campaign?', 'text', NULL, false, NOW() - INTERVAL '45 minutes'),

-- Conversation 5: Armen's Business Strategy Consultation
(5, 1, 'Hi Lisa! I need strategic advice for scaling my startup. Can we schedule a consultation call?', 'text', NULL, false, NOW() - INTERVAL '1 day'),
(5, 9, 'Hi Armen! I''d be happy to help with your startup strategy. I have some availability this week. What works best for you?', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '1 hour'),
(5, 1, 'How about Thursday at 2 PM? I can share my current business plan and get your insights on scaling and funding strategies.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '2 hours'),
(5, 9, 'Thursday at 2 PM works perfectly for me. I''ll send you a calendar invite with the meeting details. I''m excited to help you scale your startup!', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '2 hours 30 minutes'),
(5, 1, 'Excellent! I''ll prepare some questions about market expansion and team building. Looking forward to our discussion!', 'text', NULL, false, NOW() - INTERVAL '1 hour'),

-- Test conversation for User 15 (chat action buttons testing)
-- Conversation 16: User 15 Test Order Discussion
(16, 1, 'Hello! I am interested in your project and have the skills to complete it.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '1 hour'),
(16, 15, 'Thank you for your interest! I would like to know more about your previous experience.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '1 hour 15 minutes'),

-- Other conversations
-- Conversation 6: E-commerce Website Discussion
(6, 2, 'Hi Alex! I saw your proposal for my e-commerce website project. I really like your approach with React and Node.js.', 'text', NULL, false, NOW() - INTERVAL '4 days' + INTERVAL '2 hours'),
(6, 6, 'Thank you John! I''m excited about this project. I have extensive experience with e-commerce platforms and can deliver exactly what you need.', 'text', NULL, false, NOW() - INTERVAL '4 days' + INTERVAL '2 hours 15 minutes'),
(6, 2, 'That sounds great! What''s your timeline for delivery?', 'text', NULL, false, NOW() - INTERVAL '4 days' + INTERVAL '2 hours 30 minutes'),
(6, 6, 'I can deliver the complete website in 6-8 weeks. This includes all features, testing, and deployment. Does this work for you?', 'text', NULL, false, NOW() - INTERVAL '4 days' + INTERVAL '2 hours 45 minutes'),
(6, 2, 'Perfect! That timeline works well for my business launch. Let''s move forward with the project.', 'text', NULL, false, NOW() - INTERVAL '4 days' + INTERVAL '3 hours'),
(6, 6, 'Excellent! I''ll send you a detailed project plan and contract by tomorrow. Looking forward to working with you!', 'text', NULL, false, NOW() - INTERVAL '1 hour'),

-- Conversation 7: Corporate Website Redesign
(7, 2, 'Hi Alex! I accepted your proposal for the website redesign. When can we start?', 'text', NULL, false, NOW() - INTERVAL '2 days'),
(7, 6, 'Great news Sarah! I can start immediately. I''ll need access to your current website and any specific requirements you have.', 'text', NULL, false, NOW() - INTERVAL '2 days' + INTERVAL '30 minutes'),
(7, 2, 'I''ve shared the login credentials and uploaded some reference designs. The main focus should be on mobile responsiveness and modern UI.', 'text', NULL, false, NOW() - INTERVAL '2 days' + INTERVAL '1 hour'),
(7, 6, 'Perfect! I can see the references. I''ll create wireframes first and share them with you for feedback before proceeding.', 'text', NULL, false, NOW() - INTERVAL '2 days' + INTERVAL '1 hour 30 minutes'),
(7, 2, 'That sounds like a great approach. Looking forward to seeing the wireframes!', 'text', NULL, false, NOW() - INTERVAL '30 minutes'),

-- Conversation 8: Brand Identity Design (Completed Project)
(8, 4, 'Hi Maria! The brand identity you created is absolutely amazing! Thank you so much.', 'text', NULL, false, NOW() - INTERVAL '9 days'),
(8, 7, 'You''re very welcome Emily! I''m so glad you love the design. It was a pleasure working with you.', 'text', NULL, false, NOW() - INTERVAL '9 days' + INTERVAL '1 hour'),
(8, 4, 'The logo perfectly captures our company values, and the business cards look professional. I''ll definitely recommend you to others!', 'text', NULL, false, NOW() - INTERVAL '9 days' + INTERVAL '2 hours'),
(8, 7, 'That means a lot to me! I''d love to work with you again if you need any other design services.', 'text', NULL, false, NOW() - INTERVAL '9 days' + INTERVAL '2 hours 30 minutes'),
(8, 4, 'Absolutely! I''ll keep you in mind for future projects. Thanks again!', 'text', NULL, false, NOW() - INTERVAL '2 days'),

-- Conversation 9: Business Strategy Consultation
(9, 3, 'Hi Lisa! I need some strategic advice for scaling my startup. Can we schedule a call?', 'text', NULL, false, NOW() - INTERVAL '7 days'),
(9, 9, 'Hi Mike! I''d be happy to help with your startup strategy. I have some availability this week. What works best for you?', 'text', NULL, false, NOW() - INTERVAL '7 days' + INTERVAL '1 hour'),
(9, 3, 'How about Thursday at 2 PM? I can share my current business plan and get your insights.', 'text', NULL, false, NOW() - INTERVAL '7 days' + INTERVAL '2 hours'),
(9, 9, 'Thursday at 2 PM works perfectly for me. I''ll send you a calendar invite with the meeting details.', 'text', NULL, false, NOW() - INTERVAL '7 days' + INTERVAL '2 hours 30 minutes'),
(9, 3, 'Great! Looking forward to our discussion. I''ll prepare some questions about scaling and funding.', 'text', NULL, false, NOW() - INTERVAL '1 day'),

-- Conversation 10: Content Marketing Strategy
(10, 5, 'Hi Lisa! I''m impressed with your content marketing proposal. Can you tell me more about your content creation process?', 'text', NULL, false, NOW() - INTERVAL '8 days'),
(10, 9, 'Hi David! I''d be happy to explain my process. I start with audience research, then create a content calendar, and develop content that aligns with your brand voice.', 'text', NULL, false, NOW() - INTERVAL '8 days' + INTERVAL '30 minutes'),
(10, 5, 'That sounds comprehensive. How do you ensure the content resonates with our target audience?', 'text', NULL, false, NOW() - INTERVAL '8 days' + INTERVAL '1 hour'),
(10, 9, 'I conduct thorough audience research, create detailed buyer personas, and tailor content to address their pain points and interests. I also use data-driven insights to optimize content performance.', 'text', NULL, false, NOW() - INTERVAL '8 days' + INTERVAL '1 hour 30 minutes'),
(10, 5, 'Excellent approach! I''m confident you can help us create engaging content. Let''s move forward with the project.', 'text', NULL, false, NOW() - INTERVAL '3 hours'),

-- Conversation 11: General Discussion
(11, 2, 'Hey Sarah! How''s your website redesign project going?', 'text', NULL, false, NOW() - INTERVAL '5 days'),
(11, 3, 'Hi John! It''s going really well. Alex is doing an amazing job. How about your e-commerce project?', 'text', NULL, false, NOW() - INTERVAL '5 days' + INTERVAL '30 minutes'),
(11, 2, 'Great to hear! My project is also progressing well. Alex is very professional and responsive.', 'text', NULL, false, NOW() - INTERVAL '5 days' + INTERVAL '1 hour'),
(11, 3, 'That''s wonderful! It''s always great to work with reliable specialists. The platform has been really helpful for finding quality professionals.', 'text', NULL, false, NOW() - INTERVAL '2 hours'),

-- Conversation 12: Project Collaboration
(12, 6, 'Hi Maria! I have a client who needs both web development and UI/UX design. Would you be interested in collaborating?', 'text', NULL, false, NOW() - INTERVAL '3 days'),
(12, 7, 'Hi Alex! That sounds like a great opportunity. I''d love to collaborate on a project. What are the requirements?', 'text', NULL, false, NOW() - INTERVAL '3 days' + INTERVAL '1 hour'),
(12, 6, 'It''s a SaaS application with a complex dashboard. The client wants a modern, intuitive interface. I can handle the backend and frontend development.', 'text', NULL, false, NOW() - INTERVAL '3 days' + INTERVAL '2 hours'),
(12, 7, 'Perfect! I specialize in SaaS UI/UX design. I can create wireframes, prototypes, and a comprehensive design system. When do we start?', 'text', NULL, false, NOW() - INTERVAL '3 days' + INTERVAL '3 hours'),
(12, 6, 'Excellent! I''ll introduce you to the client and we can start with the discovery phase. This collaboration will be great for both of us!', 'text', NULL, false, NOW() - INTERVAL '45 minutes'),

-- Additional Armen conversations (comprehensive testing)
-- Conversation 13: Armen + Jennifer Lee - General Tech Discussion
(13, 1, 'Hi Jennifer! I''m really interested in data science and AI. Can you tell me about your experience with machine learning projects?', 'text', NULL, false, NOW() - INTERVAL '1 day'),
(13, 11, 'Hi Armen! I''d be happy to share my experience. I''ve worked on various ML projects including recommendation systems and predictive analytics. What specific area interests you most?', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '15 minutes'),
(13, 1, 'I''m particularly interested in recommendation systems for e-commerce. Do you have experience with collaborative filtering and content-based approaches?', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '30 minutes'),
(13, 11, 'Absolutely! I''ve implemented both approaches. Collaborative filtering works great for user-based recommendations, while content-based filtering is excellent for item similarities. I can help you choose the best approach for your platform.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '45 minutes'),
(13, 1, 'That''s exactly what I need! I''d love to discuss implementing a recommendation system for my e-commerce platform. When would be a good time for a technical consultation?', 'text', NULL, false, NOW() - INTERVAL '20 minutes'),

-- Conversation 14: Armen + Michael Garcia - Startup Networking
(14, 1, 'Hi Michael! I saw your portfolio and I''m impressed with your graphic design work. I''m building a startup and might need design services in the future.', 'text', NULL, false, NOW() - INTERVAL '1 day'),
(14, 12, 'Hi Armen! Thank you for reaching out. I''d love to help with your startup design needs. What kind of business are you building?', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '10 minutes'),
(14, 1, 'I''m developing an e-commerce platform with a focus on user experience. I might need logo design, branding, and marketing materials. Do you work with startups?', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '20 minutes'),
(14, 12, 'Absolutely! I love working with startups. I can help with complete brand identity, logo design, and marketing materials. I also offer flexible packages for growing businesses.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '30 minutes'),
(14, 1, 'Perfect! I''ll keep you in mind for when I''m ready to launch. Do you have any examples of startup branding you''ve done?', 'text', NULL, false, NOW() - INTERVAL '10 minutes'),

-- Conversation 15: Armen + Amanda White - Project Collaboration
(15, 1, 'Hi Amanda! I''m looking for a project manager to help organize my startup development process. Do you work with tech startups?', 'text', NULL, false, NOW() - INTERVAL '1 day'),
(15, 13, 'Hi Armen! Yes, I specialize in project management for tech startups. I can help you set up agile processes, manage development timelines, and coordinate with your development team.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '5 minutes'),
(15, 1, 'That sounds perfect! I''m working with multiple developers and need better coordination. What project management tools do you recommend?', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '10 minutes'),
(15, 13, 'I recommend Jira for issue tracking, Slack for communication, and Trello for visual project management. I can help you set up these tools and train your team on best practices.', 'text', NULL, false, NOW() - INTERVAL '1 day' + INTERVAL '15 minutes'),
(15, 1, 'Excellent! I''d love to discuss setting up a project management system for my team. When can we schedule a consultation?', 'text', NULL, false, NOW() - INTERVAL '5 minutes');

-- Insert Order Pricing configurations based on budget ranges
INSERT INTO "OrderPricing" ("minBudget", "maxBudget", "creditCost", "description", "isActive", "createdAt", "updatedAt") VALUES
(0, 500, 1, 'Small orders ($0-$500)', true, NOW(), NOW()),
(500, 2000, 5, 'Medium orders ($500-$2000)', true, NOW(), NOW()),
(2000, 5000, 10, 'Large orders ($2000-$5000)', true, NOW(), NOW()),
(5000, NULL, 20, 'Premium orders ($5000+)', true, NOW(), NOW());

-- Display summary
SELECT 'Data insertion completed successfully!' as status;
SELECT COUNT(*) as total_users FROM "User";
SELECT COUNT(*) as total_services FROM "Service";
SELECT COUNT(*) as total_specialists FROM "User" WHERE role = 'specialist';
SELECT COUNT(*) as total_user_services FROM "UserService";
SELECT COUNT(*) as total_cards FROM "Card";
SELECT COUNT(*) as total_orders FROM "Order";
SELECT COUNT(*) as total_proposals FROM "OrderProposal";
SELECT COUNT(*) as total_reviews FROM "Review";
SELECT COUNT(*) as total_media_files FROM "MediaFile";
SELECT COUNT(*) as total_conversations FROM "Conversation";
SELECT COUNT(*) as total_conversation_participants FROM "ConversationParticipant";
SELECT COUNT(*) as total_messages FROM "Message";
SELECT COUNT(*) as total_order_pricing FROM "OrderPricing";

-- Add referral codes to existing users
UPDATE "User" SET "referralCode" = 'REF001' WHERE "id" = 1;
UPDATE "User" SET "referralCode" = 'REF002' WHERE "id" = 2;
UPDATE "User" SET "referralCode" = 'REF003' WHERE "id" = 3;

-- Create some example referral rewards
INSERT INTO "ReferralReward" ("referrerId", "referredUserId", "rewardAmount", "bonusAmount", "status", "createdAt", "completedAt") VALUES
(1, 4, 10.0, 5.0, 'completed', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
(1, 5, 10.0, 5.0, 'completed', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
(2, 6, 10.0, 5.0, 'completed', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
(1, 7, 10.0, 5.0, 'pending', NOW() - INTERVAL '1 day', NULL);

-- Update user credit balances to reflect referral rewards
UPDATE "User" SET "creditBalance" = "creditBalance" + 20.0, "referralCredits" = 20.0 WHERE "id" = 1;
UPDATE "User" SET "creditBalance" = "creditBalance" + 10.0, "referralCredits" = 10.0 WHERE "id" = 2;
UPDATE "User" SET "creditBalance" = "creditBalance" + 5.0 WHERE "id" = 6;
UPDATE "User" SET "creditBalance" = "creditBalance" + 5.0 WHERE "id" = 7;
UPDATE "User" SET "creditBalance" = "creditBalance" + 5.0 WHERE "id" = 8;
UPDATE "User" SET "creditBalance" = "creditBalance" + 5.0 WHERE "id" = 9;

-- Set referredBy for referred users
UPDATE "User" SET "referredBy" = 1 WHERE "id" IN (6, 7, 8);
UPDATE "User" SET "referredBy" = 2 WHERE "id" = 9;

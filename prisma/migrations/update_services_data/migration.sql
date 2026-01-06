-- Migration: Update Services Data
-- This migration updates the services, features, and technologies to match the new home services data

-- Clear existing service-related data (in correct order due to foreign key constraints)
DELETE FROM "ServiceTechnology";
DELETE FROM "ServiceFeature";
DELETE FROM "Technology";
DELETE FROM "Feature";
DELETE FROM "UserService";
DELETE FROM "Service";

-- Reset sequences
ALTER SEQUENCE "Service_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Feature_id_seq" RESTART WITH 1;
ALTER SEQUENCE "Technology_id_seq" RESTART WITH 1;
ALTER SEQUENCE "ServiceFeature_id_seq" RESTART WITH 1;
ALTER SEQUENCE "ServiceTechnology_id_seq" RESTART WITH 1;

-- Insert Features
INSERT INTO "Feature" (name, "nameEn", "nameRu", "nameHy", description, "descriptionEn", "descriptionRu", "descriptionHy", "isActive", "createdAt", "updatedAt") VALUES
('Deep Cleaning', 'Deep Cleaning', 'Глубокая уборка', 'Խորը մաքրում', 'Thorough cleaning of all surfaces and hard-to-reach areas', 'Thorough cleaning of all surfaces and hard-to-reach areas', 'Тщательная уборка всех поверхностей и труднодоступных мест', 'Բոլոր մակերեսների և դժվար հասանելի տարածքների մանրակրկիտ մաքրում', true, NOW(), NOW()),
('Eco-Friendly Products', 'Eco-Friendly Products', 'Экологичные средства', 'Էկոլոգիապես մաքուր արտադրանք', 'Safe and environmentally friendly cleaning products', 'Safe and environmentally friendly cleaning products', 'Безопасные и экологически чистые чистящие средства', 'Անվտանգ և էկոլոգիապես մաքուր մաքրման միջոցներ', true, NOW(), NOW()),
('Professional Equipment', 'Professional Equipment', 'Профессиональное оборудование', 'Պրոֆեսիոնալ սարքավորում', 'High-quality professional tools and equipment', 'High-quality professional tools and equipment', 'Высококачественные профессиональные инструменты и оборудование', 'Բարձրորակ պրոֆեսիոնալ գործիքներ և սարքավորում', true, NOW(), NOW()),
('Time-Efficient', 'Time-Efficient', 'Быстрое выполнение', 'Ժամանակի խնայողություն', 'Fast and efficient service delivery', 'Fast and efficient service delivery', 'Быстрое и эффективное выполнение услуг', 'Արագ և արդյունավետ ծառայություն', true, NOW(), NOW()),
('Interior Detailing', 'Interior Detailing', 'Детальная чистка салона', 'Ներքին մանրակրկիտ մաքրում', 'Comprehensive interior cleaning and detailing', 'Comprehensive interior cleaning and detailing', 'Комплексная чистка и детализация салона', 'Ներքին մանրակրկիտ մաքրում և մանրամասնություն', true, NOW(), NOW()),
('Exterior Washing', 'Exterior Washing', 'Мойка кузова', 'Արտաքին լվացում', 'Professional exterior car washing', 'Professional exterior car washing', 'Профессиональная мойка кузова автомобиля', 'Պրոֆեսիոնալ արտաքին լվացում', true, NOW(), NOW()),
('Wax Protection', 'Wax Protection', 'Защита воском', 'Վաքսի պաշտպանություն', 'Wax application for shine and protection', 'Wax application for shine and protection', 'Нанесение воска для блеска и защиты', 'Վաքսի կիրառում փայլի և պաշտպանության համար', true, NOW(), NOW()),
('Plant Care Expertise', 'Plant Care Expertise', 'Экспертиза по уходу за растениями', 'Բույսերի խնամքի փորձ', 'Expert knowledge in plant care and maintenance', 'Expert knowledge in plant care and maintenance', 'Экспертные знания по уходу и содержанию растений', 'Բույսերի խնամքի և պահպանման փորձ', true, NOW(), NOW()),
('Seasonal Maintenance', 'Seasonal Maintenance', 'Сезонное обслуживание', 'Սեզոնային խնամք', 'Year-round seasonal garden maintenance', 'Year-round seasonal garden maintenance', 'Круглогодичное сезонное обслуживание сада', 'Տարվա ընթացքում սեզոնային այգու խնամք', true, NOW(), NOW()),
('Emergency Service', 'Emergency Service', 'Экстренная служба', 'Արտակարգ ծառայություն', '24/7 emergency repair services', '24/7 emergency repair services', 'Круглосуточные экстренные ремонтные услуги', 'Օրական 24/7 արտակարգ վերանորոգման ծառայություններ', true, NOW(), NOW()),
('Quality Materials', 'Quality Materials', 'Качественные материалы', 'Բարձրորակ նյութեր', 'High-quality materials and supplies', 'High-quality materials and supplies', 'Высококачественные материалы и расходные материалы', 'Բարձրորակ նյութեր և պարագաներ', true, NOW(), NOW()),
('Safety Certified', 'Safety Certified', 'Сертифицированная безопасность', 'Անվտանգության հավաստագրում', 'Certified safety standards and practices', 'Certified safety standards and practices', 'Сертифицированные стандарты и практики безопасности', 'Հավաստագրված անվտանգության ստանդարտներ և պրակտիկա', true, NOW(), NOW()),
('Code Compliance', 'Code Compliance', 'Соответствие нормам', 'Նորմերի համապատասխանություն', 'Full compliance with building codes and regulations', 'Full compliance with building codes and regulations', 'Полное соответствие строительным нормам и правилам', 'Շինարարական նորմերի և կանոնների լիակատար համապատասխանություն', true, NOW(), NOW()),
('Multi-Skilled', 'Multi-Skilled', 'Многофункциональный', 'Բազմակողմանի', 'Versatile skills for various repair tasks', 'Versatile skills for various repair tasks', 'Универсальные навыки для различных ремонтных работ', 'Տարբեր վերանորոգման աշխատանքների համար բազմակողմանի հմտություններ', true, NOW(), NOW());

-- Insert Technologies
INSERT INTO "Technology" (name, "nameEn", "nameRu", "nameHy", description, "descriptionEn", "descriptionRu", "descriptionHy", "isActive", "createdAt", "updatedAt") VALUES
('Vacuum Cleaners', 'Vacuum Cleaners', 'Пылесосы', 'Փոշեկուլներ', 'Professional-grade vacuum cleaning equipment', 'Professional-grade vacuum cleaning equipment', 'Профессиональное пылесосное оборудование', 'Պրոֆեսիոնալ փոշեկուլային սարքավորում', true, NOW(), NOW()),
('Steam Cleaners', 'Steam Cleaners', 'Парогенераторы', 'Գոլորշի մաքրիչներ', 'High-pressure steam cleaning systems', 'High-pressure steam cleaning systems', 'Системы паровой очистки высокого давления', 'Բարձր ճնշման գոլորշի մաքրման համակարգեր', true, NOW(), NOW()),
('Eco-Friendly Cleaning Products', 'Eco-Friendly Cleaning Products', 'Экологичные чистящие средства', 'Էկոլոգիապես մաքուր մաքրման միջոցներ', 'Environmentally safe cleaning solutions', 'Environmentally safe cleaning solutions', 'Экологически безопасные чистящие растворы', 'Էկոլոգիապես անվտանգ մաքրման լուծումներ', true, NOW(), NOW()),
('Car Wash Equipment', 'Car Wash Equipment', 'Оборудование для мойки автомобилей', 'Ավտոմեքենաների լվացման սարքավորում', 'Professional car washing and detailing equipment', 'Professional car washing and detailing equipment', 'Профессиональное оборудование для мойки и детализации автомобилей', 'Պրոֆեսիոնալ ավտոմեքենաների լվացման և մանրակրկիտ մաքրման սարքավորում', true, NOW(), NOW()),
('Wax Products', 'Wax Products', 'Восковые продукты', 'Վաքսի արտադրանք', 'High-quality car wax and polish products', 'High-quality car wax and polish products', 'Высококачественные восковые и полировальные продукты для автомобилей', 'Բարձրորակ ավտոմեքենաների վաքսի և փայլեցման արտադրանք', true, NOW(), NOW()),
('Lawn Mowers', 'Lawn Mowers', 'Газонокосилки', 'Խոտհնձիչներ', 'Professional lawn mowing equipment', 'Professional lawn mowing equipment', 'Профессиональное оборудование для стрижки газонов', 'Պրոֆեսիոնալ խոտհնձիչ սարքավորում', true, NOW(), NOW()),
('Trimming Tools', 'Trimming Tools', 'Инструменты для обрезки', 'Կտրման գործիքներ', 'Tree and shrub trimming equipment', 'Tree and shrub trimming equipment', 'Оборудование для обрезки деревьев и кустарников', 'Ծառերի և թփերի կտրման սարքավորում', true, NOW(), NOW()),
('Gardening Equipment', 'Gardening Equipment', 'Садовый инвентарь', 'Այգեգործական սարքավորում', 'Professional gardening tools and equipment', 'Professional gardening tools and equipment', 'Профессиональные садовые инструменты и оборудование', 'Պրոֆեսիոնալ այգեգործական գործիքներ և սարքավորում', true, NOW(), NOW()),
('Plumbing Tools', 'Plumbing Tools', 'Сантехнические инструменты', 'Սանտեխնիկական գործիքներ', 'Professional plumbing repair tools', 'Professional plumbing repair tools', 'Профессиональные инструменты для сантехнического ремонта', 'Պրոֆեսիոնալ սանտեխնիկական վերանորոգման գործիքներ', true, NOW(), NOW()),
('Pipe Materials', 'Pipe Materials', 'Трубные материалы', 'Խողովակների նյութեր', 'Quality pipes and fittings', 'Quality pipes and fittings', 'Качественные трубы и фитинги', 'Բարձրորակ խողովակներ և միակցիչներ', true, NOW(), NOW()),
('Electrical Tools', 'Electrical Tools', 'Электрические инструменты', 'Էլեկտրական գործիքներ', 'Professional electrical repair tools', 'Professional electrical repair tools', 'Профессиональные инструменты для электрического ремонта', 'Պրոֆեսիոնալ էլեկտրական վերանորոգման գործիքներ', true, NOW(), NOW()),
('Safety Equipment', 'Safety Equipment', 'Оборудование безопасности', 'Անվտանգության սարքավորում', 'Electrical safety gear and equipment', 'Electrical safety gear and equipment', 'Средства и оборудование для электробезопасности', 'Էլեկտրական անվտանգության պարագաներ և սարքավորում', true, NOW(), NOW()),
('Hand Tools', 'Hand Tools', 'Ручные инструменты', 'Ձեռքի գործիքներ', 'Essential hand tools for home repairs', 'Essential hand tools for home repairs', 'Основные ручные инструменты для домашнего ремонта', 'Տնային վերանորոգման համար անհրաժեշտ ձեռքի գործիքներ', true, NOW(), NOW()),
('Power Tools', 'Power Tools', 'Электроинструменты', 'Էլեկտրական գործիքներ', 'Professional power tools for repairs', 'Professional power tools for repairs', 'Профессиональные электроинструменты для ремонта', 'Վերանորոգման համար պրոֆեսիոնալ էլեկտրական գործիքներ', true, NOW(), NOW()),
('Paint & Finishing Materials', 'Paint & Finishing Materials', 'Краски и отделочные материалы', 'Ներկեր և ավարտական նյութեր', 'Quality paints and finishing supplies', 'Quality paints and finishing supplies', 'Качественные краски и отделочные материалы', 'Բարձրորակ ներկեր և ավարտական նյութեր', true, NOW(), NOW());

-- Insert Services (hierarchical structure)
INSERT INTO "Service" (name, description, "nameEn", "nameRu", "nameHy", "descriptionEn", "descriptionRu", "descriptionHy", "imageUrl", "parentId", "averagePrice", "minPrice", "maxPrice", "completionRate", "isActive", "createdAt", "updatedAt", currency, "rateUnit") VALUES
-- Parent services
('Home Cleaning', 'Cleaning of apartments and houses', 'Home Cleaning', 'Уборка дома', 'Տնային մաքրում', 'Cleaning of apartments and houses', 'Уборка квартир и домов', 'Բնակարանների և տների մաքրում', 'https://static.thenounproject.com/png/cleaner-service-icon-4711658-512.png', NULL, 50.00, 30.00, 100.00, 0, true, NOW(), NOW(), 'USD', 'per hour'),
('Car Cleaning', 'Exterior and interior cleaning of cars', 'Car Cleaning', 'Мойка автомобиля', 'Ավտոմեքենայի մաքրում', 'Exterior and interior cleaning of cars', 'Очистка салона и кузова автомобиля', 'Ավտոմեքենայի ներքին և արտաքին մաքրում', 'https://static.thenounproject.com/png/cleaner-service-icon-4711664-512.png', NULL, 30.00, 20.00, 60.00, 0, true, NOW(), NOW(), 'USD', 'per car'),
('Garden Services', 'Planting and garden maintenance', 'Garden Services', 'Садовые услуги', 'Այգու ծառայություններ', 'Planting and garden maintenance', 'Посадка растений и уход за садом', 'Այգու տնկում և խնամք', 'https://static.thenounproject.com/png/cleaner-service-icon-4711643-512.png', NULL, 40.00, 20.00, 80.00, 0, true, NOW(), NOW(), 'USD', 'per hour'),
('Plumbing', 'Repair and pipe work', 'Plumbing', 'Сантехника', 'Սանտեխնիկա', 'Repair and pipe work', 'Ремонт труб и сантехники', 'Խողովակների և սանտեխնիկայի վերանորոգում', 'https://static.thenounproject.com/png/cleaner-service-icon-4709287-512.png', NULL, 50.00, 30.00, 120.00, 0, true, NOW(), NOW(), 'USD', 'per hour'),
('Electrician Work', 'Electrical repair and installation', 'Electrician Work', 'Электрик', 'Էլեկտրիկ աշխատանքներ', 'Electrical repair and installation', 'Ремонт и установка электрооборудования', 'Էլեկտրական համակարգերի տեղադրում և վերանորոգում', 'https://static.thenounproject.com/png/cleaner-service-icon-4706611-512.png', NULL, 45.00, 25.00, 100.00, 0, true, NOW(), NOW(), 'USD', 'per hour'),
('Home Repairs', 'Minor repair services at home', 'Home Repairs', 'Домашний ремонт', 'Տան վերանորոգում', 'Minor repair services at home', 'Мелкий ремонт дома', 'Փոքր վերանորոգում տանը', 'https://static.thenounproject.com/png/cleaner-service-icon-4711671-512.png', NULL, 35.00, 20.00, 70.00, 0, true, NOW(), NOW(), 'USD', 'per hour'),

-- Home Cleaning sub-services
('Kitchen Cleaning', 'Deep cleaning of kitchen surfaces', 'Kitchen Cleaning', 'Уборка кухни', 'Խոհանոցի մաքրում', 'Deep cleaning of kitchen surfaces', 'Глубокая уборка кухни', 'Խոհանոցի մակերեսների խորը մաքրում', 'https://static.thenounproject.com/png/cleaner-service-icon-4711651-512.png', 1, 25.00, 15.00, 40.00, 0, true, NOW(), NOW(), 'USD', 'per hour'),
('Bathroom Cleaning', 'Bathroom, shower, toilet cleaning', 'Bathroom Cleaning', 'Уборка ванной', 'Լոգարանի մաքրում', 'Bathroom, shower, toilet cleaning', 'Уборка ванной комнаты', 'Լոգարանի մաքրում', 'https://static.thenounproject.com/png/cleaner-service-icon-4709075-512.png', 1, 20.00, 10.00, 35.00, 0, true, NOW(), NOW(), 'USD', 'per hour'),
('Window Cleaning', 'Interior and exterior window cleaning', 'Window Cleaning', 'Мытьё окон', 'Պատուհանների մաքրում', 'Interior and exterior window cleaning', 'Мытье окон внутри и снаружи', 'Պատուհանների ներսի և դրսի մաքրում', 'https://static.thenounproject.com/png/cleaner-service-icon-4711649-512.png', 1, 30.00, 20.00, 60.00, 0, true, NOW(), NOW(), 'USD', 'per hour'),

-- Car Cleaning sub-services
('Interior Car Cleaning', 'Cleaning car interior surfaces', 'Interior Car Cleaning', 'Чистка салона', 'Ավտոմեքենայի սրահի մաքրում', 'Cleaning car interior surfaces', 'Чистка салона автомобиля', 'Ավտոմեքենայի սրահի մաքրում', 'https://static.thenounproject.com/png/cleaner-service-icon-4706605-512.png', 2, 20.00, 15.00, 30.00, 0, true, NOW(), NOW(), 'USD', 'per car'),
('Exterior Car Cleaning', 'Washing car exterior surfaces', 'Exterior Car Cleaning', 'Мойка кузова', 'Արտաքին մեքենայի մաքրում', 'Washing car exterior surfaces', 'Мойка кузова автомобиля', 'Արտաքին մեքենայի մաքրում', 'https://static.thenounproject.com/png/cleaner-service-icon-4706608-512.png', 2, 15.00, 10.00, 25.00, 0, true, NOW(), NOW(), 'USD', 'per car'),
('Car Waxing', 'Wax car for shine & protection', 'Car Waxing', 'Нанесение воска', 'Վաքսի կիրառում մեքենայի համար', 'Wax car for shine & protection', 'Нанесение воска для защиты', 'Մեքենայի փայլեցում վաքսով', 'https://static.thenounproject.com/png/cleaner-service-icon-4706594-512.png', 2, 40.00, 30.00, 70.00, 0, true, NOW(), NOW(), 'USD', 'per car'),

-- Garden Services sub-services
('Lawn Mowing', 'Lawn cutting and care', 'Lawn Mowing', 'Стрижка газона', 'Խոտի կտրում', 'Lawn cutting and care', 'Стрижка и уход за газоном', 'Խոտի խնամք', 'https://static.thenounproject.com/png/cleaner-service-icon-4706612-512.png', 3, 25.00, 15.00, 50.00, 0, true, NOW(), NOW(), 'USD', 'per hour'),
('Tree Trimming', 'Trim and shape trees', 'Tree Trimming', 'Обрезка деревьев', 'Ծառերի սահում', 'Trim and shape trees', 'Обрезка и формирование деревьев', 'Ծառերի ձևավորում', 'https://static.thenounproject.com/png/cleaner-service-icon-4711654-512.png', 3, 30.00, 20.00, 60.00, 0, true, NOW(), NOW(), 'USD', 'per tree'),
('Planting', 'Plant flowers & shrubs', 'Planting', 'Посадка растений', 'Բույսերի տնկում', 'Plant flowers & shrubs', 'Посадка цветов и кустарников', 'Ծաղիկների և թփերի տնկում', 'https://static.thenounproject.com/png/cleaner-service-icon-4706597-512.png', 3, 20.00, 10.00, 40.00, 0, true, NOW(), NOW(), 'USD', 'per hour'),

-- Home Repairs sub-services
('Furniture Assembly', 'Assemble furniture at home', 'Furniture Assembly', 'Сборка мебели', 'Կահույքի հավաքում', 'Assemble furniture at home', 'Сборка мебели дома', 'Կահույքի հավաքում տանը', 'https://static.thenounproject.com/png/cleaner-service-icon-4711668-512.png', 6, 20.00, 10.00, 40.00, 0, true, NOW(), NOW(), 'USD', 'per item'),
('Painting Walls', 'Paint and finish walls', 'Painting Walls', 'Покраска стен', 'Պատի ներկում', 'Paint and finish walls', 'Покраска и отделка стен', 'Պատի ներկում և ավարտական աշխատանքներ', 'https://static.thenounproject.com/png/cleaner-service-icon-4706600-512.png', 6, 30.00, 20.00, 60.00, 0, true, NOW(), NOW(), 'USD', 'per hour');

-- Insert ServiceFeature relationships
INSERT INTO "ServiceFeature" ("serviceId", "featureId", "createdAt") VALUES
-- Home Cleaning (1) features
(1, 1, NOW()), -- Deep Cleaning
(1, 2, NOW()), -- Eco-Friendly Products
(1, 3, NOW()), -- Professional Equipment
(1, 4, NOW()), -- Time-Efficient

-- Car Cleaning (2) features
(2, 5, NOW()), -- Interior Detailing
(2, 6, NOW()), -- Exterior Washing
(2, 7, NOW()), -- Wax Protection
(2, 3, NOW()), -- Professional Equipment

-- Garden Services (3) features
(3, 8, NOW()), -- Plant Care Expertise
(3, 9, NOW()), -- Seasonal Maintenance
(3, 3, NOW()), -- Professional Equipment

-- Plumbing (4) features
(4, 10, NOW()), -- Emergency Service
(4, 11, NOW()), -- Quality Materials
(4, 3, NOW()), -- Professional Equipment

-- Electrician Work (5) features
(5, 10, NOW()), -- Emergency Service
(5, 12, NOW()), -- Safety Certified
(5, 13, NOW()), -- Code Compliance
(5, 3, NOW()), -- Professional Equipment

-- Home Repairs (6) features
(6, 14, NOW()), -- Multi-Skilled
(6, 11, NOW()), -- Quality Materials
(6, 3, NOW()), -- Professional Equipment

-- Kitchen Cleaning (7) features
(7, 1, NOW()), -- Deep Cleaning
(7, 2, NOW()), -- Eco-Friendly Products
(7, 4, NOW()), -- Time-Efficient

-- Bathroom Cleaning (8) features
(8, 1, NOW()), -- Deep Cleaning
(8, 2, NOW()), -- Eco-Friendly Products
(8, 4, NOW()), -- Time-Efficient

-- Window Cleaning (9) features
(9, 1, NOW()), -- Deep Cleaning
(9, 3, NOW()), -- Professional Equipment
(9, 4, NOW()), -- Time-Efficient

-- Interior Car Cleaning (10) features
(10, 5, NOW()), -- Interior Detailing
(10, 3, NOW()), -- Professional Equipment

-- Exterior Car Cleaning (11) features
(11, 6, NOW()), -- Exterior Washing
(11, 3, NOW()), -- Professional Equipment

-- Car Waxing (12) features
(12, 7, NOW()), -- Wax Protection
(12, 3, NOW()), -- Professional Equipment

-- Lawn Mowing (13) features
(13, 8, NOW()), -- Plant Care Expertise
(13, 3, NOW()), -- Professional Equipment
(13, 4, NOW()), -- Time-Efficient

-- Tree Trimming (14) features
(14, 8, NOW()), -- Plant Care Expertise
(14, 3, NOW()), -- Professional Equipment

-- Planting (15) features
(15, 8, NOW()), -- Plant Care Expertise
(15, 3, NOW()), -- Professional Equipment

-- Furniture Assembly (16) features
(16, 14, NOW()), -- Multi-Skilled
(16, 3, NOW()), -- Professional Equipment
(16, 4, NOW()), -- Time-Efficient

-- Painting Walls (17) features
(17, 11, NOW()), -- Quality Materials
(17, 3, NOW()), -- Professional Equipment
(17, 4, NOW()); -- Time-Efficient

-- Insert ServiceTechnology relationships
INSERT INTO "ServiceTechnology" ("serviceId", "technologyId", "createdAt") VALUES
-- Home Cleaning (1) technologies
(1, 1, NOW()), -- Vacuum Cleaners
(1, 2, NOW()), -- Steam Cleaners
(1, 3, NOW()), -- Eco-Friendly Cleaning Products

-- Car Cleaning (2) technologies
(2, 4, NOW()), -- Car Wash Equipment
(2, 1, NOW()), -- Vacuum Cleaners
(2, 5, NOW()), -- Wax Products

-- Garden Services (3) technologies
(3, 6, NOW()), -- Lawn Mowers
(3, 7, NOW()), -- Trimming Tools
(3, 8, NOW()), -- Gardening Equipment

-- Plumbing (4) technologies
(4, 9, NOW()), -- Plumbing Tools
(4, 10, NOW()), -- Pipe Materials

-- Electrician Work (5) technologies
(5, 11, NOW()), -- Electrical Tools
(5, 12, NOW()), -- Safety Equipment

-- Home Repairs (6) technologies
(6, 13, NOW()), -- Hand Tools
(6, 14, NOW()), -- Power Tools

-- Kitchen Cleaning (7) technologies
(7, 1, NOW()), -- Vacuum Cleaners
(7, 2, NOW()), -- Steam Cleaners
(7, 3, NOW()), -- Eco-Friendly Cleaning Products

-- Bathroom Cleaning (8) technologies
(8, 1, NOW()), -- Vacuum Cleaners
(8, 2, NOW()), -- Steam Cleaners
(8, 3, NOW()), -- Eco-Friendly Cleaning Products

-- Window Cleaning (9) technologies
(9, 2, NOW()), -- Steam Cleaners
(9, 3, NOW()), -- Eco-Friendly Cleaning Products

-- Interior Car Cleaning (10) technologies
(10, 1, NOW()), -- Vacuum Cleaners
(10, 4, NOW()), -- Car Wash Equipment

-- Exterior Car Cleaning (11) technologies
(11, 4, NOW()), -- Car Wash Equipment
(11, 3, NOW()), -- Eco-Friendly Cleaning Products

-- Car Waxing (12) technologies
(12, 5, NOW()), -- Wax Products
(12, 4, NOW()), -- Car Wash Equipment

-- Lawn Mowing (13) technologies
(13, 6, NOW()), -- Lawn Mowers
(13, 8, NOW()), -- Gardening Equipment

-- Tree Trimming (14) technologies
(14, 7, NOW()), -- Trimming Tools
(14, 8, NOW()), -- Gardening Equipment

-- Planting (15) technologies
(15, 8, NOW()), -- Gardening Equipment

-- Furniture Assembly (16) technologies
(16, 13, NOW()), -- Hand Tools
(16, 14, NOW()), -- Power Tools

-- Painting Walls (17) technologies
(17, 15, NOW()), -- Paint & Finishing Materials
(17, 13, NOW()), -- Hand Tools
(17, 14, NOW()); -- Power Tools


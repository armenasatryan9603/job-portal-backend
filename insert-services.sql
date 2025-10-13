-- Service Table Insert Script
-- This script inserts comprehensive service data with hierarchical structure
-- Supports multiple languages (English, Russian, Armenian)

-- Clear existing services (if needed)
-- DELETE FROM "Service";

-- Insert Services (hierarchical structure)
INSERT INTO "Service" (name, description, "nameEn", "nameRu", "nameHy", "descriptionEn", "descriptionRu", "descriptionHy", "parentId", "averagePrice", "minPrice", "maxPrice", "features", "technologies", "completionRate", "isActive", "createdAt", "updatedAt") VALUES

-- Parent services (main categories)
('Technology', 'Software development, IT consulting, and technical services', 'Technology', 'Технологии', 'Տեխնոլոգիա', 'Software development, IT consulting, and technical services', 'Разработка программного обеспечения, ИТ-консалтинг и технические услуги', 'Ծրագրային ապահովման մշակում, ՏՏ խորհրդատվություն և տեխնիկական ծառայություններ', NULL, 75.00, 50.00, 150.00, '{"Professional Development", "Technical Support", "Quality Assurance"}', '{"JavaScript", "Python", "React", "Node.js", "AWS", "Docker"}', 95.0, true, NOW(), NOW()),

('Design', 'Creative design services for digital and print media', 'Design', 'Дизайн', 'Դիզայն', 'Creative design services for digital and print media', 'Креативные дизайнерские услуги для цифровых и печатных медиа', 'Կրեատիվ դիզայնի ծառայություններ թվային և տպագիր մեդիայի համար', NULL, 60.00, 30.00, 120.00, '{"Creative Design", "Brand Identity", "User Experience"}', '{"Adobe Creative Suite", "Figma", "Sketch", "Photoshop", "Illustrator"}', 92.0, true, NOW(), NOW()),

('Marketing', 'Digital marketing, advertising, and promotional services', 'Marketing', 'Маркетинг', 'Մարքեթինգ', 'Digital marketing, advertising, and promotional services', 'Цифровой маркетинг, реклама и рекламные услуги', 'Թվային մարքեթինգ, գովազդ և գովազդային ծառայություններ', NULL, 50.00, 25.00, 100.00, '{"Digital Marketing", "Social Media", "SEO Optimization"}', '{"Google Analytics", "Facebook Ads", "Instagram Marketing", "SEO Tools"}', 88.0, true, NOW(), NOW()),

('Business', 'Business consulting, strategy, and operational services', 'Business', 'Бизнес', 'Բիզնես', 'Business consulting, strategy, and operational services', 'Бизнес-консалтинг, стратегия и операционные услуги', 'Բիզնես խորհրդատվություն, ռազմավարություն և գործառնական ծառայություններ', NULL, 80.00, 40.00, 150.00, '{"Strategic Planning", "Business Analysis", "Process Optimization"}', '{"Business Intelligence", "Data Analysis", "Project Management"}', 90.0, true, NOW(), NOW()),

('Writing', 'Content creation, copywriting, and editorial services', 'Writing', 'Письмо', 'Գրել', 'Content creation, copywriting, and editorial services', 'Создание контента, копирайтинг и редакционные услуги', 'Բովանդակության ստեղծում, կոպիրայթինգ և խմբագրական ծառայություններ', NULL, 35.00, 20.00, 70.00, '{"Content Creation", "SEO Writing", "Technical Writing"}', '{"WordPress", "SEO Tools", "Content Management"}', 85.0, true, NOW(), NOW()),

-- Technology sub-services
('Web Development', 'Full-stack web application development', 'Web Development', 'Веб-разработка', 'Վեբ մշակում', 'Full-stack web application development', 'Разработка полнофункциональных веб-приложений', 'Ամբողջական վեբ հավելվածների մշակում', 1, 80.00, 50.00, 150.00, '{"Frontend Development", "Backend Development", "Database Design"}', '{"React", "Vue.js", "Angular", "Node.js", "Express", "MongoDB", "PostgreSQL"}', 95.0, true, NOW(), NOW()),

('Mobile Development', 'iOS and Android mobile app development', 'Mobile Development', 'Мобильная разработка', 'Բջջային մշակում', 'iOS and Android mobile app development', 'Разработка мобильных приложений для iOS и Android', 'iOS և Android բջջային հավելվածների մշակում', 1, 90.00, 60.00, 180.00, '{"Native Development", "Cross-platform", "App Store Optimization"}', '{"React Native", "Flutter", "Swift", "Kotlin", "Xcode", "Android Studio"}', 93.0, true, NOW(), NOW()),

('Data Science', 'Data analysis, machine learning, and AI solutions', 'Data Science', 'Наука о данных', 'Տվյալների գիտություն', 'Data analysis, machine learning, and AI solutions', 'Анализ данных, машинное обучение и решения ИИ', 'Տվյալների վերլուծություն, մեքենայական ուսուցում և AI լուծումներ', 1, 100.00, 70.00, 200.00, '{"Machine Learning", "Data Visualization", "Predictive Analytics"}', '{"Python", "R", "TensorFlow", "PyTorch", "Pandas", "NumPy", "Jupyter"}', 90.0, true, NOW(), NOW()),

('DevOps', 'Infrastructure, deployment, and automation services', 'DevOps', 'DevOps', 'DevOps', 'Infrastructure, deployment, and automation services', 'Инфраструктура, развертывание и услуги автоматизации', 'Ինֆրակառուցվածք, տեղակայում և ավտոմատացման ծառայություններ', 1, 85.00, 55.00, 160.00, '{"CI/CD", "Cloud Infrastructure", "Monitoring"}', '{"Docker", "Kubernetes", "AWS", "Azure", "Jenkins", "GitLab CI"}', 92.0, true, NOW(), NOW()),

('Cybersecurity', 'Security auditing, penetration testing, and protection', 'Cybersecurity', 'Кибербезопасность', 'Ցիբերանվտանգություն', 'Security auditing, penetration testing, and protection', 'Аудит безопасности, тестирование на проникновение и защита', 'Անվտանգության աուդիտ, ներթափանցման թեստավորում և պաշտպանություն', 1, 120.00, 80.00, 250.00, '{"Security Auditing", "Penetration Testing", "Risk Assessment"}', '{"OWASP", "Nmap", "Burp Suite", "Metasploit", "Wireshark"}', 88.0, true, NOW(), NOW()),

-- Design sub-services
('UI/UX Design', 'User interface and user experience design', 'UI/UX Design', 'UI/UX Дизайн', 'UI/UX Դիզայն', 'User interface and user experience design', 'Дизайн пользовательского интерфейса и пользовательского опыта', 'Օգտագործողի ինտերֆեյսի և օգտագործողի փորձի դիզայն', 2, 70.00, 40.00, 130.00, '{"User Research", "Wireframing", "Prototyping", "Usability Testing"}', '{"Figma", "Sketch", "Adobe XD", "InVision", "Principle"}', 94.0, true, NOW(), NOW()),

('Graphic Design', 'Visual design for branding and marketing materials', 'Graphic Design', 'Графический дизайн', 'Գրաֆիկական դիզայն', 'Visual design for branding and marketing materials', 'Визуальный дизайн для брендинга и маркетинговых материалов', 'Վիզուալ դիզայն բրենդինգի և մարքեթինգային նյութերի համար', 2, 50.00, 25.00, 100.00, '{"Brand Identity", "Logo Design", "Print Design"}', '{"Adobe Illustrator", "Photoshop", "InDesign", "Canva"}', 91.0, true, NOW(), NOW()),

('Web Design', 'Website design and layout creation', 'Web Design', 'Веб-дизайн', 'Վեբ դիզայն', 'Website design and layout creation', 'Дизайн веб-сайтов и создание макетов', 'Կայքերի դիզայն և դասավորության ստեղծում', 2, 60.00, 30.00, 120.00, '{"Responsive Design", "User Interface", "Visual Design"}', '{"HTML", "CSS", "JavaScript", "Bootstrap", "WordPress"}', 89.0, true, NOW(), NOW()),

('Logo Design', 'Professional logo and brand identity creation', 'Logo Design', 'Дизайн логотипа', 'Լոգոյի դիզայն', 'Professional logo and brand identity creation', 'Создание профессиональных логотипов и фирменного стиля', 'Պրոֆեսիոնալ լոգոների և բրենդային ինքնության ստեղծում', 2, 45.00, 20.00, 90.00, '{"Brand Identity", "Logo Design", "Style Guide"}', '{"Adobe Illustrator", "CorelDRAW", "Sketch"}', 93.0, true, NOW(), NOW()),

-- Marketing sub-services
('Social Media Marketing', 'Social media strategy and content management', 'Social Media Marketing', 'Маркетинг в социальных сетях', 'Սոցիալական մեդիայի մարքեթինգ', 'Social media strategy and content management', 'Стратегия социальных сетей и управление контентом', 'Սոցիալական մեդիայի ռազմավարություն և բովանդակության կառավարում', 3, 40.00, 20.00, 80.00, '{"Content Strategy", "Community Management", "Influencer Marketing"}', '{"Facebook", "Instagram", "Twitter", "LinkedIn", "TikTok"}', 87.0, true, NOW(), NOW()),

('SEO Services', 'Search engine optimization and organic traffic growth', 'SEO Services', 'SEO Услуги', 'SEO Ծառայություններ', 'Search engine optimization and organic traffic growth', 'Оптимизация поисковых систем и рост органического трафика', 'Որոնողական համակարգերի օպտիմալացում և օրգանական տրաֆիկի աճ', 3, 60.00, 30.00, 120.00, '{"Keyword Research", "On-page SEO", "Link Building"}', '{"Google Analytics", "SEMrush", "Ahrefs", "Moz", "Screaming Frog"}', 85.0, true, NOW(), NOW()),

('PPC Advertising', 'Pay-per-click advertising campaigns', 'PPC Advertising', 'PPC Реклама', 'PPC Գովազդ', 'Pay-per-click advertising campaigns', 'Рекламные кампании с оплатой за клик', 'Կտրոնով վճարման գովազդային արշավներ', 3, 70.00, 40.00, 140.00, '{"Campaign Management", "Ad Creation", "Performance Optimization"}', '{"Google Ads", "Facebook Ads", "LinkedIn Ads", "Bing Ads"}', 82.0, true, NOW(), NOW()),

('Content Marketing', 'Content strategy and creation for brand awareness', 'Content Marketing', 'Контент-маркетинг', 'Բովանդակության մարքեթինգ', 'Content strategy and creation for brand awareness', 'Стратегия контента и создание для узнаваемости бренда', 'Բովանդակության ռազմավարություն և ստեղծում բրենդի ճանաչելիության համար', 3, 45.00, 25.00, 90.00, '{"Content Strategy", "Blog Writing", "Video Production"}', '{"WordPress", "YouTube", "Podcast Tools", "Content Management"}', 86.0, true, NOW(), NOW()),

-- Business sub-services
('Business Consulting', 'Strategic business advice and planning', 'Business Consulting', 'Бизнес-консалтинг', 'Բիզնես խորհրդատվություն', 'Strategic business advice and planning', 'Стратегические бизнес-советы и планирование', 'Ռազմավարական բիզնես խորհուրդներ և պլանավորում', 4, 100.00, 60.00, 200.00, '{"Strategic Planning", "Market Analysis", "Business Development"}', '{"Business Intelligence", "Data Analysis", "Project Management"}', 92.0, true, NOW(), NOW()),

('Financial Planning', 'Financial analysis and investment strategies', 'Financial Planning', 'Финансовое планирование', 'Ֆինանսական պլանավորում', 'Financial analysis and investment strategies', 'Финансовый анализ и инвестиционные стратегии', 'Ֆինանսական վերլուծություն և ներդրումային ռազմավարություններ', 4, 120.00, 80.00, 250.00, '{"Investment Analysis", "Risk Assessment", "Portfolio Management"}', '{"Excel", "QuickBooks", "Financial Modeling", "Bloomberg"}', 90.0, true, NOW(), NOW()),

('Project Management', 'Project planning, execution, and delivery', 'Project Management', 'Управление проектами', 'Նախագծի կառավարում', 'Project planning, execution, and delivery', 'Планирование, выполнение и поставка проектов', 'Նախագծի պլանավորում, կատարում և առաքում', 4, 75.00, 45.00, 150.00, '{"Agile Methodology", "Risk Management", "Team Leadership"}', '{"Jira", "Trello", "Asana", "Microsoft Project", "Slack"}', 88.0, true, NOW(), NOW()),

('HR Consulting', 'Human resources strategy and talent management', 'HR Consulting', 'HR Консалтинг', 'HR Խորհրդատվություն', 'Human resources strategy and talent management', 'Стратегия человеческих ресурсов и управление талантами', 'Մարդկային ռեսուրսների ռազմավարություն և տաղանդների կառավարում', 4, 65.00, 35.00, 130.00, '{"Talent Acquisition", "Performance Management", "Employee Development"}', '{"LinkedIn", "HRIS Systems", "Recruitment Tools"}', 85.0, true, NOW(), NOW()),

-- Writing sub-services
('Technical Writing', 'Technical documentation and user manuals', 'Technical Writing', 'Техническое письмо', 'Տեխնիկական գրել', 'Technical documentation and user manuals', 'Техническая документация и руководства пользователя', 'Տեխնիկական փաստաթղթավորում և օգտագործողի ձեռնարկներ', 5, 50.00, 30.00, 100.00, '{"Documentation", "User Guides", "API Documentation"}', '{"Markdown", "GitBook", "Confluence", "Notion"}', 89.0, true, NOW(), NOW()),

('Content Writing', 'Blog posts, articles, and web content', 'Content Writing', 'Написание контента', 'Բովանդակության գրել', 'Blog posts, articles, and web content', 'Посты в блогах, статьи и веб-контент', 'Բլոգի գրառումներ, հոդվածներ և վեբ բովանդակություն', 5, 30.00, 15.00, 60.00, '{"SEO Writing", "Blog Posts", "Article Writing"}', '{"WordPress", "Medium", "SEO Tools", "Grammarly"}', 87.0, true, NOW(), NOW()),

('Copywriting', 'Sales copy and marketing materials', 'Copywriting', 'Копирайтинг', 'Կոպիրայթինգ', 'Sales copy and marketing materials', 'Продающие тексты и маркетинговые материалы', 'Վաճառքի տեքստեր և մարքեթինգային նյութեր', 5, 40.00, 20.00, 80.00, '{"Sales Copy", "Email Marketing", "Ad Copy"}', '{"Sales Tools", "Email Platforms", "A/B Testing"}', 91.0, true, NOW(), NOW()),

('Translation', 'Professional translation services', 'Translation', 'Перевод', 'Թարգմանություն', 'Professional translation services', 'Профессиональные услуги перевода', 'Պրոֆեսիոնալ թարգմանական ծառայություններ', 5, 25.00, 15.00, 50.00, '{"Language Translation", "Localization", "Proofreading"}', '{"Translation Tools", "CAT Tools", "Language Software"}', 93.0, true, NOW(), NOW()),

-- Additional specialized services
('E-commerce Development', 'Online store and marketplace development', 'E-commerce Development', 'Разработка электронной коммерции', 'Էլեկտրոնային առևտրի մշակում', 'Online store and marketplace development', 'Разработка интернет-магазинов и торговых площадок', 'Առցանց խանութների և առևտրային հարթակների մշակում', 1, 95.00, 60.00, 180.00, '{"Online Store", "Payment Integration", "Inventory Management"}', '{"Shopify", "WooCommerce", "Magento", "Stripe", "PayPal"}', 92.0, true, NOW(), NOW()),

('Blockchain Development', 'Cryptocurrency and blockchain solutions', 'Blockchain Development', 'Разработка блокчейна', 'Բլոկչեյնի մշակում', 'Cryptocurrency and blockchain solutions', 'Криптовалютные и блокчейн решения', 'Կրիպտոարժույթային և բլոկչեյն լուծումներ', 1, 150.00, 100.00, 300.00, '{"Smart Contracts", "DeFi", "NFT Development"}', '{"Solidity", "Web3.js", "Ethereum", "IPFS", "MetaMask"}', 88.0, true, NOW(), NOW()),

('Game Development', 'Video game and interactive application development', 'Game Development', 'Разработка игр', 'Խաղերի մշակում', 'Video game and interactive application development', 'Разработка видеоигр и интерактивных приложений', 'Վիդեո խաղերի և ինտերակտիվ հավելվածների մշակում', 1, 110.00, 70.00, 220.00, '{"Game Design", "3D Modeling", "Multiplayer"}', '{"Unity", "Unreal Engine", "C#", "Blender", "Maya"}', 90.0, true, NOW(), NOW()),

('Video Production', 'Video editing, animation, and production services', 'Video Production', 'Видеопроизводство', 'Վիդեո արտադրություն', 'Video editing, animation, and production services', 'Редактирование видео, анимация и услуги производства', 'Վիդեո խմբագրում, անիմացիա և արտադրության ծառայություններ', 2, 70.00, 40.00, 140.00, '{"Video Editing", "Animation", "Motion Graphics"}', '{"Adobe Premiere", "After Effects", "Final Cut Pro", "DaVinci Resolve"}', 89.0, true, NOW(), NOW()),

('Photography', 'Professional photography and image editing', 'Photography', 'Фотография', 'Լուսանկարչություն', 'Professional photography and image editing', 'Профессиональная фотография и редактирование изображений', 'Պրոֆեսիոնալ լուսանկարչություն և պատկերների խմբագրում', 2, 55.00, 30.00, 110.00, '{"Portrait Photography", "Event Photography", "Product Photography"}', '{"Adobe Lightroom", "Photoshop", "Camera Equipment"}', 91.0, true, NOW(), NOW());

-- Display completion message
SELECT 'Service data inserted successfully!' as status;
SELECT 'Total services inserted: ' || COUNT(*) as total_services FROM "Service";
SELECT 'Parent services: ' || COUNT(*) as parent_services FROM "Service" WHERE "parentId" IS NULL;
SELECT 'Child services: ' || COUNT(*) as child_services FROM "Service" WHERE "parentId" IS NOT NULL;

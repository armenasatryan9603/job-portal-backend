/**
 * Seed demo users and one-time orders for a non-empty app feed.
 * Countries: Armenia (AM), Poland (PL), Estonia (EE), Spain (ES), UAE (AE), Germany (DE), Cyprus (CY).
 * All seed users share the same demo password (see DEMO_PASSWORD below).
 * Requires: categories (and optionally skills) already seeded. Run after seed:reasons, seed:skills, seed:subscriptions.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'DemoPassword1!';
const DEMO_EMAIL_PATTERN = '@hotwork.demo';
const USERS_PER_COUNTRY = 25; // 25 × 7 countries = 175 users
const ORDERS_PER_COUNTRY = 25; // 25 × 7 = 175 orders target (was 100 total, +10 per country)
const TARGET_SEED_USERS = USERS_PER_COUNTRY * 7;
const TARGET_SEED_ORDERS = ORDERS_PER_COUNTRY * 7;
const MIN_OPEN_ORDERS_BEFORE_ADDING = TARGET_SEED_ORDERS - 20;
const SPECIALIST_RATIO = 0.45; // ~45% specialists, ~55% clients (so enough clients to hold orders)

type CountryCode = 'AM' | 'PL' | 'EE' | 'ES' | 'AE' | 'DE' | 'CY';

interface CountryConfig {
  code: CountryCode;
  name: string;
  currency: string;
  cities: string[];
  firstNames: string[];
  lastNames: string[];
  bioPool: string[];
  specialistBioPool: string[];
}

const COUNTRY_CONFIGS: CountryConfig[] = [
  {
    code: 'AM',
    name: 'Armenia',
    currency: 'AMD',
    cities: ['Yerevan', 'Gyumri', 'Vanadzor', 'Vagharshapat'],
    firstNames: ['Armen', 'Ani', 'David', 'Lusine', 'Tigran', 'Narine', 'Gor', 'Sona', 'Vardan', 'Mariam', 'Hayk', 'Lilit', 'Arman', 'Anna', 'Sergey'],
    lastNames: ['Petrosyan', 'Hakobyan', 'Sargsyan', 'Grigoryan', 'Harutyunyan', 'Khachatryan', 'Martirosyan', 'Vardanyan', 'Karapetyan', 'Ghukasyan', 'Avetisyan', 'Mkrtchyan', 'Hovhannisyan', 'Stepanyan', 'Sahakyan'],
    bioPool: ['Looking for quality freelancers in the region.', 'Entrepreneur based in Armenia.', 'Seeking reliable specialists for various projects.'],
    specialistBioPool: ['Full-stack developer with 5+ years experience. React, Node.js.', 'UI/UX designer. Figma, user research, design systems.', 'Content writer and translator. Tech and marketing.'],
  },
  {
    code: 'PL',
    name: 'Poland',
    currency: 'PLN',
    cities: ['Warsaw', 'Krakow', 'Gdansk', 'Wroclaw', 'Poznan'],
    firstNames: ['Jan', 'Anna', 'Piotr', 'Maria', 'Krzysztof', 'Katarzyna', 'Andrzej', 'Magdalena', 'Tomasz', 'Monika', 'Pawel', 'Joanna', 'Michal', 'Agnieszka', 'Jakub'],
    lastNames: ['Kowalski', 'Nowak', 'Wisniewski', 'Wojcik', 'Kaminska', 'Lewandowski', 'Zielinski', 'Szymanski', 'Woźniak', 'Dabrowski', 'Kozlowski', 'Jankowski', 'Mazur', 'Krawczyk', 'Piotrowski'],
    bioPool: ['Business owner from Poland looking for skilled professionals.', 'Startup founder seeking reliable partners.', 'Based in Poland, open to international collaboration.'],
    specialistBioPool: ['Backend developer. Python, Django, PostgreSQL.', 'Digital marketing specialist. SEO, PPC, analytics.', 'Graphic designer. Branding, print, digital.'],
  },
  {
    code: 'EE',
    name: 'Estonia',
    currency: 'EUR',
    cities: ['Tallinn', 'Tartu', 'Narva', 'Parnu'],
    firstNames: ['Mart', 'Laura', 'Jaan', 'Kadri', 'Toomas', 'Kristiina', 'Andres', 'Maria', 'Peeter', 'Liis', 'Kristjan', 'Anna', 'Marek', 'Helen', 'Rasmus'],
    lastNames: ['Tamm', 'Saar', 'Sepp', 'Kask', 'Mets', 'Ilves', 'Kukk', 'Vaher', 'Rebane', 'Koppel', 'Lepik', 'Oja', 'Rand', 'Laas', 'Kuusk'],
    bioPool: ['Estonian entrepreneur looking for tech and design talent.', 'Based in Tallinn, need quality freelancers.', 'Seeking professional collaboration for digital projects.'],
    specialistBioPool: ['Software engineer. Java, Kotlin, mobile and web.', 'Data analyst. SQL, Python, visualization.', 'Video editor. Premiere, After Effects, motion graphics.'],
  },
  {
    code: 'ES',
    name: 'Spain',
    currency: 'EUR',
    cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Bilbao'],
    firstNames: ['Carlos', 'Maria', 'Antonio', 'Carmen', 'Juan', 'Isabel', 'Francisco', 'Laura', 'Miguel', 'Elena', 'Jose', 'Ana', 'David', 'Sofia', 'Pablo'],
    lastNames: ['Garcia', 'Rodriguez', 'Martinez', 'Lopez', 'Gonzalez', 'Sanchez', 'Perez', 'Martin', 'Fernandez', 'Ruiz', 'Diaz', 'Moreno', 'Alvarez', 'Romero', 'Torres'],
    bioPool: ['Spanish company seeking freelancers for various projects.', 'Based in Spain, looking for skilled professionals.', 'Entrepreneur from Barcelona open to remote collaboration.'],
    specialistBioPool: ['Frontend developer. React, Vue, TypeScript.', 'Copywriter and content strategist. B2B and SaaS.', 'Photographer. Product, events, corporate.'],
  },
  {
    code: 'AE',
    name: 'UAE',
    currency: 'AED',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman'],
    firstNames: ['Ahmed', 'Fatima', 'Mohammed', 'Sara', 'Omar', 'Layla', 'Khalid', 'Mariam', 'Hassan', 'Noor', 'Ali', 'Aisha', 'Youssef', 'Hana', 'Ibrahim'],
    lastNames: ['Al Maktoum', 'Al Nahyan', 'Hassan', 'Khan', 'Al Rashid', 'Ali', 'Al Farsi', 'Mohammed', 'Al Balushi', 'Al Zaabi', 'Al Mansouri', 'Al Otaiba', 'Al Qasimi', 'Al Nuaimi', 'Al Ketbi'],
    bioPool: ['Dubai-based business looking for international freelancers.', 'UAE entrepreneur seeking quality and reliability.', 'Based in Abu Dhabi, need professional services.'],
    specialistBioPool: ['Project manager. Agile, Scrum, cross-functional teams.', 'DevOps engineer. AWS, Docker, CI/CD.', 'Social media manager. Strategy, content, community.'],
  },
  {
    code: 'DE',
    name: 'Germany',
    currency: 'EUR',
    cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne'],
    firstNames: ['Thomas', 'Anna', 'Michael', 'Julia', 'Stefan', 'Laura', 'Martin', 'Sarah', 'Andreas', 'Christina', 'Daniel', 'Katharina', 'Christian', 'Lisa', 'Markus'],
    lastNames: ['Mueller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Richter', 'Klein', 'Wolf', 'Schroeder'],
    bioPool: ['German company seeking skilled freelancers.', 'Based in Berlin, looking for professional collaboration.', 'Startup from Munich in need of reliable specialists.'],
    specialistBioPool: ['Mobile developer. iOS (Swift), Android (Kotlin).', 'QA engineer. Manual and automated testing.', 'Legal consultant. Contracts, compliance, IP.'],
  },
  {
    code: 'CY',
    name: 'Cyprus',
    currency: 'EUR',
    cities: ['Nicosia', 'Limassol', 'Larnaca', 'Paphos'],
    firstNames: ['Andreas', 'Maria', 'Christos', 'Elena', 'Nicos', 'Sophia', 'Costas', 'Anna', 'Yiannis', 'Christina', 'George', 'Katerina', 'Michalis', 'Ioanna', 'Petros'],
    lastNames: ['Ioannou', 'Georgiou', 'Constantinou', 'Christodoulou', 'Michael', 'Nicolaou', 'Papadopoulos', 'Demetriou', 'Kyriakou', 'Antoniou', 'Hadjicostas', 'Stephanou', 'Savva', 'Mavronicola', 'Kyprianou'],
    bioPool: ['Cyprus-based business looking for freelancers.', 'Entrepreneur from Limassol seeking quality work.', 'Based in Nicosia, open to remote collaboration.'],
    specialistBioPool: ['Accountant. Bookkeeping, tax, reporting.', '3D artist. Blender, product viz, animation.', 'Translator. EN, RU, GR. Legal and marketing.'],
  },
];

interface OrderTemplate {
  titleEn: string;
  titleRu: string;
  titleHy: string;
  descriptionEn: string;
  descriptionRu: string;
  descriptionHy: string;
  bannerImageUrl: string;
}

// Realistic everyday jobs: repairs, fixes, routine work. Banner images match the job type (Unsplash).
const ORDER_TEMPLATES: OrderTemplate[] = [
  { titleEn: 'Fix leaking kitchen tap', titleRu: 'Починить протекающий кран на кухне', titleHy: 'Խոհանոցի հոսող ծորակի վերանորոգում', descriptionEn: 'Kitchen tap is dripping. Need someone to replace washer or fix the cartridge. Bring own parts or quote with parts.', descriptionRu: 'Кран на кухне подтекает. Нужна замена прокладки или картриджа. Запчасти свои или в смету.', descriptionHy: 'Խոհանոցի ծորակը կաթում է։ Պետք է прокладка կամ կարտրիջի փոխարինում։ Մասերն իրենք կբերեն կամ գնահատում մասերով։', bannerImageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=400&fit=crop' },
  { titleEn: 'Deep clean apartment before move-out', titleRu: 'Генеральная уборка квартиры перед выездом', titleHy: 'Բնակարանի խորը մաքրում հեռանալուց առաջ', descriptionEn: 'Two-bedroom apartment needs full clean: floors, kitchen, bathroom, windows. Moving out next week.', descriptionRu: 'Двушка перед выездом: полы, кухня, ванная, окна. Выезд на следующей неделе.', descriptionHy: 'Երկսենյակ բնակարան, ամբողջական մաքրում՝ հատակ, խոհանոց, լոգարան, պատուհաններ։ Հեռանում ենք հաջորդ շաբաթ։', bannerImageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&h=400&fit=crop' },
  { titleEn: 'Replace broken power socket', titleRu: 'Заменить сломанную розетку', titleHy: 'Փոխարինել խափանված վարդակը', descriptionEn: 'One wall socket in the living room does not work. Need safe replacement by a qualified person.', descriptionRu: 'Одна розетка в гостиной не работает. Нужна безопасная замена специалистом.', descriptionHy: 'Սրահի մի վարդակ չի աշխատում։ Պետք է անվտանգ փոխարինում որակավորված մասնագետի կողմից։', bannerImageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&h=400&fit=crop' },
  { titleEn: 'Car oil change and filter', titleRu: 'Замена масла и фильтра в авто', titleHy: 'Ավտոմեքենայի յուղի և ֆիլտրի փոխարինում', descriptionEn: 'Need oil and oil filter change for a sedan. Prefer at my place or suggest a garage.', descriptionRu: 'Замена масла и масляного фильтра для седана. Желательно с выездом или подскажите гараж.', descriptionHy: 'Սեդանի համար յուղի և յուղի ֆիլտրի փոխարինում։ Նախընտրելի է իմ հասցեում կամ առաջարկեք ավտոսրահ։', bannerImageUrl: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&h=400&fit=crop' },
  { titleEn: 'Paint living room walls', titleRu: 'Покрасить стены в гостиной', titleHy: 'Ներկել սրահի պատերը', descriptionEn: 'Living room about 25 m². Walls need two coats. Paint provided. Need careful prep and clean edges.', descriptionRu: 'Гостиная около 25 м². Два слоя краски. Краска есть. Аккуратная подготовка и ровные границы.', descriptionHy: 'Սրահը մոտ 25 մ²։ Պատերին երկու շերտ ներկ։ Ներկը կտամ։ Պետք է զգույշ նախապատրաստում և հավասար եզրեր։', bannerImageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&h=400&fit=crop' },
  { titleEn: 'Mow lawn and trim edges', titleRu: 'Стрижка газона и краёв', titleHy: 'Խոտի և եզրերի կտրում', descriptionEn: 'Small garden, lawn needs mowing and edge trimming. Own equipment or bring mower. One-off.', descriptionRu: 'Небольшой сад, подстричь газон и края. Свой инвентарь или привезти газонокосилку. Разовая работа.', descriptionHy: 'Փոքր այգի, խոտը պետք է կտրել և եզրերը հավասարեցնել։ Սեփական սարք կամ բերել խոտհնձիչ։ Միանվագ։', bannerImageUrl: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=400&fit=crop' },
  { titleEn: 'Assemble flat-pack wardrobe', titleRu: 'Собрать шкаф из flat-pack', titleHy: 'Հավաքել flat-pack զգեստապահարան', descriptionEn: 'IKEA-style wardrobe to assemble. All parts and instructions at home. Need someone patient and careful.', descriptionRu: 'Шкаф в стиле IKEA для сборки. Все детали и инструкция дома. Нужен аккуратный и терпеливый человек.', descriptionHy: 'IKEA-style զգեստապահարան հավաքելու համար։ Բոլոր մասերն ու հրահանգը տանն են։ Պետք է համառ և զգույշ մարդ։', bannerImageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=400&fit=crop' },
  { titleEn: 'Repair washing machine not spinning', titleRu: 'Ремонт стиральной машины, не отжимает', titleHy: 'Լվացքի մեքենայի վերանորոգում, չի ճզմում', descriptionEn: 'Washing machine drains but does not spin. Possibly belt or motor. Diagnose and fix if possible.', descriptionRu: 'Стиральная машина сливает, но не отжимает. Возможно ремень или мотор. Диагностика и починка.', descriptionHy: 'Լվացքի մեքենան ջուր է հանում, բայց չի ճզմում։ Հնարավոր է ռեմեն կամ շարժիչ։ Ախտորոշում և վերանորոգում։', bannerImageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop' },
  { titleEn: 'Mount TV and hide cables', titleRu: 'Установить ТВ и спрятать провода', titleHy: 'Կախել հեռուստացույց և թաքցնել կաբելները', descriptionEn: 'Wall-mount 55" TV and run cables in channel or behind wall. Bracket and TV ready.', descriptionRu: 'Навесить ТВ 55" на стену и провести кабели в канал или за стену. Кронштейн и ТВ есть.', descriptionHy: '55" հեռուստացույցը պատին ամրացնել և կաբելները անցկացնել խողովակով կամ պատի հետևում։ Կախիչն ու TV-ն պատրաստ են։', bannerImageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&h=400&fit=crop' },
  { titleEn: 'Unblock bathroom sink', titleRu: 'Прочистить засор в раковине ванной', titleHy: 'Լոգարանի լվացարանի խցանումը հեռացնել', descriptionEn: 'Bathroom sink is slow to drain. Need someone to unblock it properly, maybe snake or chemicals.', descriptionRu: 'Раковина в ванной плохо сливается. Нужна прочистка — трос или химия.', descriptionHy: 'Լոգարանի լվացարանը դանդաղ է ցամաքում։ Պետք է ճիշտ պրոխիստկա, հնարավոր է մալուխ կամ քիմիա։', bannerImageUrl: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&h=400&fit=crop' },
  { titleEn: 'Hang curtains and rails', titleRu: 'Повесить шторы и карнизы', titleHy: 'Կախել վարագույրներ և ձողեր', descriptionEn: 'Three windows need curtain rails fitted and curtains hung. Rails and curtains already bought.', descriptionRu: 'Три окна: установить карнизы и повесить шторы. Карнизы и шторы куплены.', descriptionHy: 'Երեք պատուհան՝ ձողեր ամրացնել և վարագույրներ կախել։ Ձողերն ու վարագույրները արդեն գնված են։', bannerImageUrl: 'https://images.unsplash.com/photo-1524484485832-8eba1d9c7942?w=800&h=400&fit=crop' },
  { titleEn: 'Service AC unit (clean filter, check gas)', titleRu: 'Обслуживание кондиционера (фильтр, газ)', titleHy: 'Սառնարան-կոնդիցիոների սպասարկում (ֆիլտր, գազ)', descriptionEn: 'Split AC in living room. Clean filters and check refrigerant. Last serviced over a year ago.', descriptionRu: 'Сплит в гостиной. Почистить фильтры и проверить фреон. Последний раз обслуживали больше года назад.', descriptionHy: 'Սրահի սպլիտ։ Ֆիլտրերի մաքրում և ֆրեոնի ստուգում։ Վերջին սպասարկումը մեկ տարուց ավելի առաջ էր։', bannerImageUrl: 'https://images.unsplash.com/photo-1631540224652-9c6d3a2f2a67?w=800&h=400&fit=crop' },
  { titleEn: 'Fix creaking interior door', titleRu: 'Починить скрипящую межкомнатную дверь', titleHy: 'Ուղղել ճռճռացող ներքին դուռը', descriptionEn: 'Bedroom door creaks and does not close smoothly. Hinges or alignment need adjustment.', descriptionRu: 'Дверь в спальню скрипит и плохо закрывается. Нужна регулировка петель или выравнивание.', descriptionHy: 'Ննջարանի դուռը ճռճռում է և հարթ չի փակվում։ Պետք է hinges-ի կարգաբերում կամ հավասարեցում։', bannerImageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop' },
  { titleEn: 'Car interior clean and vacuum', titleRu: 'Химчистка салона и пылесос', titleHy: 'Մեքենայի ներսի մաքրում և փոշեկուլ', descriptionEn: 'Sedan interior: vacuum, wipe surfaces, clean mats. No need for full detailing.', descriptionRu: 'Салон седана: пылесос, протереть панели, почистить коврики. Полная химчистка не нужна.', descriptionHy: 'Սեդանի ներսը՝ փոշեկուլ, մակերեսներ մաքրել, коврики մաքրել։ Լրիվ դետեյլինգ պետք չէ։', bannerImageUrl: 'https://images.unsplash.com/photo-1507133756360-4b64b70fab4b?w=800&h=400&fit=crop' },
  { titleEn: 'Install shelf and drill wall', titleRu: 'Установить полку, просверлить стену', titleHy: 'Կախել դարակ և պատում հորատել', descriptionEn: 'One heavy-duty shelf in the study, concrete wall. I have the shelf and brackets.', descriptionRu: 'Одна крепкая полка в кабинете, стена бетонная. Полка и кронштейны есть.', descriptionHy: 'Մեկ ամուր դարակ աշխատասենյակում, պատը բետոն է։ Դարակն ու кронштейны կան։', bannerImageUrl: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&h=400&fit=crop' },
  { titleEn: 'Dog walking twice daily for a week', titleRu: 'Выгул собаки дважды в день неделю', titleHy: 'Շան զբոսանք օրական երկու անգամ մեկ շաբաթ', descriptionEn: 'Medium dog, friendly. Need morning and evening walk Mon–Fri while I am away. Feed once daily.', descriptionRu: 'Собака средняя, добрая. Нужны прогулки утром и вечером пн–пт, пока меня нет. Кормление раз в день.', descriptionHy: 'Միջին չափի շուն, բարեկամական։ Պետք է զբոսանք առավոտ և երեկո երկ–ուրբ–հինգ, մինչ ես բացակա եմ։ Կերակրել օրական մեկ անգամ։', bannerImageUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&h=400&fit=crop' },
  { titleEn: 'Clear gutters and downpipes', titleRu: 'Прочистить водостоки и трубы', titleHy: 'Կոյուղու և արտահոսքի խողովակների մաքրում', descriptionEn: 'House gutters are full of leaves. Need clearing and check downpipes. Single-storey house.', descriptionRu: 'Желоба забиты листьями. Прочистить и проверить трубы. Одноэтажный дом.', descriptionHy: 'Ջրահեռացման խողովակները տերևներով լի են։ Պետք է մաքրում և խողովակների ստուգում։ Միահարկ տուն։', bannerImageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=400&fit=crop' },
  { titleEn: 'Replace broken window pane', titleRu: 'Заменить разбитое стекло в окне', titleHy: 'Փոխարինել պատուհանի ջարդված ապակին', descriptionEn: 'One small pane in the bathroom window is cracked. Need measurement, glass and fitting.', descriptionRu: 'Одно небольшое стекло в окне ванной треснуло. Нужен замер, стекло и установка.', descriptionHy: 'Լոգարանի պատուհանի մի փոքր ապակի ճաք է եղել։ Պետք է չափ, ապակի և տեղադրում։', bannerImageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop' },
  { titleEn: 'Move furniture (sofa and bed)', titleRu: 'Переставить мебель (диван и кровать)', titleHy: 'Կահույքի տեղափոխում (բազմոց և մահճակալ)', descriptionEn: 'Moving to new flat. Need help carrying sofa and double bed down one floor and into a van.', descriptionRu: 'Переезд в новую квартиру. Нужна помощь вынести диван и двуспальную кровать с одного этажа в фургон.', descriptionHy: 'Տեղափոխվում ենք նոր բնակարան։ Պետք է օգնություն բազմոցն ու երկտեղ մահճակալը մեկ հարկ ցած հանել և բեռնատար մտցնել։', bannerImageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=400&fit=crop' },
  { titleEn: 'Weed garden and plant flowers', titleRu: 'Прополоть сад и посадить цветы', titleHy: 'Այգում խոտերը հեռացնել և ծաղիկներ տնկել', descriptionEn: 'Small front garden: remove weeds and plant seasonal flowers. Soil is ready. I buy plants.', descriptionRu: 'Небольшой палисадник: прополоть и посадить сезонные цветы. Земля готова. Растения куплю сама.', descriptionHy: 'Փոքր առաջին այգի՝ խոտերը հեռացնել և սեզոնային ծաղիկներ տնկել։ Հողը պատրաստ է։ Բույսերը ես կգնեմ։', bannerImageUrl: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=400&fit=crop' },
  { titleEn: 'Fix loose tiles in bathroom', titleRu: 'Подклеить отходящую плитку в ванной', titleHy: 'Լոգարանում արձակված плиткаը ամրացնել', descriptionEn: 'Two wall tiles are loose above the bath. Need re-grout or re-fix so they stay put.', descriptionRu: 'Две плитки над ванной отходят. Нужно переклеить или заново затереть, чтобы держались.', descriptionHy: 'Լոգարանի վերևի երկու плитка արձակվել են։ Պետք է նորից սոսնձել կամ խճճել, որ պահվեն։', bannerImageUrl: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&h=400&fit=crop' },
  { titleEn: 'Change lock on front door', titleRu: 'Заменить замок на входной двери', titleHy: 'Փոխարինել մուտքի դռան կողպեքը', descriptionEn: 'Lost keys. Need cylinder lock replaced on front door. Prefer same brand or compatible.', descriptionRu: 'Потерял ключи. Нужна замена цилиндрового замка на входной двери. Желательно той же марки.', descriptionHy: 'Բանալիները կորել են։ Պետք է մուտքի դռան цилиндр замка-ի փոխարինում։ Նախընտրելի է նույն ապրանքանիշը։', bannerImageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop' },
  { titleEn: 'Clean windows inside and out', titleRu: 'Помыть окна снаружи и изнутри', titleHy: 'Պատուհանները ներսից և դրսից լվանալ', descriptionEn: 'Ground-floor flat, 4 windows. Inside and outside. No high or dangerous access.', descriptionRu: 'Квартира на первом этаже, 4 окна. Изнутри и снаружи. Без высоты.', descriptionHy: 'Առաջին հարկի բնակարան, 4 պատուհան։ Ներսից և դրսից։ Բարձրություն/վտանգ չկա։', bannerImageUrl: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=400&fit=crop' },
  { titleEn: 'Install ceiling light fixture', titleRu: 'Установить потолочный светильник', titleHy: 'Կախել առաստաղի լամպ', descriptionEn: 'New ceiling light to install in hallway. Wiring already in place, need safe connection and mount.', descriptionRu: 'Новый потолочный светильник в прихожей. Проводка есть, нужна безопасная подключка и крепление.', descriptionHy: 'Միջանցքում նոր առաստաղի լամպ տեղադրել։ Էլեկտրագծերը պատրաստ են, պետք է անվտանգ միացում և ամրացում։', bannerImageUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&h=400&fit=crop' },
  { titleEn: 'Fix fridge not cooling properly', titleRu: 'Починить холодильник, плохо холодит', titleHy: 'Սառնարանի վերանորոգում, վատ է սառչում', descriptionEn: 'Fridge runs but freezer and main compartment are not cold enough. Diagnose and fix if feasible.', descriptionRu: 'Холодильник работает, но морозилка и основная камера недостаточно холодные. Диагностика и ремонт.', descriptionHy: 'Սառնարանը աշխատում է, բայց սառնարանն ու հիմնական բաժինը բավարար սառը չեն։ Ախտորոշում և վերանորոգում։', bannerImageUrl: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&h=400&fit=crop' },
  { titleEn: 'Tutor maths for secondary school', titleRu: 'Репетитор по математике для средней школы', titleHy: 'Մաթեմատիկայի դասուսույց ավագ դպրոցի համար', descriptionEn: 'Child in year 9, needs help with algebra and geometry. Two hours per week, at our home.', descriptionRu: 'Ребенок в 9 классе, нужна помощь по алгебре и геометрии. Два часа в неделю, у нас дома.', descriptionHy: 'Երեխան 9-րդ դասարանում է, օգնություն է պետք հանրահաշիվ և երկրաչափություն։ Օրական երկու ժամ, մեր տանը։', bannerImageUrl: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=400&fit=crop' },
  { titleEn: 'Assemble desk and office chair', titleRu: 'Собрать стол и офисное кресло', titleHy: 'Հավաքել գրասեղան և գրասենյակային աթոռ', descriptionEn: 'Flat-pack desk and office chair. Instructions and parts at home. One afternoon job.', descriptionRu: 'Стол и офисное кресло из flat-pack. Инструкции и детали дома. Работа на полдня.', descriptionHy: 'Flat-pack գրասեղան և գրասենյակային աթոռ։ Հրահանգներն ու մասերը տանն են։ Կես օրվա աշխատանք։', bannerImageUrl: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba63b?w=800&h=400&fit=crop' },
  { titleEn: 'Paint fence and gate', titleRu: 'Покрасить забор и калитку', titleHy: 'Ներկել ցանկապատը և դարպասը', descriptionEn: 'Wooden fence and gate need two coats of weatherproof paint. Paint and brushes provided.', descriptionRu: 'Деревянный забор и калитка, два слоя атмосферостойкой краски. Краска и кисти есть.', descriptionHy: 'Փայտե ցանկապատն ու դարպասը պետք է երկու շերտ եղանակակայուն ներկ։ Ներկն ու վրձինները կտամ։', bannerImageUrl: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&h=400&fit=crop' },
  { titleEn: 'Remove old carpet and fit vinyl', titleRu: 'Снять старый ковёр и положить винил', titleHy: 'Հեռացնել հին գորգը և դնել վինիլ', descriptionEn: 'Small room, remove old carpet and lay vinyl flooring. Vinyl already purchased.', descriptionRu: 'Небольшая комната: снять старый ковёр и постелить виниловое покрытие. Винил куплен.', descriptionHy: 'Փոքր սենյակ, հեռացնել հին գորգը և դնել վինիլային հատակ։ Վինիլն արդեն գնված է։', bannerImageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop' },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFutureDates(count: number): string[] {
  const dates: string[] = [];
  const base = Date.now();
  for (let i = 0; i < count; i++) {
    const offset = randomInt(1, 60) * 24 * 60 * 60 * 1000;
    dates.push(new Date(base + offset).toISOString().split('T')[0]);
  }
  return [...new Set(dates)].slice(0, count);
}

async function main() {
  require('dotenv').config();

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  const categoryIds = categories.map((c) => c.id);

  const existingSeedUsers = await prisma.user.findMany({
    where: { email: { contains: DEMO_EMAIL_PATTERN } },
    select: { id: true, email: true, role: true },
  });
  const existingCount = existingSeedUsers.length;
  const seedClientIds: number[] = existingSeedUsers.filter((u) => u.role === 'client').map((u) => u.id);
  const seedSpecialistIds: number[] = existingSeedUsers.filter((u) => u.role === 'specialist').map((u) => u.id);
  let usersCreated = 0;
  const clientsPerCountry = Math.ceil(USERS_PER_COUNTRY * (1 - SPECIALIST_RATIO));
  const specialistsPerCountry = USERS_PER_COUNTRY - clientsPerCountry;

  if (existingCount < TARGET_SEED_USERS) {
    let globalIndex = existingCount;
    for (const config of COUNTRY_CONFIGS) {
      for (let i = 0; i < USERS_PER_COUNTRY && globalIndex < TARGET_SEED_USERS; i++) {
        const isClient = i < clientsPerCountry;
        const role = isClient ? 'client' : 'specialist';
        const firstName = pick(config.firstNames);
        const lastName = pick(config.lastNames);
        const name = `${firstName} ${lastName}`;
        const city = pick(config.cities);
        const location = `${city}, ${config.name}`;
        const email = `demo-${config.code.toLowerCase()}-${globalIndex + 1}@hotwork.demo`;
        const baseData: Record<string, unknown> = {
          role,
          name,
          email,
          passwordHash: hashedPassword,
          avatarUrl: `https://i.pravatar.cc/150?u=seed-${config.code}-${globalIndex}`,
          location,
          country: config.code,
          currency: config.currency,
          verified: true,
          creditBalance: 0,
          phone: `+999-${config.code}-${globalIndex + 1}`,
        };
        if (isClient) {
          (baseData as any).bio = pick(config.bioPool);
        } else {
          (baseData as any).bio = pick(config.specialistBioPool);
          (baseData as any).experienceYears = randomInt(1, 12);
          (baseData as any).priceMin = randomInt(20, 80);
          (baseData as any).priceMax = randomInt(100, 400);
          (baseData as any).rateUnit = 'per_project';
        }
        const user = await prisma.user.create({
          data: baseData as any,
        });
        if (isClient) seedClientIds.push(user.id);
        else {
          seedSpecialistIds.push(user.id);
          if (categoryIds.length > 0) {
            const numCats = randomInt(1, Math.min(3, categoryIds.length));
            const chosen = new Set<number>();
            while (chosen.size < numCats) chosen.add(pick(categoryIds));
            for (const catId of chosen) {
              await prisma.userCategory.create({
                data: { userId: user.id, categoryId: catId },
              });
            }
          }
        }
        usersCreated++;
        globalIndex++;
      }
    }
  }

  console.log(`Seed users: ${existingCount} existing, ${usersCreated} created. Total: ${seedClientIds.length} clients, ${seedSpecialistIds.length} specialists.`);

  if (seedClientIds.length === 0) {
    console.log('No seed clients available. Skipping orders.');
    return;
  }

  const openOneTimeCount = await prisma.order.count({
    where: {
      deletedAt: null,
      status: 'open',
      orderType: 'one_time',
    },
  });

  if (openOneTimeCount >= MIN_OPEN_ORDERS_BEFORE_ADDING) {
    console.log(`Open one_time orders already at ${openOneTimeCount}. Skipping order seed.`);
    return;
  }

  let skillIds: number[] = [];
  try {
    const skills = await prisma.skill.findMany({ take: 50, select: { id: true } });
    skillIds = skills.map((s) => s.id);
  } catch {
    // Skill table may not exist or be empty
  }

  const ordersToCreate = Math.min(TARGET_SEED_ORDERS, Math.max(0, TARGET_SEED_ORDERS - openOneTimeCount));
  let ordersCreated = 0;

  for (let i = 0; i < ordersToCreate; i++) {
    const template = pick(ORDER_TEMPLATES);
    const clientId = pick(seedClientIds);
    const client = await prisma.user.findUnique({
      where: { id: clientId },
    });
    const country = (client as { country?: string | null } | null)?.country ?? 'AM';
    const currency = (client as { currency?: string | null } | null)?.currency ?? 'AMD';
    const location = (client as { location?: string | null } | null)?.location ?? 'Yerevan, Armenia';
    const budget = randomInt(50, 5000);
    const availableDates = randomFutureDates(randomInt(2, 5));

    const order = await prisma.order.create({
      data: {
        clientId,
        categoryId: categoryIds.length > 0 ? pick(categoryIds) : null,
        title: template.titleEn,
        titleEn: template.titleEn,
        titleRu: template.titleRu,
        titleHy: template.titleHy,
        description: template.descriptionEn,
        descriptionEn: template.descriptionEn,
        descriptionRu: template.descriptionRu,
        descriptionHy: template.descriptionHy,
        budget,
        currency,
        rateUnit: 'per_project',
        location,
        status: 'open',
        orderType: 'one_time',
        availableDates,
        ...(country && { country }),
      } as Parameters<typeof prisma.order.create>[0]['data'],
    });

    const bannerUrl = template.bannerImageUrl;
    const mediaFile = await prisma.mediaFile.create({
      data: {
        orderId: order.id,
        fileName: `banner-${order.id}.jpg`,
        fileUrl: bannerUrl,
        fileType: 'image',
        mimeType: 'image/jpeg',
        fileSize: 0,
        uploadedBy: clientId,
      },
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { bannerImageId: mediaFile.id },
    });

    if (skillIds.length > 0 && Math.random() < 0.5) {
      const numSkills = randomInt(1, 3);
      const chosen = new Set<number>();
      while (chosen.size < numSkills) chosen.add(pick(skillIds));
      for (const skillId of chosen) {
        await prisma.orderSkill.create({
          data: { orderId: order.id, skillId },
        });
      }
    }
    ordersCreated++;
  }

  console.log(`Orders created: ${ordersCreated}. Total open one_time: ${openOneTimeCount + ordersCreated}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

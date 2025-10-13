import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedReasons() {
  const reasons = [
    {
      code: 'poor_communication',
      nameEn: 'Poor Communication',
      nameRu: 'Плохая коммуникация',
      nameHy: 'Վատ հաղորդակցություն',
      descriptionEn: 'Difficult to communicate or unresponsive',
      descriptionRu: 'Трудно общаться или не отвечает',
      descriptionHy: 'Դժվար հաղորդակցություն կամ չի պատասխանում',
    },
    {
      code: 'budget_mismatch',
      nameEn: 'Budget Mismatch',
      nameRu: 'Несоответствие бюджету',
      nameHy: 'Բյուջեի անհամապատասխանություն',
      descriptionEn: 'Budget expectations did not align',
      descriptionRu: 'Ожидания по бюджету не совпали',
      descriptionHy: 'Բյուջետի ակնկալիքները չհամընկնեցին',
    },
    {
      code: 'quality_concerns',
      nameEn: 'Quality Concerns',
      nameRu: 'Проблемы с качеством',
      nameHy: 'Որակի խնդիրներ',
      descriptionEn: 'Concerns about work quality',
      descriptionRu: 'Проблемы с качеством работы',
      descriptionHy: 'Աշխատանքի որակի հետ կապված խնդիրներ',
    },
    {
      code: 'timeline_issues',
      nameEn: 'Timeline Issues',
      nameRu: 'Проблемы со сроками',
      nameHy: 'Ժամանակացույցի խնդիրներ',
      descriptionEn: 'Could not meet timeline requirements',
      descriptionRu: 'Не смог выполнить требования по срокам',
      descriptionHy: 'Չկարողացավ բավարարել ժամանակացույցի պահանջները',
    },
    {
      code: 'unprofessional_behavior',
      nameEn: 'Unprofessional Behavior',
      nameRu: 'Непрофессиональное поведение',
      nameHy: 'Ոչ պրոֆեսիոնալ վարքագիծ',
      descriptionEn: 'Unprofessional conduct or attitude',
      descriptionRu: 'Непрофессиональное поведение или отношение',
      descriptionHy: 'Ոչ պրոֆեսիոնալ վարքագիծ կամ վերաբերմունք',
    },
    {
      code: 'changed_requirements',
      nameEn: 'Changed Requirements',
      nameRu: 'Изменились требования',
      nameHy: 'Փոխված պահանջներ',
      descriptionEn: 'Project requirements changed',
      descriptionRu: 'Требования проекта изменились',
      descriptionHy: 'Նախագծի պահանջները փոխվել են',
    },
    {
      code: 'personal_reasons',
      nameEn: 'Personal Reasons',
      nameRu: 'Личные причины',
      nameHy: 'Անձնական պատճառներ',
      descriptionEn: 'Personal circumstances prevented continuation',
      descriptionRu: 'Личные обстоятельства помешали продолжению',
      descriptionHy: 'Անձնական հանգամանքները խանգարեցին շարունակությանը',
    },
    {
      code: 'other',
      nameEn: 'Other',
      nameRu: 'Другое',
      nameHy: 'Այլ',
      descriptionEn: 'Other reason not listed',
      descriptionRu: 'Другая причина, не указанная в списке',
      descriptionHy: 'Ցանկում չնշված այլ պատճառ',
    },
  ];

  console.log('Seeding cancellation reasons...');

  for (const reason of reasons) {
    await prisma.reason.upsert({
      where: { code: reason.code },
      update: reason,
      create: reason,
    });
    console.log(`✓ Created/Updated reason: ${reason.code}`);
  }

  console.log('Seeding completed!');
}

seedReasons()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

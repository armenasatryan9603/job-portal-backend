import { Injectable } from "@nestjs/common";

export interface RateUnit {
  value: string;
  labelEn: string;
  labelRu: string;
  labelHy: string;
}

@Injectable()
export class ConstantsService {
  /**
   * Get rate unit options in all supported languages
   */
  getRateUnits(): RateUnit[] {
    return [
      {
        value: "per project",
        labelEn: "per project",
        labelRu: "за проект",
        labelHy: "նախագծի համար",
      },
      {
        value: "per hour",
        labelEn: "per hour",
        labelRu: "в час",
        labelHy: "ժամում",
      },
      {
        value: "per day",
        labelEn: "per day",
        labelRu: "в день",
        labelHy: "օրում",
      },
      {
        value: "per week",
        labelEn: "per week",
        labelRu: "в неделю",
        labelHy: "շաբաթում",
      },
      {
        value: "per month",
        labelEn: "per month",
        labelRu: "в месяц",
        labelHy: "ամսում",
      },
      {
        value: "per year",
        labelEn: "per year",
        labelRu: "в год",
        labelHy: "տարվա համար",
      },
      {
        value: "per task",
        labelEn: "per task",
        labelRu: "за задачу",
        labelHy: "առաջադրանքի համար",
      },
      {
        value: "per milestone",
        labelEn: "per milestone",
        labelRu: "за этап",
        labelHy: "փուլի համար",
      },
      {
        value: "per word",
        labelEn: "per word",
        labelRu: "за слово",
        labelHy: "բառի համար",
      },
      {
        value: "per page",
        labelEn: "per page",
        labelRu: "за страницу",
        labelHy: "էջի համար",
      },
      {
        value: "per item",
        labelEn: "per item",
        labelRu: "за единицу",
        labelHy: "միավորի համար",
      },
      {
        value: "per unit",
        labelEn: "per unit",
        labelRu: "за единицу товара",
        labelHy: "ապրանքի միավորի համար",
      },
      {
        value: "per square meter",
        labelEn: "per square meter",
        labelRu: "за квадратный метр",
        labelHy: "քառակուսի մետրի համար",
      },
      {
        value: "per square foot",
        labelEn: "per square foot",
        labelRu: "за квадратный фут",
        labelHy: "քառակուսի ֆուտի համար",
      },
      {
        value: "per session",
        labelEn: "per session",
        labelRu: "за сессию",
        labelHy: "սեսիայի համար",
      },
      {
        value: "per consultation",
        labelEn: "per consultation",
        labelRu: "за консультацию",
        labelHy: "խորհրդատվության համար",
      },
      {
        value: "per gig",
        labelEn: "per gig",
        labelRu: "за выступление",
        labelHy: "համերգի համար",
      },
      {
        value: "per deliverable",
        labelEn: "per deliverable",
        labelRu: "за результат",
        labelHy: "արդյունքի համար",
      },
      {
        value: "fixed price",
        labelEn: "fixed price",
        labelRu: "фиксированная цена",
        labelHy: "ֆիքսված գին",
      },
      {
        value: "per user",
        labelEn: "per user",
        labelRu: "за пользователя",
        labelHy: "օգտատիրոջ համար",
      },
      {
        value: "per installation",
        labelEn: "per installation",
        labelRu: "за установку",
        labelHy: "տեղադրման համար",
      },
      {
        value: "per maintenance",
        labelEn: "per maintenance",
        labelRu: "за обслуживание",
        labelHy: "սպասարկման համար",
      },
      {
        value: "per revision",
        labelEn: "per revision",
        labelRu: "за правку",
        labelHy: "ուղղման համար",
      },
      {
        value: "per design",
        labelEn: "per design",
        labelRu: "за дизайн",
        labelHy: "դիզայնի համար",
      },
      {
        value: "per logo",
        labelEn: "per logo",
        labelRu: "за логотип",
        labelHy: "լոգոյի համար",
      },
      {
        value: "per website",
        labelEn: "per website",
        labelRu: "за сайт",
        labelHy: "կայքի համար",
      },
      {
        value: "per app",
        labelEn: "per app",
        labelRu: "за приложение",
        labelHy: "հավելվածի համար",
      },
      {
        value: "per video",
        labelEn: "per video",
        labelRu: "за видео",
        labelHy: "տեսանյութի համար",
      },
      {
        value: "per photo",
        labelEn: "per photo",
        labelRu: "за фото",
        labelHy: "լուսանկարի համար",
      },
      {
        value: "per article",
        labelEn: "per article",
        labelRu: "за статью",
        labelHy: "հոդվածի համար",
      },
      {
        value: "per translation",
        labelEn: "per translation",
        labelRu: "за перевод",
        labelHy: "թարգմանության համար",
      },
      {
        value: "per minute",
        labelEn: "per minute",
        labelRu: "в минуту",
        labelHy: "րոպեում",
      },
      {
        value: "per character",
        labelEn: "per character",
        labelRu: "за символ",
        labelHy: "նիշի համար",
      },
      {
        value: "per slide",
        labelEn: "per slide",
        labelRu: "за слайд",
        labelHy: "սլայդի համար",
      },
      {
        value: "per screen",
        labelEn: "per screen",
        labelRu: "за экран",
        labelHy: "էկրանի համար",
      },
      {
        value: "per form",
        labelEn: "per form",
        labelRu: "за форму",
        labelHy: "ձևի համար",
      },
      {
        value: "per report",
        labelEn: "per report",
        labelRu: "за отчет",
        labelHy: "հաշվետվության համար",
      },
      {
        value: "per document",
        labelEn: "per document",
        labelRu: "за документ",
        labelHy: "փաստաթղթի համար",
      },
      {
        value: "per email",
        labelEn: "per email",
        labelRu: "за письмо",
        labelHy: "նամակի համար",
      },
      {
        value: "per post",
        labelEn: "per post",
        labelRu: "за пост",
        labelHy: "գրառման համար",
      },
      {
        value: "per campaign",
        labelEn: "per campaign",
        labelRu: "за кампанию",
        labelHy: "արշավի համար",
      },
      {
        value: "per event",
        labelEn: "per event",
        labelRu: "за мероприятие",
        labelHy: "միջոցառման համար",
      },
      {
        value: "per lesson",
        labelEn: "per lesson",
        labelRu: "за урок",
        labelHy: "դասի համար",
      },
      {
        value: "per course",
        labelEn: "per course",
        labelRu: "за курс",
        labelHy: "դասընթացի համար",
      },
      {
        value: "per repair",
        labelEn: "per repair",
        labelRu: "за ремонт",
        labelHy: "վերանորոգման համար",
      },
      {
        value: "per service call",
        labelEn: "per service call",
        labelRu: "за вызов",
        labelHy: "զանգի համար",
      },
      {
        value: "per quote",
        labelEn: "per quote",
        labelRu: "за смету",
        labelHy: "գնահատականի համար",
      },
      {
        value: "per inspection",
        labelEn: "per inspection",
        labelRu: "за осмотр",
        labelHy: "զննման համար",
      },
    ];
  }

  /**
   * Get rate unit by value
   */
  getRateUnitByValue(value: string): RateUnit | undefined {
    return this.getRateUnits().find((unit) => unit.value === value);
  }

  /**
   * Get rate unit label in a specific language
   */
  getRateUnitLabel(value: string, language: "en" | "ru" | "hy"): string {
    const unit = this.getRateUnitByValue(value);
    if (!unit) {
      return value; // Return original value if not found
    }

    switch (language) {
      case "en":
        return unit.labelEn;
      case "ru":
        return unit.labelRu;
      case "hy":
        return unit.labelHy;
      default:
        return unit.labelEn;
    }
  }
}

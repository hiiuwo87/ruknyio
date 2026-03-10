/**
 * Country and governorate/region data.
 *
 * Default country is Iraq (العراق).
 * Each country has a list of governorates (محافظات) or regions.
 */

export interface CountryData {
  value: string;
  label: string;
  regionLabel: string; // "محافظة" for Iraq, "منطقة" for Saudi, etc.
  regions: { value: string; label: string }[];
}

export const COUNTRIES: CountryData[] = [
  {
    value: 'IQ',
    label: 'العراق',
    regionLabel: 'المحافظة',
    regions: [
      { value: 'baghdad', label: 'بغداد' },
      { value: 'basra', label: 'البصرة' },
      { value: 'nineveh', label: 'نينوى' },
      { value: 'erbil', label: 'أربيل' },
      { value: 'sulaymaniyah', label: 'السليمانية' },
      { value: 'duhok', label: 'دهوك' },
      { value: 'kirkuk', label: 'كركوك' },
      { value: 'diyala', label: 'ديالى' },
      { value: 'anbar', label: 'الأنبار' },
      { value: 'babel', label: 'بابل' },
      { value: 'karbala', label: 'كربلاء' },
      { value: 'najaf', label: 'النجف' },
      { value: 'wasit', label: 'واسط' },
      { value: 'saladin', label: 'صلاح الدين' },
      { value: 'dhiqar', label: 'ذي قار' },
      { value: 'maysan', label: 'ميسان' },
      { value: 'muthanna', label: 'المثنى' },
      { value: 'qadisiyyah', label: 'القادسية' },
    ],
  },
  {
    value: 'SA',
    label: 'السعودية',
    regionLabel: 'المنطقة',
    regions: [
      { value: 'riyadh', label: 'الرياض' },
      { value: 'makkah', label: 'مكة المكرمة' },
      { value: 'madinah', label: 'المدينة المنورة' },
      { value: 'eastern', label: 'المنطقة الشرقية' },
      { value: 'qassim', label: 'القصيم' },
      { value: 'asir', label: 'عسير' },
      { value: 'tabuk', label: 'تبوك' },
      { value: 'hail', label: 'حائل' },
      { value: 'northern', label: 'الحدود الشمالية' },
      { value: 'jazan', label: 'جازان' },
      { value: 'najran', label: 'نجران' },
      { value: 'baha', label: 'الباحة' },
      { value: 'jawf', label: 'الجوف' },
    ],
  },
  {
    value: 'AE',
    label: 'الإمارات',
    regionLabel: 'الإمارة',
    regions: [
      { value: 'abu-dhabi', label: 'أبوظبي' },
      { value: 'dubai', label: 'دبي' },
      { value: 'sharjah', label: 'الشارقة' },
      { value: 'ajman', label: 'عجمان' },
      { value: 'umm-al-quwain', label: 'أم القيوين' },
      { value: 'ras-al-khaimah', label: 'رأس الخيمة' },
      { value: 'fujairah', label: 'الفجيرة' },
    ],
  },
  {
    value: 'KW',
    label: 'الكويت',
    regionLabel: 'المحافظة',
    regions: [
      { value: 'capital', label: 'العاصمة' },
      { value: 'hawalli', label: 'حولي' },
      { value: 'farwaniyah', label: 'الفروانية' },
      { value: 'ahmadi', label: 'الأحمدي' },
      { value: 'jahra', label: 'الجهراء' },
      { value: 'mubarak', label: 'مبارك الكبير' },
    ],
  },
  {
    value: 'BH',
    label: 'البحرين',
    regionLabel: 'المحافظة',
    regions: [
      { value: 'capital', label: 'العاصمة' },
      { value: 'muharraq', label: 'المحرق' },
      { value: 'northern', label: 'الشمالية' },
      { value: 'southern', label: 'الجنوبية' },
    ],
  },
  {
    value: 'QA',
    label: 'قطر',
    regionLabel: 'البلدية',
    regions: [
      { value: 'doha', label: 'الدوحة' },
      { value: 'al-rayyan', label: 'الريان' },
      { value: 'al-wakrah', label: 'الوكرة' },
      { value: 'al-khor', label: 'الخور' },
      { value: 'umm-salal', label: 'أم صلال' },
      { value: 'al-daayen', label: 'الضعاين' },
      { value: 'al-shamal', label: 'الشمال' },
      { value: 'al-sheehaniya', label: 'الشحانية' },
    ],
  },
  {
    value: 'OM',
    label: 'عُمان',
    regionLabel: 'المحافظة',
    regions: [
      { value: 'muscat', label: 'مسقط' },
      { value: 'dhofar', label: 'ظفار' },
      { value: 'musandam', label: 'مسندم' },
      { value: 'buraimi', label: 'البريمي' },
      { value: 'dakhliyah', label: 'الداخلية' },
      { value: 'sharqiyah-north', label: 'شمال الشرقية' },
      { value: 'sharqiyah-south', label: 'جنوب الشرقية' },
      { value: 'dhahirah', label: 'الظاهرة' },
      { value: 'batinah-north', label: 'شمال الباطنة' },
      { value: 'batinah-south', label: 'جنوب الباطنة' },
      { value: 'wusta', label: 'الوسطى' },
    ],
  },
  {
    value: 'JO',
    label: 'الأردن',
    regionLabel: 'المحافظة',
    regions: [
      { value: 'amman', label: 'عمّان' },
      { value: 'irbid', label: 'إربد' },
      { value: 'zarqa', label: 'الزرقاء' },
      { value: 'balqa', label: 'البلقاء' },
      { value: 'mafraq', label: 'المفرق' },
      { value: 'karak', label: 'الكرك' },
      { value: 'tafilah', label: 'الطفيلة' },
      { value: 'maan', label: 'معان' },
      { value: 'aqaba', label: 'العقبة' },
      { value: 'ajloun', label: 'عجلون' },
      { value: 'jerash', label: 'جرش' },
      { value: 'madaba', label: 'مادبا' },
    ],
  },
  {
    value: 'EG',
    label: 'مصر',
    regionLabel: 'المحافظة',
    regions: [
      { value: 'cairo', label: 'القاهرة' },
      { value: 'giza', label: 'الجيزة' },
      { value: 'alexandria', label: 'الإسكندرية' },
      { value: 'dakahlia', label: 'الدقهلية' },
      { value: 'sharqia', label: 'الشرقية' },
      { value: 'qalyubia', label: 'القليوبية' },
      { value: 'gharbia', label: 'الغربية' },
      { value: 'monufia', label: 'المنوفية' },
      { value: 'beheira', label: 'البحيرة' },
      { value: 'kafr-el-sheikh', label: 'كفر الشيخ' },
      { value: 'damietta', label: 'دمياط' },
      { value: 'port-said', label: 'بورسعيد' },
      { value: 'ismailia', label: 'الإسماعيلية' },
      { value: 'suez', label: 'السويس' },
      { value: 'fayoum', label: 'الفيوم' },
      { value: 'beni-suef', label: 'بني سويف' },
      { value: 'minya', label: 'المنيا' },
      { value: 'assiut', label: 'أسيوط' },
      { value: 'sohag', label: 'سوهاج' },
      { value: 'qena', label: 'قنا' },
      { value: 'luxor', label: 'الأقصر' },
      { value: 'aswan', label: 'أسوان' },
      { value: 'red-sea', label: 'البحر الأحمر' },
      { value: 'new-valley', label: 'الوادي الجديد' },
      { value: 'matrouh', label: 'مطروح' },
      { value: 'north-sinai', label: 'شمال سيناء' },
      { value: 'south-sinai', label: 'جنوب سيناء' },
    ],
  },
  {
    value: 'LB',
    label: 'لبنان',
    regionLabel: 'المحافظة',
    regions: [
      { value: 'beirut', label: 'بيروت' },
      { value: 'mount-lebanon', label: 'جبل لبنان' },
      { value: 'north', label: 'الشمال' },
      { value: 'south', label: 'الجنوب' },
      { value: 'bekaa', label: 'البقاع' },
      { value: 'nabatieh', label: 'النبطية' },
      { value: 'akkar', label: 'عكار' },
      { value: 'baalbek-hermel', label: 'بعلبك الهرمل' },
    ],
  },
  {
    value: 'SY',
    label: 'سوريا',
    regionLabel: 'المحافظة',
    regions: [
      { value: 'damascus', label: 'دمشق' },
      { value: 'aleppo', label: 'حلب' },
      { value: 'homs', label: 'حمص' },
      { value: 'hama', label: 'حماة' },
      { value: 'latakia', label: 'اللاذقية' },
      { value: 'deir-ez-zor', label: 'دير الزور' },
      { value: 'idlib', label: 'إدلب' },
      { value: 'hasaka', label: 'الحسكة' },
      { value: 'raqqa', label: 'الرقة' },
      { value: 'daraa', label: 'درعا' },
      { value: 'suwayda', label: 'السويداء' },
      { value: 'tartus', label: 'طرطوس' },
      { value: 'quneitra', label: 'القنيطرة' },
      { value: 'rif-dimashq', label: 'ريف دمشق' },
    ],
  },
  {
    value: 'LY',
    label: 'ليبيا',
    regionLabel: 'المنطقة',
    regions: [
      { value: 'tripoli', label: 'طرابلس' },
      { value: 'benghazi', label: 'بنغازي' },
      { value: 'misrata', label: 'مصراتة' },
      { value: 'zawiya', label: 'الزاوية' },
      { value: 'zliten', label: 'زليتن' },
    ],
  },
  {
    value: 'TN',
    label: 'تونس',
    regionLabel: 'الولاية',
    regions: [
      { value: 'tunis', label: 'تونس العاصمة' },
      { value: 'sfax', label: 'صفاقس' },
      { value: 'sousse', label: 'سوسة' },
      { value: 'kairouan', label: 'القيروان' },
      { value: 'bizerte', label: 'بنزرت' },
    ],
  },
  {
    value: 'DZ',
    label: 'الجزائر',
    regionLabel: 'الولاية',
    regions: [
      { value: 'algiers', label: 'الجزائر العاصمة' },
      { value: 'oran', label: 'وهران' },
      { value: 'constantine', label: 'قسنطينة' },
      { value: 'annaba', label: 'عنابة' },
      { value: 'blida', label: 'البليدة' },
    ],
  },
  {
    value: 'MA',
    label: 'المغرب',
    regionLabel: 'الجهة',
    regions: [
      { value: 'casablanca', label: 'الدار البيضاء' },
      { value: 'rabat', label: 'الرباط' },
      { value: 'fez', label: 'فاس' },
      { value: 'marrakech', label: 'مراكش' },
      { value: 'tangier', label: 'طنجة' },
    ],
  },
  {
    value: 'TR',
    label: 'تركيا',
    regionLabel: 'المدينة',
    regions: [
      { value: 'istanbul', label: 'إسطنبول' },
      { value: 'ankara', label: 'أنقرة' },
      { value: 'izmir', label: 'إزمير' },
      { value: 'bursa', label: 'بورصة' },
      { value: 'antalya', label: 'أنطاليا' },
      { value: 'gaziantep', label: 'غازي عنتاب' },
    ],
  },
];

/** Get a country by its ISO code */
export function getCountryByCode(code: string): CountryData | undefined {
  return COUNTRIES.find((c) => c.value === code);
}

/** Get default country (Iraq) */
export function getDefaultCountry(): CountryData {
  return COUNTRIES[0]; // Iraq
}

/** Get regions for a country code */
export function getRegionsForCountry(
  countryCode: string,
): { value: string; label: string }[] {
  return getCountryByCode(countryCode)?.regions ?? [];
}

/** Get region label for a country (e.g., "المحافظة", "المنطقة") */
export function getRegionLabel(countryCode: string): string {
  return getCountryByCode(countryCode)?.regionLabel ?? 'المنطقة';
}

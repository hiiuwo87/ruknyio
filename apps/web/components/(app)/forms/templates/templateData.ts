import { FieldType } from '@/lib/hooks/useForms';

// ============================================
// Types
// ============================================

export type TemplateLanguage = 'ar' | 'en';

export type TemplateCategory = 'business' | 'customer-service' | 'hr' | 'events';

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, { ar: string; en: string }> = {
  'business': { ar: 'أعمال', en: 'Business' },
  'customer-service': { ar: 'خدمة عملاء', en: 'Customer Service' },
  'hr': { ar: 'موارد بشرية', en: 'HR' },
  'events': { ar: 'فعاليات', en: 'Events' },
};

export interface TemplateField {
  id: string;
  type: FieldType;
  label: { ar: string; en: string };
  placeholder?: { ar: string; en: string };
  helpText?: { ar: string; en: string };
  required: boolean;
  options?: { value: string; label: { ar: string; en: string } }[];
}

export interface FormTemplate {
  id: string;
  name: { ar: string; en: string };
  description: { ar: string; en: string };
  icon: string;
  color: string;
  category: TemplateCategory;
  fields: TemplateField[];
}

// ============================================
// Iraqi Governorates
// ============================================

const IRAQI_GOVERNORATES = [
  { value: 'baghdad', label: { ar: 'بغداد', en: 'Baghdad' } },
  { value: 'basra', label: { ar: 'البصرة', en: 'Basra' } },
  { value: 'nineveh', label: { ar: 'نينوى', en: 'Nineveh' } },
  { value: 'erbil', label: { ar: 'أربيل', en: 'Erbil' } },
  { value: 'sulaymaniyah', label: { ar: 'السليمانية', en: 'Sulaymaniyah' } },
  { value: 'duhok', label: { ar: 'دهوك', en: 'Duhok' } },
  { value: 'kirkuk', label: { ar: 'كركوك', en: 'Kirkuk' } },
  { value: 'diyala', label: { ar: 'ديالى', en: 'Diyala' } },
  { value: 'anbar', label: { ar: 'الأنبار', en: 'Anbar' } },
  { value: 'babylon', label: { ar: 'بابل', en: 'Babylon' } },
  { value: 'karbala', label: { ar: 'كربلاء', en: 'Karbala' } },
  { value: 'najaf', label: { ar: 'النجف', en: 'Najaf' } },
  { value: 'wasit', label: { ar: 'واسط', en: 'Wasit' } },
  { value: 'maysan', label: { ar: 'ميسان', en: 'Maysan' } },
  { value: 'dhi_qar', label: { ar: 'ذي قار', en: 'Dhi Qar' } },
  { value: 'muthanna', label: { ar: 'المثنى', en: 'Muthanna' } },
  { value: 'qadisiyyah', label: { ar: 'القادسية', en: 'Qadisiyyah' } },
  { value: 'saladin', label: { ar: 'صلاح الدين', en: 'Saladin' } },
];

// ============================================
// Template 1: Contact Form (اتصال سريع)
// ============================================

const contactFormTemplate: FormTemplate = {
  id: 'contact',
  name: { ar: 'نموذج اتصال سريع', en: 'Quick Contact Form' },
  description: { 
    ar: 'نموذج بسيط للتواصل مع العملاء - يتضمن الاسم، البريد، الهاتف، والرسالة', 
    en: 'Simple form to connect with customers - includes name, email, phone, and message' 
  },
  icon: 'mail',
  color: 'blue',
  category: 'business',
  fields: [
    {
      id: 'full_name',
      type: FieldType.TEXT,
      label: { ar: 'الاسم الكامل', en: 'Full Name' },
      placeholder: { ar: 'أدخل اسمك الكامل', en: 'Enter your full name' },
      required: true,
    },
    {
      id: 'email',
      type: FieldType.EMAIL,
      label: { ar: 'البريد الإلكتروني', en: 'Email Address' },
      placeholder: { ar: 'example@email.com', en: 'example@email.com' },
      required: true,
    },
    {
      id: 'governorate',
      type: FieldType.SELECT,
      label: { ar: 'المحافظة', en: 'Governorate' },
      placeholder: { ar: 'اختر المحافظة', en: 'Select governorate' },
      required: true,
      options: IRAQI_GOVERNORATES,
    },
    {
      id: 'phone',
      type: FieldType.PHONE,
      label: { ar: 'رقم الهاتف', en: 'Phone Number' },
      placeholder: { ar: '07XX XXX XXXX', en: '07XX XXX XXXX' },
      required: true,
    },
    {
      id: 'message',
      type: FieldType.TEXTAREA,
      label: { ar: 'اترك تعليقك', en: 'Leave a Comment' },
      placeholder: { ar: 'اكتب رسالتك هنا...', en: 'Write your message here...' },
      required: false,
    },
  ],
};

// ============================================
// Template 2: Maintenance Request (طلب صيانة)
// ============================================

const maintenanceFormTemplate: FormTemplate = {
  id: 'maintenance',
  name: { ar: 'طلب صيانة / بلاغ عطل', en: 'Maintenance Request / Fault Report' },
  description: { 
    ar: 'نموذج لاستقبال طلبات الصيانة والإبلاغ عن الأعطال مع إمكانية رفع صور', 
    en: 'Form to receive maintenance requests and fault reports with image upload' 
  },
  icon: 'wrench',
  color: 'orange',
  category: 'customer-service',
  fields: [
    {
      id: 'customer_name',
      type: FieldType.TEXT,
      label: { ar: 'اسم العميل', en: 'Customer Name' },
      placeholder: { ar: 'أدخل اسمك', en: 'Enter your name' },
      required: true,
    },
    {
      id: 'phone',
      type: FieldType.PHONE,
      label: { ar: 'رقم الهاتف', en: 'Phone Number' },
      placeholder: { ar: '07XX XXX XXXX', en: '07XX XXX XXXX' },
      required: true,
    },
    {
      id: 'governorate',
      type: FieldType.SELECT,
      label: { ar: 'المحافظة', en: 'Governorate' },
      placeholder: { ar: 'اختر المحافظة', en: 'Select governorate' },
      required: true,
      options: IRAQI_GOVERNORATES,
    },
    {
      id: 'address',
      type: FieldType.TEXTAREA,
      label: { ar: 'العنوان التفصيلي', en: 'Detailed Address' },
      placeholder: { ar: 'المنطقة، الشارع، أقرب نقطة دالة', en: 'Area, street, nearest landmark' },
      required: true,
    },
    {
      id: 'fault_type',
      type: FieldType.SELECT,
      label: { ar: 'نوع العطل', en: 'Fault Type' },
      placeholder: { ar: 'اختر نوع العطل', en: 'Select fault type' },
      required: true,
      options: [
        { value: 'electrical', label: { ar: 'كهربائي', en: 'Electrical' } },
        { value: 'plumbing', label: { ar: 'سباكة', en: 'Plumbing' } },
        { value: 'ac', label: { ar: 'تكييف وتبريد', en: 'AC & Cooling' } },
        { value: 'appliances', label: { ar: 'أجهزة منزلية', en: 'Home Appliances' } },
        { value: 'carpentry', label: { ar: 'نجارة', en: 'Carpentry' } },
        { value: 'painting', label: { ar: 'دهان وطلاء', en: 'Painting' } },
        { value: 'other', label: { ar: 'أخرى', en: 'Other' } },
      ],
    },
    {
      id: 'urgency',
      type: FieldType.RADIO,
      label: { ar: 'درجة الاستعجال', en: 'Urgency Level' },
      required: true,
      options: [
        { value: 'low', label: { ar: 'عادي', en: 'Normal' } },
        { value: 'medium', label: { ar: 'متوسط', en: 'Medium' } },
        { value: 'high', label: { ar: 'عاجل', en: 'Urgent' } },
        { value: 'critical', label: { ar: 'طارئ جداً', en: 'Critical' } },
      ],
    },
    {
      id: 'preferred_time',
      type: FieldType.DATE,
      label: { ar: 'الوقت المناسب للزيارة', en: 'Preferred Visit Time' },
      helpText: { ar: 'اختر التاريخ والوقت المناسب', en: 'Select preferred date and time' },
      required: false,
    },
    {
      id: 'problem_description',
      type: FieldType.TEXTAREA,
      label: { ar: 'وصف المشكلة', en: 'Problem Description' },
      placeholder: { ar: 'اشرح المشكلة بالتفصيل...', en: 'Describe the problem in detail...' },
      required: true,
    },
    {
      id: 'photos',
      type: FieldType.FILE,
      label: { ar: 'صور العطل', en: 'Fault Photos' },
      helpText: { ar: 'ارفق صور توضيحية للمشكلة (اختياري)', en: 'Attach photos of the problem (optional)' },
      required: false,
    },
  ],
};

// ============================================
// Template 3: Complaint/Suggestion (شكوى/اقتراح)
// ============================================

const complaintFormTemplate: FormTemplate = {
  id: 'complaint',
  name: { ar: 'شكوى / اقتراح', en: 'Complaint / Suggestion' },
  description: { 
    ar: 'نموذج لخدمة العملاء - استقبال الشكاوى والاقتراحات والاستفسارات', 
    en: 'Customer service form - receive complaints, suggestions, and inquiries' 
  },
  icon: 'message-square',
  color: 'purple',
  category: 'customer-service',
  fields: [
    {
      id: 'name',
      type: FieldType.TEXT,
      label: { ar: 'الاسم', en: 'Name' },
      placeholder: { ar: 'أدخل اسمك (اختياري)', en: 'Enter your name (optional)' },
      helpText: { ar: 'يمكنك إرسال الشكوى بشكل مجهول', en: 'You can submit anonymously' },
      required: false,
    },
    {
      id: 'contact',
      type: FieldType.TEXT,
      label: { ar: 'رقم الهاتف أو البريد الإلكتروني', en: 'Phone or Email' },
      placeholder: { ar: 'للتواصل معك بخصوص الشكوى', en: 'To contact you regarding the complaint' },
      required: false,
    },
    {
      id: 'message_type',
      type: FieldType.RADIO,
      label: { ar: 'نوع الرسالة', en: 'Message Type' },
      required: true,
      options: [
        { value: 'complaint', label: { ar: 'شكوى', en: 'Complaint' } },
        { value: 'suggestion', label: { ar: 'اقتراح', en: 'Suggestion' } },
        { value: 'inquiry', label: { ar: 'استفسار', en: 'Inquiry' } },
        { value: 'praise', label: { ar: 'شكر وإشادة', en: 'Praise' } },
      ],
    },
    {
      id: 'order_number',
      type: FieldType.TEXT,
      label: { ar: 'رقم الطلب', en: 'Order Number' },
      placeholder: { ar: 'إذا كانت الشكوى متعلقة بطلب معين', en: 'If complaint is related to a specific order' },
      required: false,
    },
    {
      id: 'details',
      type: FieldType.TEXTAREA,
      label: { ar: 'التفاصيل', en: 'Details' },
      placeholder: { ar: 'اكتب تفاصيل الشكوى أو الاقتراح...', en: 'Write the details of your complaint or suggestion...' },
      required: true,
    },
    {
      id: 'attachments',
      type: FieldType.FILE,
      label: { ar: 'مرفقات', en: 'Attachments' },
      helpText: { ar: 'يمكنك إرفاق صور أو مستندات داعمة', en: 'You can attach supporting images or documents' },
      required: false,
    },
  ],
};

// ============================================
// Template 4: Customer Satisfaction Survey (استبيان رضا العملاء)
// ============================================

const satisfactionSurveyTemplate: FormTemplate = {
  id: 'satisfaction',
  name: { ar: 'استبيان رضا العملاء', en: 'Customer Satisfaction Survey' },
  description: {
    ar: 'قياس رضا العملاء عن الخدمة والمنتجات مع تقييمات ومقاييس',
    en: 'Measure customer satisfaction with services and products using ratings and scales',
  },
  icon: 'star',
  color: 'amber',
  category: 'customer-service',
  fields: [
    {
      id: 'customer_name',
      type: FieldType.TEXT,
      label: { ar: 'الاسم (اختياري)', en: 'Name (optional)' },
      placeholder: { ar: 'أدخل اسمك', en: 'Enter your name' },
      required: false,
    },
    {
      id: 'overall_rating',
      type: FieldType.RATING,
      label: { ar: 'التقييم العام للخدمة', en: 'Overall Service Rating' },
      helpText: { ar: 'من 1 (سيء) إلى 5 (ممتاز)', en: 'From 1 (poor) to 5 (excellent)' },
      required: true,
    },
    {
      id: 'service_quality',
      type: FieldType.SCALE,
      label: { ar: 'جودة الخدمة المقدمة', en: 'Quality of Service Provided' },
      helpText: { ar: 'من 1 إلى 10', en: 'From 1 to 10' },
      required: true,
    },
    {
      id: 'response_speed',
      type: FieldType.RADIO,
      label: { ar: 'سرعة الاستجابة', en: 'Response Speed' },
      required: true,
      options: [
        { value: 'excellent', label: { ar: 'ممتازة', en: 'Excellent' } },
        { value: 'good', label: { ar: 'جيدة', en: 'Good' } },
        { value: 'average', label: { ar: 'متوسطة', en: 'Average' } },
        { value: 'slow', label: { ar: 'بطيئة', en: 'Slow' } },
      ],
    },
    {
      id: 'recommend',
      type: FieldType.TOGGLE,
      label: { ar: 'هل تنصح الآخرين بالتعامل معنا؟', en: 'Would you recommend us to others?' },
      required: true,
    },
    {
      id: 'improvements',
      type: FieldType.TEXTAREA,
      label: { ar: 'ما الذي يمكننا تحسينه؟', en: 'What can we improve?' },
      placeholder: { ar: 'شاركنا اقتراحاتك للتحسين...', en: 'Share your improvement suggestions...' },
      required: false,
    },
  ],
};

// ============================================
// Template 5: Job Application (طلب توظيف)
// ============================================

const jobApplicationTemplate: FormTemplate = {
  id: 'job-application',
  name: { ar: 'طلب توظيف', en: 'Job Application' },
  description: {
    ar: 'استقبال طلبات التوظيف مع بيانات المتقدم والسيرة الذاتية',
    en: 'Receive job applications with applicant data and resume',
  },
  icon: 'user-plus',
  color: 'emerald',
  category: 'hr',
  fields: [
    {
      id: 'full_name',
      type: FieldType.TEXT,
      label: { ar: 'الاسم الكامل', en: 'Full Name' },
      placeholder: { ar: 'أدخل اسمك الثلاثي', en: 'Enter your full name' },
      required: true,
    },
    {
      id: 'email',
      type: FieldType.EMAIL,
      label: { ar: 'البريد الإلكتروني', en: 'Email Address' },
      placeholder: { ar: 'example@email.com', en: 'example@email.com' },
      required: true,
    },
    {
      id: 'phone',
      type: FieldType.PHONE,
      label: { ar: 'رقم الهاتف', en: 'Phone Number' },
      placeholder: { ar: '07XX XXX XXXX', en: '07XX XXX XXXX' },
      required: true,
    },
    {
      id: 'governorate',
      type: FieldType.SELECT,
      label: { ar: 'المحافظة', en: 'Governorate' },
      placeholder: { ar: 'اختر المحافظة', en: 'Select governorate' },
      required: true,
      options: IRAQI_GOVERNORATES,
    },
    {
      id: 'position',
      type: FieldType.TEXT,
      label: { ar: 'الوظيفة المطلوبة', en: 'Position Applied For' },
      placeholder: { ar: 'مثال: مصمم جرافيك', en: 'e.g., Graphic Designer' },
      required: true,
    },
    {
      id: 'experience',
      type: FieldType.SELECT,
      label: { ar: 'سنوات الخبرة', en: 'Years of Experience' },
      placeholder: { ar: 'اختر سنوات الخبرة', en: 'Select years of experience' },
      required: true,
      options: [
        { value: 'none', label: { ar: 'بدون خبرة', en: 'No experience' } },
        { value: '1-2', label: { ar: '1-2 سنة', en: '1-2 years' } },
        { value: '3-5', label: { ar: '3-5 سنوات', en: '3-5 years' } },
        { value: '5-10', label: { ar: '5-10 سنوات', en: '5-10 years' } },
        { value: '10+', label: { ar: 'أكثر من 10 سنوات', en: '10+ years' } },
      ],
    },
    {
      id: 'about',
      type: FieldType.TEXTAREA,
      label: { ar: 'نبذة عنك', en: 'About You' },
      placeholder: { ar: 'اكتب نبذة مختصرة عن مهاراتك وخبراتك...', en: 'Write a brief summary of your skills and experience...' },
      required: true,
    },
    {
      id: 'resume',
      type: FieldType.FILE,
      label: { ar: 'السيرة الذاتية', en: 'Resume / CV' },
      helpText: { ar: 'ارفق سيرتك الذاتية (PDF أو Word)', en: 'Attach your resume (PDF or Word)' },
      required: true,
    },
  ],
};

// ============================================
// Template 6: Appointment Booking (حجز موعد)
// ============================================

const appointmentBookingTemplate: FormTemplate = {
  id: 'appointment',
  name: { ar: 'حجز موعد', en: 'Appointment Booking' },
  description: {
    ar: 'حجز مواعيد للعيادات والصالونات والمكاتب مع اختيار التاريخ والوقت',
    en: 'Book appointments for clinics, salons, and offices with date and time selection',
  },
  icon: 'calendar',
  color: 'teal',
  category: 'business',
  fields: [
    {
      id: 'full_name',
      type: FieldType.TEXT,
      label: { ar: 'الاسم الكامل', en: 'Full Name' },
      placeholder: { ar: 'أدخل اسمك', en: 'Enter your name' },
      required: true,
    },
    {
      id: 'phone',
      type: FieldType.PHONE,
      label: { ar: 'رقم الهاتف', en: 'Phone Number' },
      placeholder: { ar: '07XX XXX XXXX', en: '07XX XXX XXXX' },
      required: true,
    },
    {
      id: 'service_type',
      type: FieldType.SELECT,
      label: { ar: 'نوع الخدمة', en: 'Service Type' },
      placeholder: { ar: 'اختر الخدمة المطلوبة', en: 'Select desired service' },
      required: true,
      options: [
        { value: 'consultation', label: { ar: 'استشارة', en: 'Consultation' } },
        { value: 'checkup', label: { ar: 'فحص / كشف', en: 'Checkup' } },
        { value: 'followup', label: { ar: 'متابعة', en: 'Follow-up' } },
        { value: 'other', label: { ar: 'أخرى', en: 'Other' } },
      ],
    },
    {
      id: 'preferred_date',
      type: FieldType.DATE,
      label: { ar: 'التاريخ المفضل', en: 'Preferred Date' },
      required: true,
    },
    {
      id: 'preferred_time',
      type: FieldType.RADIO,
      label: { ar: 'الفترة المفضلة', en: 'Preferred Time Slot' },
      required: true,
      options: [
        { value: 'morning', label: { ar: 'صباحاً (9-12)', en: 'Morning (9-12)' } },
        { value: 'afternoon', label: { ar: 'ظهراً (12-3)', en: 'Afternoon (12-3)' } },
        { value: 'evening', label: { ar: 'مساءً (3-6)', en: 'Evening (3-6)' } },
      ],
    },
    {
      id: 'notes',
      type: FieldType.TEXTAREA,
      label: { ar: 'ملاحظات إضافية', en: 'Additional Notes' },
      placeholder: { ar: 'أي ملاحظات تود إضافتها...', en: 'Any notes you would like to add...' },
      required: false,
    },
  ],
};

// ============================================
// Template 7: Event Registration (تسجيل فعالية)
// ============================================

const eventRegistrationTemplate: FormTemplate = {
  id: 'event-registration',
  name: { ar: 'تسجيل في فعالية', en: 'Event Registration' },
  description: {
    ar: 'تسجيل حضور لمؤتمرات وورش عمل وفعاليات مع بيانات المشاركين',
    en: 'Register attendance for conferences, workshops, and events with participant data',
  },
  icon: 'clipboard-list',
  color: 'indigo',
  category: 'events',
  fields: [
    {
      id: 'full_name',
      type: FieldType.TEXT,
      label: { ar: 'الاسم الكامل', en: 'Full Name' },
      placeholder: { ar: 'أدخل اسمك الكامل', en: 'Enter your full name' },
      required: true,
    },
    {
      id: 'email',
      type: FieldType.EMAIL,
      label: { ar: 'البريد الإلكتروني', en: 'Email Address' },
      placeholder: { ar: 'example@email.com', en: 'example@email.com' },
      required: true,
    },
    {
      id: 'phone',
      type: FieldType.PHONE,
      label: { ar: 'رقم الهاتف', en: 'Phone Number' },
      placeholder: { ar: '07XX XXX XXXX', en: '07XX XXX XXXX' },
      required: true,
    },
    {
      id: 'organization',
      type: FieldType.TEXT,
      label: { ar: 'جهة العمل / المؤسسة', en: 'Organization / Company' },
      placeholder: { ar: 'اسم المؤسسة أو الشركة', en: 'Organization or company name' },
      required: false,
    },
    {
      id: 'attendees_count',
      type: FieldType.NUMBER,
      label: { ar: 'عدد الحضور', en: 'Number of Attendees' },
      placeholder: { ar: '1', en: '1' },
      helpText: { ar: 'عدد الأشخاص المسجلين معك', en: 'Number of people registering with you' },
      required: true,
    },
    {
      id: 'interests',
      type: FieldType.CHECKBOX,
      label: { ar: 'المحاور التي تهمك', en: 'Topics of Interest' },
      required: false,
      options: [
        { value: 'tech', label: { ar: 'تكنولوجيا', en: 'Technology' } },
        { value: 'business', label: { ar: 'ريادة أعمال', en: 'Entrepreneurship' } },
        { value: 'marketing', label: { ar: 'تسويق', en: 'Marketing' } },
        { value: 'design', label: { ar: 'تصميم', en: 'Design' } },
        { value: 'other', label: { ar: 'أخرى', en: 'Other' } },
      ],
    },
    {
      id: 'special_requirements',
      type: FieldType.TEXTAREA,
      label: { ar: 'متطلبات خاصة', en: 'Special Requirements' },
      placeholder: { ar: 'هل لديك أي متطلبات خاصة؟', en: 'Do you have any special requirements?' },
      required: false,
    },
  ],
};

// ============================================
// Template 8: Price Quote Request (طلب عرض سعر)
// ============================================

const priceQuoteTemplate: FormTemplate = {
  id: 'price-quote',
  name: { ar: 'طلب عرض سعر', en: 'Price Quote Request' },
  description: {
    ar: 'استقبال طلبات عروض الأسعار من العملاء مع تفاصيل المنتج أو الخدمة',
    en: 'Receive price quote requests from customers with product or service details',
  },
  icon: 'shopping-bag',
  color: 'rose',
  category: 'business',
  fields: [
    {
      id: 'company_name',
      type: FieldType.TEXT,
      label: { ar: 'اسم الشركة / الجهة', en: 'Company / Organization Name' },
      placeholder: { ar: 'أدخل اسم الشركة', en: 'Enter company name' },
      required: true,
    },
    {
      id: 'contact_name',
      type: FieldType.TEXT,
      label: { ar: 'اسم المسؤول', en: 'Contact Person' },
      placeholder: { ar: 'اسم الشخص المسؤول', en: 'Name of contact person' },
      required: true,
    },
    {
      id: 'email',
      type: FieldType.EMAIL,
      label: { ar: 'البريد الإلكتروني', en: 'Email Address' },
      placeholder: { ar: 'example@company.com', en: 'example@company.com' },
      required: true,
    },
    {
      id: 'phone',
      type: FieldType.PHONE,
      label: { ar: 'رقم الهاتف', en: 'Phone Number' },
      placeholder: { ar: '07XX XXX XXXX', en: '07XX XXX XXXX' },
      required: true,
    },
    {
      id: 'product_service',
      type: FieldType.TEXT,
      label: { ar: 'المنتج / الخدمة المطلوبة', en: 'Product / Service Required' },
      placeholder: { ar: 'ما الذي تحتاجه؟', en: 'What do you need?' },
      required: true,
    },
    {
      id: 'quantity',
      type: FieldType.NUMBER,
      label: { ar: 'الكمية المطلوبة', en: 'Required Quantity' },
      placeholder: { ar: 'أدخل الكمية', en: 'Enter quantity' },
      required: false,
    },
    {
      id: 'details',
      type: FieldType.TEXTAREA,
      label: { ar: 'تفاصيل إضافية', en: 'Additional Details' },
      placeholder: { ar: 'مواصفات، أحجام، ألوان، أو أي تفاصيل أخرى...', en: 'Specifications, sizes, colors, or any other details...' },
      required: true,
    },
    {
      id: 'budget',
      type: FieldType.RADIO,
      label: { ar: 'الميزانية التقريبية', en: 'Approximate Budget' },
      required: false,
      options: [
        { value: 'under-500', label: { ar: 'أقل من 500 ألف د.ع', en: 'Under 500K IQD' } },
        { value: '500-1m', label: { ar: '500 ألف - 1 مليون د.ع', en: '500K - 1M IQD' } },
        { value: '1m-5m', label: { ar: '1 - 5 مليون د.ع', en: '1M - 5M IQD' } },
        { value: 'over-5m', label: { ar: 'أكثر من 5 مليون د.ع', en: 'Over 5M IQD' } },
      ],
    },
    {
      id: 'attachments',
      type: FieldType.FILE,
      label: { ar: 'مرفقات', en: 'Attachments' },
      helpText: { ar: 'يمكنك إرفاق صور أو مواصفات فنية', en: 'You can attach images or technical specifications' },
      required: false,
    },
  ],
};

// ============================================
// Export All Templates
// ============================================

export const FORM_TEMPLATES: FormTemplate[] = [
  contactFormTemplate,
  maintenanceFormTemplate,
  complaintFormTemplate,
  satisfactionSurveyTemplate,
  jobApplicationTemplate,
  appointmentBookingTemplate,
  eventRegistrationTemplate,
  priceQuoteTemplate,
];

// Helper function to get template by ID
export const getTemplateById = (id: string): FormTemplate | undefined => {
  return FORM_TEMPLATES.find(t => t.id === id);
};

// Helper function to convert template fields to form fields
export const convertTemplateToFields = (
  template: FormTemplate, 
  language: TemplateLanguage
) => {
  return template.fields.map((field, index) => ({
    id: `field_${Date.now()}_${index}`,
    type: field.type,
    label: field.label[language],
    placeholder: field.placeholder?.[language] || '',
    helpText: field.helpText?.[language] || '',
    required: field.required,
    // Convert options to string[] (just labels)
    options: field.options?.map(opt => opt.label[language]) || [],
    order: index,
  }));
};

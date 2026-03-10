import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// نظام الخصائص الديناميكية للمنتجات - كل فئة لها حقول مخصصة
const storeCategories = [
  {
    id: 'cat_electronics',
    name: 'Electronics',
    nameAr: 'الإلكترونيات',
    slug: 'electronics',
    description: 'Electronic devices and gadgets',
    descriptionAr: 'الأجهزة الإلكترونية والأدوات',
    icon: 'Smartphone',
    color: '#3B82F6',
    order: 1,
    isActive: true,
    templateFields: {
      hasVariants: true,
      variantAttributes: [
        { key: 'storage', label: 'Storage', labelAr: 'السعة التخزينية', options: ['64GB', '128GB', '256GB', '512GB', '1TB'] },
        { key: 'color', label: 'Color', labelAr: 'اللون', options: ['أسود', 'أبيض', 'رمادي', 'ذهبي', 'أزرق'] },
        { key: 'ram', label: 'RAM', labelAr: 'الذاكرة العشوائية', options: ['4GB', '8GB', '12GB', '16GB', '32GB'] },
      ],
      productAttributes: [
        { key: 'warranty', label: 'Warranty', labelAr: 'الضمان', type: 'select', options: ['بدون ضمان', '6 أشهر', 'سنة', 'سنتين'], required: true },
        { key: 'brand', label: 'Brand', labelAr: 'العلامة التجارية', type: 'text', required: true },
        { key: 'condition', label: 'Condition', labelAr: 'الحالة', type: 'select', options: ['جديد', 'مستعمل - ممتاز', 'مستعمل - جيد'], required: true },
      ],
    },
  },
  {
    id: 'cat_fashion',
    name: 'Fashion',
    nameAr: 'الأزياء والموضة',
    slug: 'fashion',
    description: 'Clothing, shoes, and accessories',
    descriptionAr: 'الملابس والأحذية والإكسسوارات',
    icon: 'Shirt',
    color: '#EC4899',
    order: 2,
    isActive: true,
    templateFields: {
      hasVariants: true,
      variantAttributes: [
        { key: 'size', label: 'Size', labelAr: 'المقاس', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] },
        { key: 'color', label: 'Color', labelAr: 'اللون', options: ['أسود', 'أبيض', 'أزرق', 'أحمر', 'أخضر', 'بيج', 'رمادي'] },
      ],
      productAttributes: [
        { key: 'material', label: 'Material', labelAr: 'نوع القماش', type: 'select', options: ['قطن', 'بوليستر', 'حرير', 'صوف', 'جينز', 'كتان'], required: true },
        { key: 'gender', label: 'Gender', labelAr: 'الفئة', type: 'select', options: ['رجالي', 'نسائي', 'للجنسين', 'أطفال'], required: true },
        { key: 'season', label: 'Season', labelAr: 'الموسم', type: 'select', options: ['صيفي', 'شتوي', 'ربيعي', 'كل المواسم'], required: false },
      ],
    },
  },
  {
    id: 'cat_food',
    name: 'Food & Beverages',
    nameAr: 'الطعام والمشروبات',
    slug: 'food-beverages',
    description: 'Restaurants, cafes, and food delivery',
    descriptionAr: 'المطاعم والمقاهي وتوصيل الطعام',
    icon: 'UtensilsCrossed',
    color: '#F59E0B',
    order: 3,
    isActive: true,
    templateFields: {
      hasVariants: false,
      productAttributes: [
        { key: 'expiryDate', label: 'Expiry Date', labelAr: 'تاريخ الانتهاء', type: 'date', required: true },
        { key: 'ingredients', label: 'Ingredients', labelAr: 'المكونات', type: 'textarea', required: true },
        { key: 'calories', label: 'Calories', labelAr: 'السعرات الحرارية', type: 'number', required: false },
        { key: 'allergens', label: 'Allergens', labelAr: 'مسببات الحساسية', type: 'multiselect', options: ['جلوتين', 'لاكتوز', 'مكسرات', 'بيض', 'صويا'], required: false },
        { key: 'storageMethod', label: 'Storage Method', labelAr: 'طريقة التخزين', type: 'select', options: ['درجة حرارة الغرفة', 'مبرد', 'مجمد'], required: true },
      ],
    },
  },
  {
    id: 'cat_beauty',
    name: 'Beauty & Health',
    nameAr: 'الجمال والصحة',
    slug: 'beauty-health',
    description: 'Cosmetics, skincare, and health products',
    descriptionAr: 'مستحضرات التجميل والعناية بالبشرة والمنتجات الصحية',
    icon: 'Sparkles',
    color: '#8B5CF6',
    order: 4,
    isActive: true,
    templateFields: {
      hasVariants: true,
      variantAttributes: [
        { key: 'shade', label: 'Shade', labelAr: 'الدرجة', options: ['فاتح', 'متوسط', 'داكن', 'عاجي', 'برونزي'] },
        { key: 'size', label: 'Size', labelAr: 'الحجم', options: ['30ml', '50ml', '100ml', '200ml'] },
      ],
      productAttributes: [
        { key: 'skinType', label: 'Skin Type', labelAr: 'نوع البشرة', type: 'select', options: ['جافة', 'دهنية', 'مختلطة', 'حساسة', 'عادية'], required: true },
        { key: 'expiryDate', label: 'Expiry Date', labelAr: 'تاريخ الانتهاء', type: 'date', required: true },
        { key: 'ingredients', label: 'Main Ingredients', labelAr: 'المكونات الرئيسية', type: 'textarea', required: false },
        { key: 'certification', label: 'Certification', labelAr: 'الشهادات', type: 'multiselect', options: ['عضوي', 'نباتي', 'خالي من القسوة', 'حلال'], required: false },
      ],
    },
  },
  {
    id: 'cat_home',
    name: 'Home & Garden',
    nameAr: 'المنزل والحديقة',
    slug: 'home-garden',
    description: 'Furniture, decor, and garden supplies',
    descriptionAr: 'الأثاث والديكور ومستلزمات الحديقة',
    icon: 'Home',
    color: '#10B981',
    order: 5,
    isActive: true,
    templateFields: {
      hasVariants: true,
      variantAttributes: [
        { key: 'color', label: 'Color', labelAr: 'اللون', options: ['أبيض', 'أسود', 'بني', 'رمادي', 'بيج'] },
        { key: 'size', label: 'Size', labelAr: 'الحجم', options: ['صغير', 'متوسط', 'كبير'] },
      ],
      productAttributes: [
        { key: 'material', label: 'Material', labelAr: 'الخامة', type: 'select', options: ['خشب', 'معدن', 'زجاج', 'بلاستيك', 'قماش'], required: true },
        { key: 'dimensions', label: 'Dimensions', labelAr: 'الأبعاد', type: 'text', placeholder: 'الطول × العرض × الارتفاع', required: true },
        { key: 'weight', label: 'Weight', labelAr: 'الوزن (كغ)', type: 'number', required: false },
        { key: 'assemblyRequired', label: 'Assembly Required', labelAr: 'يحتاج تركيب', type: 'boolean', required: true },
      ],
    },
  },
  {
    id: 'cat_sports',
    name: 'Sports & Fitness',
    nameAr: 'الرياضة واللياقة',
    slug: 'sports-fitness',
    description: 'Sports equipment and fitness gear',
    descriptionAr: 'المعدات الرياضية وأدوات اللياقة',
    icon: 'Dumbbell',
    color: '#EF4444',
    order: 6,
    isActive: true,
    templateFields: {
      hasVariants: true,
      variantAttributes: [
        { key: 'size', label: 'Size', labelAr: 'المقاس', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
        { key: 'color', label: 'Color', labelAr: 'اللون', options: ['أسود', 'أبيض', 'أزرق', 'أحمر', 'رمادي'] },
      ],
      productAttributes: [
        { key: 'sportType', label: 'Sport Type', labelAr: 'نوع الرياضة', type: 'select', options: ['كرة قدم', 'كرة سلة', 'جري', 'سباحة', 'جيم', 'يوغا', 'عام'], required: true },
        { key: 'targetGender', label: 'Target Gender', labelAr: 'الفئة المستهدفة', type: 'select', options: ['رجالي', 'نسائي', 'للجنسين'], required: true },
        { key: 'weight', label: 'Weight', labelAr: 'الوزن (كغ)', type: 'number', required: false },
      ],
    },
  },
  {
    id: 'cat_books',
    name: 'Books & Education',
    nameAr: 'الكتب والتعليم',
    slug: 'books-education',
    description: 'Books, stationery, and educational materials',
    descriptionAr: 'الكتب والقرطاسية والمواد التعليمية',
    icon: 'BookOpen',
    color: '#6366F1',
    order: 7,
    isActive: true,
    templateFields: {
      hasVariants: false,
      productAttributes: [
        { key: 'author', label: 'Author', labelAr: 'المؤلف', type: 'text', required: true },
        { key: 'publisher', label: 'Publisher', labelAr: 'الناشر', type: 'text', required: false },
        { key: 'language', label: 'Language', labelAr: 'اللغة', type: 'select', options: ['العربية', 'الإنجليزية', 'الفرنسية', 'ثنائي اللغة'], required: true },
        { key: 'pages', label: 'Number of Pages', labelAr: 'عدد الصفحات', type: 'number', required: false },
        { key: 'isbn', label: 'ISBN', labelAr: 'الرقم الدولي', type: 'text', required: false },
        { key: 'deliveryMethod', label: 'Delivery Method', labelAr: 'طريقة التوصيل', type: 'select', options: ['شحن فقط', 'إلكتروني فقط', 'شحن وإلكتروني'], required: true },
        { key: 'format', label: 'Format', labelAr: 'الصيغة', type: 'select', options: ['غلاف ورقي', 'غلاف فاخر', 'كتاب إلكتروني', 'كتاب صوتي'], required: true },
      ],
    },
  },
  {
    id: 'cat_automotive',
    name: 'Automotive',
    nameAr: 'السيارات',
    slug: 'automotive',
    description: 'Cars, parts, and accessories',
    descriptionAr: 'السيارات والقطع والإكسسوارات',
    icon: 'Car',
    color: '#64748B',
    order: 8,
    isActive: true,
    templateFields: {
      hasVariants: false,
      productAttributes: [
        { key: 'carBrand', label: 'Car Brand', labelAr: 'ماركة السيارة', type: 'select', options: ['تويوتا', 'هوندا', 'نيسان', 'هيونداي', 'كيا', 'فورد', 'شيفروليه', 'مرسيدس', 'BMW', 'عام'], required: true },
        { key: 'yearRange', label: 'Year Range', labelAr: 'سنوات الصنع', type: 'text', placeholder: 'مثال: 2015-2023', required: false },
        { key: 'partType', label: 'Part Type', labelAr: 'نوع القطعة', type: 'select', options: ['محرك', 'فرامل', 'تعليق', 'كهرباء', 'داخلية', 'خارجية', 'إكسسوارات'], required: true },
        { key: 'condition', label: 'Condition', labelAr: 'الحالة', type: 'select', options: ['جديد أصلي', 'جديد بديل', 'مستعمل ممتاز', 'مستعمل جيد'], required: true },
        { key: 'warranty', label: 'Warranty', labelAr: 'الضمان', type: 'select', options: ['بدون ضمان', '3 أشهر', '6 أشهر', 'سنة'], required: true },
      ],
    },
  },
  {
    id: 'cat_kids',
    name: 'Kids & Baby',
    nameAr: 'الأطفال والرضع',
    slug: 'kids-baby',
    description: 'Toys, baby products, and children clothing',
    descriptionAr: 'الألعاب ومنتجات الأطفال وملابس الأطفال',
    icon: 'Baby',
    color: '#F472B6',
    order: 9,
    isActive: true,
    templateFields: {
      hasVariants: true,
      variantAttributes: [
        { key: 'size', label: 'Size', labelAr: 'المقاس', options: ['0-3 شهور', '3-6 شهور', '6-12 شهور', '1-2 سنة', '2-3 سنوات', '3-4 سنوات', '4-6 سنوات', '6-8 سنوات'] },
        { key: 'color', label: 'Color', labelAr: 'اللون', options: ['وردي', 'أزرق', 'أبيض', 'أصفر', 'أخضر', 'متعدد'] },
      ],
      productAttributes: [
        { key: 'ageRange', label: 'Age Range', labelAr: 'الفئة العمرية', type: 'select', options: ['حديثي الولادة', '0-6 شهور', '6-12 شهور', '1-3 سنوات', '3-6 سنوات', '6-12 سنة'], required: true },
        { key: 'gender', label: 'Gender', labelAr: 'الجنس', type: 'select', options: ['بنات', 'أولاد', 'للجنسين'], required: true },
        { key: 'safetyRating', label: 'Safety Rating', labelAr: 'تصنيف الأمان', type: 'select', options: ['معتمد دولياً', 'معتمد محلياً', 'قيد المراجعة'], required: false },
        { key: 'material', label: 'Material', labelAr: 'الخامة', type: 'select', options: ['قطن عضوي', 'قطن', 'بوليستر', 'بلاستيك آمن', 'خشب'], required: true },
      ],
    },
  },
  {
    id: 'cat_services',
    name: 'Services',
    nameAr: 'الخدمات',
    slug: 'services',
    description: 'Various services and solutions',
    descriptionAr: 'خدمات وحلول متنوعة',
    icon: 'Wrench',
    color: '#0EA5E9',
    order: 10,
    isActive: true,
    templateFields: {
      hasVariants: false,
      productAttributes: [
        { key: 'serviceType', label: 'Service Type', labelAr: 'نوع الخدمة', type: 'select', options: ['صيانة', 'تركيب', 'استشارة', 'تدريب', 'تصميم', 'برمجة', 'أخرى'], required: true },
        { key: 'duration', label: 'Duration', labelAr: 'المدة', type: 'text', placeholder: 'مثال: ساعة واحدة', required: true },
        { key: 'deliveryMethod', label: 'Delivery Method', labelAr: 'طريقة التقديم', type: 'select', options: ['حضوري', 'عن بعد', 'حضوري وعن بعد'], required: true },
        { key: 'availability', label: 'Availability', labelAr: 'التوفر', type: 'multiselect', options: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'], required: false },
      ],
    },
  },
  {
    id: 'cat_other',
    name: 'Other',
    nameAr: 'أخرى',
    slug: 'other',
    description: 'Other products and categories',
    descriptionAr: 'منتجات وتصنيفات أخرى',
    icon: 'MoreHorizontal',
    color: '#94A3B8',
    order: 99,
    isActive: true,
    templateFields: {
      hasVariants: false,
      productAttributes: [
        { key: 'customField1', label: 'Custom Field 1', labelAr: 'حقل مخصص 1', type: 'text', required: false },
        { key: 'customField2', label: 'Custom Field 2', labelAr: 'حقل مخصص 2', type: 'text', required: false },
      ],
    },
  },
];

async function main() {
  console.log('🌱 Seeding store categories with templateFields...');

  for (const category of storeCategories) {
    await prisma.store_categories.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        nameAr: category.nameAr,
        slug: category.slug,
        description: category.description,
        descriptionAr: category.descriptionAr,
        icon: category.icon,
        color: category.color,
        order: category.order,
        isActive: category.isActive,
        templateFields: category.templateFields,
        updatedAt: new Date(),
      },
      create: {
        id: category.id,
        name: category.name,
        nameAr: category.nameAr,
        slug: category.slug,
        description: category.description,
        descriptionAr: category.descriptionAr,
        icon: category.icon,
        color: category.color,
        order: category.order,
        isActive: category.isActive,
        templateFields: category.templateFields,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log(`  ✓ ${category.nameAr} (${category.name})`);
  }

  console.log('\n✅ Seeding completed with dynamic product attributes!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

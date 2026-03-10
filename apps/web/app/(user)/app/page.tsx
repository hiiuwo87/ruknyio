'use client';

import {
  StatsCard,
  OverviewStats,
  RecentOrders,
  TopProductsTable,
  ActivityBarChart,
  TasksList,
} from '@/components/(app)/dashboard';

/* ------------------------------------------------------------------ */
/*  Demo / mock data – استبدلها لاحقاً ببيانات حقيقية من الـ API       */
/* ------------------------------------------------------------------ */

const statsRow1 = [
  { title: 'المشاهدات', value: '0', change: '+0%', trend: 'up' as const, highlight: true },
  { title: 'الطلبات', value: '0', change: '+0%', trend: 'up' as const },
  { title: 'المنتجات', value: '0', change: '+0%', trend: 'up' as const },
  { title: 'الإيرادات', value: '0', change: '+12.5%', trend: 'up' as const },
];

const statsRow2 = [
  { title: 'النماذج', value: '0', change: '+0%', trend: 'up' as const, highlight: true },
  { title: 'الفعاليات', value: '0', change: '+0%', trend: 'up' as const },
  { title: 'المكتملة', value: '0', change: '0%', trend: 'up' as const },
  { title: 'نفاد المخزون', value: '0', change: 'جيد', trend: 'up' as const },
];

const overviewStatsData = [
  { label: 'النقرات', value: 0, change: 0 },
  { label: 'الطلبات', value: 0, change: 0 },
  { label: 'إجابات النماذج', value: 0, change: 0, highlight: true },
  { label: 'المنتجات النشطة', value: 0, change: 0 },
];

/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const formatCurrency = (amount: number) =>
    `${amount.toLocaleString('ar-en')} IQD`;

  return (
      <div className="space-y-4">
        {/* ── الصف الأول: بطاقات الإحصائيات ── */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {statsRow1.map((s) => (
            <StatsCard key={s.title} {...s} />
          ))}
        </div>

        {/* ── الصف الثاني: بطاقات إضافية ── */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {statsRow2.map((s) => (
            <StatsCard key={s.title} {...s} />
          ))}
        </div>

        {/* ── نظرة عامة + نشاط الأسبوع ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <OverviewStats
            title="نظرة عامة"
            subtitle="إحصائياتك. اختر فترة وتابع نشاطك"
            stats={overviewStatsData}
          />
          <ActivityBarChart
            title="كل الوقت"
            totalValue="0K IQD"
            badge={{ value: '0', trend: 'up' }}
          />
        </div>

        {/* ── آخر الطلبات + المنتجات الأكثر مبيعاً ── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <RecentOrders orders={[]} formatCurrency={formatCurrency} />
          <TopProductsTable formatCurrency={formatCurrency} />
        </div>

        {/* ── آخر النشاطات ── */}
        <TasksList tasks={[]} />
    </div>
  );
}
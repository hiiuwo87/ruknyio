/**
 * 📊 Dashboard Components
 * 
 * Components for the main dashboard page:
 * - StatsCard
 * - RecentOrders
 * - DashboardHeader
 * - RevenueChart
 * - TotalSalesChart
 * - TopProductsTable
 * - OverviewStats (NEW)
 * - ActivityBarChart (NEW)
 * - TasksList (NEW)
 */

export { StatsCard, StatsCardSkeleton } from './stats-card';
export { RecentOrders, RecentOrdersSkeleton } from './recent-orders';
export { DashboardHeader, DashboardHeaderSkeleton } from './dashboard-header';
export { RevenueChart, RevenueChartSkeleton } from './revenue-chart';
export type { RevenueChartData, ChartDataPoint } from './revenue-chart';
export { TotalSalesChart, TotalSalesChartSkeleton } from './total-sales-chart';
export { TopProductsTable, TopProductsTableSkeleton } from './top-products-table';

// New Components - Modern Design
export { OverviewStats, OverviewStatsSkeleton } from './overview-stats';
export { ActivityBarChart, ActivityBarChartSkeleton } from './activity-bar-chart';
export { TasksList, TasksListSkeleton } from './tasks-list';

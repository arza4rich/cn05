import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { id } from 'date-fns/locale';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  Truck, 
  DollarSign, 
  ShoppingCart, 
  CreditCard 
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';

// Types for financial data
interface MonthlyFinancials {
  revenue: number;
  shippingFees: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

interface ChartData {
  name: string;
  revenue: number;
  shippingFees: number;
  grossProfit: number;
  netProfit: number;
}

const FinancialDashboard = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [financials, setFinancials] = useState<MonthlyFinancials>({
    revenue: 0,
    shippingFees: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);

  // Format the current month for display
  const formattedMonth = format(currentDate, 'MMMM yyyy', { locale: id });
  
  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentDate(prevDate => subMonths(prevDate, 1));
  };
  
  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentDate(prevDate => addMonths(prevDate, 1));
  };

  // Fetch financial data for the current month
  useEffect(() => {
    const fetchMonthlyData = async () => {
      setIsLoading(true);
      
      try {
        // Calculate start and end of the month
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        
        // Fetch orders for the current month
        const ordersRef = collection(db, 'orders');
        const q = query(
          ordersRef,
          where('created_at', '>=', monthStart.toISOString()),
          where('created_at', '<=', monthEnd.toISOString())
        );
        
        const snapshot = await getDocs(q);
        
        // Calculate financials from orders
        let totalRevenue = 0;
        let totalShippingFees = 0;
        
        snapshot.forEach(doc => {
          const order = doc.data();
          totalRevenue += order.total_price || 0;
          totalShippingFees += order.shipping_fee || 0;
        });
        
        // Estimate product cost (50% of revenue excluding shipping)
        const productCost = (totalRevenue - totalShippingFees) * 0.5;
        
        // Calculate gross profit
        const grossProfit = totalRevenue - productCost;
        
        // Estimate monthly expenses (fixed value for demo)
        const expenses = 50000; // ¥50,000 fixed expenses
        
        // Calculate net profit
        const netProfit = grossProfit - expenses;
        
        setFinancials({
          revenue: totalRevenue,
          shippingFees: totalShippingFees,
          grossProfit: grossProfit,
          expenses: expenses,
          netProfit: netProfit
        });
        
        // Fetch data for the chart (last 6 months)
        await fetchChartData();
      } catch (error) {
        console.error('Error fetching financial data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMonthlyData();
  }, [currentDate]);
  
  // Fetch data for the chart (last 6 months)
  const fetchChartData = async () => {
    try {
      const chartData: ChartData[] = [];
      
      // Generate data for the last 6 months
      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(currentDate, i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const monthName = format(monthDate, 'MMM', { locale: id });
        
        // Fetch orders for this month
        const ordersRef = collection(db, 'orders');
        const q = query(
          ordersRef,
          where('created_at', '>=', monthStart.toISOString()),
          where('created_at', '<=', monthEnd.toISOString())
        );
        
        const snapshot = await getDocs(q);
        
        // Calculate financials
        let revenue = 0;
        let shippingFees = 0;
        
        snapshot.forEach(doc => {
          const order = doc.data();
          revenue += order.total_price || 0;
          shippingFees += order.shipping_fee || 0;
        });
        
        // Estimate product cost and profits
        const productCost = (revenue - shippingFees) * 0.5;
        const grossProfit = revenue - productCost;
        const expenses = 50000; // Fixed expenses
        const netProfit = grossProfit - expenses;
        
        chartData.push({
          name: monthName,
          revenue: revenue,
          shippingFees: shippingFees,
          grossProfit: grossProfit,
          netProfit: netProfit
        });
      }
      
      setChartData(chartData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
    }
  };

  // Format currency as Japanese Yen
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Laporan Keuangan Bulanan</h1>
            <p className="text-gray-600">Analisis keuangan dan performa bisnis</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToPreviousMonth}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="px-4 py-2 bg-white rounded-lg border border-gray-200 font-medium">
              {formattedMonth}
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goToNextMonth}
              disabled={format(currentDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM')}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Omzet Bulanan
              </CardTitle>
              <div className="p-2 rounded-full bg-blue-100">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : formatCurrency(financials.revenue)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Total penjualan bulan {format(currentDate, 'MMMM', { locale: id })}
              </p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Biaya Ongkir
              </CardTitle>
              <div className="p-2 rounded-full bg-green-100">
                <Truck className="w-4 h-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : formatCurrency(financials.shippingFees)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Total biaya pengiriman bulan ini
              </p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Laba Kotor
              </CardTitle>
              <div className="p-2 rounded-full bg-purple-100">
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : formatCurrency(financials.grossProfit)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Omzet - Modal Produk
              </p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Pengeluaran
              </CardTitle>
              <div className="p-2 rounded-full bg-red-100">
                <CreditCard className="w-4 h-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : formatCurrency(financials.expenses)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Biaya operasional tetap
              </p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Laba Bersih
              </CardTitle>
              <div className="p-2 rounded-full bg-yellow-100">
                <DollarSign className="w-4 h-4 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? '...' : formatCurrency(financials.netProfit)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Laba Kotor - Pengeluaran
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Tren Pendapatan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Bulan: ${label}`}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      name="Omzet" 
                      stroke="#3b82f6" 
                      activeDot={{ r: 8 }}
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="netProfit" 
                      name="Laba Bersih" 
                      stroke="#16a34a" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Analisis Komponen Keuangan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Bulan: ${label}`}
                    />
                    <Legend />
                    <Bar 
                      dataKey="revenue" 
                      name="Omzet" 
                      fill="#3b82f6" 
                    />
                    <Bar 
                      dataKey="shippingFees" 
                      name="Ongkir" 
                      fill="#10b981" 
                    />
                    <Bar 
                      dataKey="grossProfit" 
                      name="Laba Kotor" 
                      fill="#8b5cf6" 
                    />
                    <Bar 
                      dataKey="netProfit" 
                      name="Laba Bersih" 
                      fill="#f59e0b" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Financial Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Analisis Keuangan Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Komponen</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Nilai</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">% dari Omzet</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-medium">Omzet (Revenue)</td>
                    <td className="py-3 px-4 text-right font-bold">
                      {isLoading ? '...' : formatCurrency(financials.revenue)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isLoading ? '...' : '100%'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      Total penjualan produk
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-medium">Biaya Produk (COGS)</td>
                    <td className="py-3 px-4 text-right font-bold text-red-600">
                      {isLoading ? '...' : formatCurrency((financials.revenue - financials.shippingFees) * 0.5)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isLoading ? '...' : `${Math.round(((financials.revenue - financials.shippingFees) * 0.5 / financials.revenue) * 100)}%`}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      Estimasi modal produk (50% dari penjualan)
                    </td>
                  </tr>
                  <tr className="border-b bg-gray-50">
                    <td className="py-3 px-4 font-medium">Laba Kotor (Gross Profit)</td>
                    <td className="py-3 px-4 text-right font-bold text-green-600">
                      {isLoading ? '...' : formatCurrency(financials.grossProfit)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isLoading ? '...' : `${Math.round((financials.grossProfit / financials.revenue) * 100)}%`}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      Omzet - Biaya Produk
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-medium">Biaya Ongkir</td>
                    <td className="py-3 px-4 text-right font-bold text-red-600">
                      {isLoading ? '...' : formatCurrency(financials.shippingFees)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isLoading ? '...' : `${Math.round((financials.shippingFees / financials.revenue) * 100)}%`}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      Total biaya pengiriman
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3 px-4 font-medium">Biaya Operasional</td>
                    <td className="py-3 px-4 text-right font-bold text-red-600">
                      {isLoading ? '...' : formatCurrency(financials.expenses)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isLoading ? '...' : `${Math.round((financials.expenses / financials.revenue) * 100)}%`}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      Biaya tetap bulanan (gaji, sewa, dll)
                    </td>
                  </tr>
                  <tr className="border-b bg-gray-50">
                    <td className="py-3 px-4 font-medium">Laba Bersih (Net Profit)</td>
                    <td className="py-3 px-4 text-right font-bold text-green-600">
                      {isLoading ? '...' : formatCurrency(financials.netProfit)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isLoading ? '...' : `${Math.round((financials.netProfit / financials.revenue) * 100)}%`}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      Laba Kotor - Ongkir - Biaya Operasional
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default FinancialDashboard;
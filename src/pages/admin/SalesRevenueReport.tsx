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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  ShoppingCart,
  Calendar,
  Search,
  RefreshCw
} from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Input } from '@/components/ui/input';

// Types for sales data
interface MonthlySales {
  totalOrders: number;
  totalRevenue: number;
}

interface ChartData {
  name: string;
  orders: number;
  revenue: number;
}

// Type for transaction data
interface Transaction {
  id: string;
  buyerName: string;
  shippingFee: number;
  totalPayment: number;
  transactionDate: string;
}

const SalesRevenueReport = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [salesData, setSalesData] = useState<MonthlySales>({
    totalOrders: 0,
    totalRevenue: 0
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

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

  // Fetch sales data for the current month
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
        
        // Calculate sales data from orders
        let totalOrders = 0;
        let totalRevenue = 0;
        
        snapshot.forEach(doc => {
          totalOrders++;
          const order = doc.data();
          totalRevenue += order.total_price || 0;
        });
        
        setSalesData({
          totalOrders,
          totalRevenue
        });
        
        // Fetch data for the chart (last 6 months)
        await fetchChartData();
      } catch (error) {
        console.error('Error fetching sales data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMonthlyData();
  }, [currentDate]);
  
  // Fetch transactions data
  useEffect(() => {
    setIsLoadingTransactions(true);
    
    try {
      // Reference to orders collection
      const ordersRef = collection(db, 'orders');
      
      // Create query for recent orders
      const q = query(
        ordersRef,
        orderBy('created_at', 'desc'),
        limit(100)
      );
      
      // Set up real-time listener
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const transactionData: Transaction[] = [];
        
        snapshot.forEach(doc => {
          const order = doc.data();
          
          transactionData.push({
            id: doc.id,
            buyerName: order.customer_info?.name || 'Unknown',
            shippingFee: order.shipping_fee || 0,
            totalPayment: order.total_price || 0,
            transactionDate: order.created_at || new Date().toISOString()
          });
        });
        
        setTransactions(transactionData);
        
        setIsLoadingTransactions(false);
      }, (error) => {
        console.error('Error fetching transactions:', error);
        setTransactions([]);
        setIsLoadingTransactions(false);
      });
      
      // Clean up listener on unmount
      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up transactions listener:', error);
      setTransactions([]);
      setIsLoadingTransactions(false);
    }
  }, []);
  
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
        
        // Calculate sales data
        let orders = 0;
        let revenue = 0;
        
        snapshot.forEach(doc => {
          orders++;
          const order = doc.data();
          revenue += order.total_price || 0;
        });
        
        chartData.push({
          name: monthName,
          orders: orders,
          revenue: revenue
        });
      }
      
      setChartData(chartData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setChartData([]);
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

  // Calculate average order value
  const averageOrderValue = salesData.totalOrders > 0 
    ? salesData.totalRevenue / salesData.totalOrders 
    : 0;

  // Filter transactions based on search term
  const filteredTransactions = transactions.filter(transaction => 
    transaction.buyerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transaction.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Laporan Penjualan & Omzet</h1>
            <p className="text-gray-600">Analisis penjualan dan pendapatan bisnis</p>
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

        {/* Tabs for Overview and Transactions */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Ringkasan</TabsTrigger>
            <TabsTrigger value="transactions">Transaksi</TabsTrigger>
          </TabsList>
          
          {/* Overview Tab Content */}
          <TabsContent value="overview" className="space-y-6">
            {/* Sales Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Total Pesanan
                  </CardTitle>
                  <div className="p-2 rounded-full bg-blue-100">
                    <ShoppingCart className="w-4 h-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? '...' : salesData.totalOrders}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Jumlah pesanan bulan {format(currentDate, 'MMMM', { locale: id })}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Total Omzet
                  </CardTitle>
                  <div className="p-2 rounded-full bg-green-100">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? '...' : formatCurrency(salesData.totalRevenue)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Pendapatan bulan {format(currentDate, 'MMMM', { locale: id })}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Rata-rata Pesanan
                  </CardTitle>
                  <div className="p-2 rounded-full bg-purple-100">
                    <Calendar className="w-4 h-4 text-purple-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? '...' : formatCurrency(averageOrderValue)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Nilai rata-rata per pesanan
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle>Tren Penjualan Bulanan</CardTitle>
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
                          formatter={(value: number) => [value, 'Jumlah Pesanan']}
                          labelFormatter={(label) => `Bulan: ${label}`}
                        />
                        <Legend />
                        <Bar 
                          dataKey="orders" 
                          name="Jumlah Pesanan" 
                          fill="#3b82f6" 
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Tren Omzet Bulanan</CardTitle>
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
                          formatter={(value: number) => [formatCurrency(value), 'Omzet']}
                          labelFormatter={(label) => `Bulan: ${label}`}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="revenue" 
                          name="Omzet" 
                          stroke="#16a34a" 
                          activeDot={{ r: 8 }}
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Sales Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Analisis Penjualan Detail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Bulan</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Jumlah Pesanan</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Total Omzet</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Rata-rata Pesanan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium">
                            {item.name} {format(subMonths(currentDate, 5 - index), 'yyyy')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {item.orders}
                          </td>
                          <td className="py-3 px-4 text-right font-medium">
                            {formatCurrency(item.revenue)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatCurrency(item.orders > 0 ? item.revenue / item.orders : 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Transactions Tab Content */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
                  <CardTitle>Daftar Transaksi</CardTitle>
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Cari transaksi..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-full md:w-64"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSearchTerm('')}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reset
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingTransactions ? (
                  <div className="flex justify-center items-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID Transaksi</TableHead>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Nama Pembeli</TableHead>
                            {searchTerm ? 'Tidak ada transaksi yang sesuai dengan pencarian' : 'Belum ada data transaksi'}
                          <TableHead className="text-right">Total Pembayaran</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                              Tidak ada transaksi yang ditemukan
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredTransactions.map((transaction) => (
                            <TableRow key={transaction.id} className="hover:bg-gray-50">
                              <TableCell className="font-medium">
                                {transaction.id.substring(0, 8)}...
                              </TableCell>
                              <TableCell>
                                {format(new Date(transaction.transactionDate), 'dd MMM yyyy, HH:mm', { locale: id })}
                              </TableCell>
                              <TableCell>{transaction.buyerName}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(transaction.shippingFee)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(transaction.totalPayment)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default SalesRevenueReport;
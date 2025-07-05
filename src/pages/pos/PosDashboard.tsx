import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ShoppingCart, 
  TrendingUp, 
  Users, 
  Package, 
  Clock,
  Calendar
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const PosDashboard = () => {
  const [todaySales, setTodaySales] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [dailySalesData, setDailySalesData] = useState<any[]>([]);
  const [categorySalesData, setCategorySalesData] = useState<any[]>([]);
  
  // Colors for pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      
      try {
        // Get today's date range
        const today = new Date();
        const startOfToday = startOfDay(today).toISOString();
        const endOfToday = endOfDay(today).toISOString();
        
        // Fetch today's orders
        const ordersRef = collection(db, 'orders');
        const todayOrdersQuery = query(
          ordersRef,
          where('created_at', '>=', startOfToday),
          where('created_at', '<=', endOfToday)
        );
        
        const todayOrdersSnapshot = await getDocs(todayOrdersQuery);
        
        let todayOrdersCount = 0;
        let todaySalesTotal = 0;
        
        todayOrdersSnapshot.forEach(doc => {
          todayOrdersCount++;
          const orderData = doc.data();
          todaySalesTotal += orderData.total_price || 0;
        });
        
        setTodayOrders(todayOrdersCount);
        setTodaySales(todaySalesTotal);
        
        // Fetch total products
        const productsRef = collection(db, 'products');
        const productsSnapshot = await getDocs(productsRef);
        setTotalProducts(productsSnapshot.size);
        
        // Fetch total customers (unique user_ids from orders)
        const allOrdersQuery = query(ordersRef);
        const allOrdersSnapshot = await getDocs(allOrdersQuery);
        
        const uniqueCustomers = new Set();
        allOrdersSnapshot.forEach(doc => {
          const orderData = doc.data();
          if (orderData.user_id) {
            uniqueCustomers.add(orderData.user_id);
          } else if (orderData.customer_info?.email) {
            uniqueCustomers.add(orderData.customer_info.email);
          }
        });
        
        setTotalCustomers(uniqueCustomers.size);
        
        // Fetch daily sales data for the last 7 days
        const dailySales = [];
        
        for (let i = 6; i >= 0; i--) {
          const date = subDays(today, i);
          const dayStart = startOfDay(date).toISOString();
          const dayEnd = endOfDay(date).toISOString();
          
          const dayOrdersQuery = query(
            ordersRef,
            where('created_at', '>=', dayStart),
            where('created_at', '<=', dayEnd)
          );
          
          const dayOrdersSnapshot = await getDocs(dayOrdersQuery);
          
          let dayTotal = 0;
          dayOrdersSnapshot.forEach(doc => {
            const orderData = doc.data();
            dayTotal += orderData.total_price || 0;
          });
          
          dailySales.push({
            name: format(date, 'EEE', { locale: id }),
            sales: dayTotal
          });
        }
        
        setDailySalesData(dailySales);
        
        // Fetch sales by category
        const categorySales = new Map();
        
        allOrdersSnapshot.forEach(doc => {
          const orderData = doc.data();
          
          if (orderData.items && Array.isArray(orderData.items)) {
            orderData.items.forEach((item: any) => {
              if (item.category) {
                const category = item.category;
                const amount = (item.price * item.quantity) || 0;
                
                if (categorySales.has(category)) {
                  categorySales.set(category, categorySales.get(category) + amount);
                } else {
                  categorySales.set(category, amount);
                }
              }
            });
          }
        });
        
        const categoryData = Array.from(categorySales.entries()).map(([name, value]) => ({
          name,
          value
        }));
        
        setCategorySalesData(categoryData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);
  
  // Format currency as Japanese Yen
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      minimumFractionDigits: 0
    }).format(amount);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="text-sm text-gray-500">
          <Clock className="inline-block w-4 h-4 mr-1" />
          {format(new Date(), 'EEEE, dd MMMM yyyy', { locale: id })}
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Penjualan Hari Ini
            </CardTitle>
            <div className="p-2 rounded-full bg-green-100">
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : formatCurrency(todaySales)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Total penjualan hari ini
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Pesanan Hari Ini
            </CardTitle>
            <div className="p-2 rounded-full bg-blue-100">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : todayOrders}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Jumlah transaksi hari ini
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Produk
            </CardTitle>
            <div className="p-2 rounded-full bg-purple-100">
              <Package className="w-4 h-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : totalProducts}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Jumlah produk dalam inventori
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Pelanggan
            </CardTitle>
            <div className="p-2 rounded-full bg-orange-100">
              <Users className="w-4 h-4 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : totalCustomers}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Jumlah pelanggan terdaftar
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2" />
              Penjualan 7 Hari Terakhir
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailySalesData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Penjualan']}
                    labelFormatter={(label) => `Hari: ${label}`}
                  />
                  <Legend />
                  <Bar 
                    dataKey="sales" 
                    name="Penjualan" 
                    fill="#3b82f6" 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Penjualan per Kategori
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySalesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {categorySalesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Penjualan']}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PosDashboard;
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/useFirebaseAuth';
import { LanguageProvider } from '@/hooks/useLanguage';
import OfflineNotice from '@/components/OfflineNotice';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import Index from '@/pages/Index';
import Products from '@/pages/Products';
import ProductDetail from '@/pages/ProductDetail';
import Cart from '@/pages/Cart';
import Auth from '@/pages/Auth';
import Orders from '@/pages/Orders';
import Referral from '@/pages/Referral';
import HowToBuy from '@/pages/HowToBuy';
import NotFound from '@/pages/NotFound';
import CategoryPage from '@/pages/CategoryPage';

// Admin pages
import Admin from '@/pages/Admin';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import EnhancedAdminDashboard from '@/pages/admin/EnhancedAdminDashboard';
import ProductsList from '@/pages/admin/ProductsList';
import SalesRevenueReport from '@/pages/admin/SalesRevenueReport';
import AddProduct from '@/pages/admin/AddProduct';
import EditProduct from '@/pages/admin/EditProduct';
import OrdersHistory from '@/pages/admin/OrdersHistory';
import OrderConfirmation from '@/pages/admin/OrderConfirmation';
import PaymentVerification from '@/pages/admin/PaymentVerification';
import UserManagement from '@/pages/admin/UserManagement';
import AdminLogs from '@/pages/admin/AdminLogs';
import ImportExport from '@/pages/admin/ImportExport';
import RecycleBin from '@/pages/admin/RecycleBin';
import ShippingRates from '@/pages/admin/ShippingRates';
import AffiliateManagement from '@/pages/admin/AffiliateManagement';

import './App.css';
import { useEffect } from 'react';
import { processReferralCode } from '@/utils/referralUtils';

// POS Pages
import PosLayout from '@/pages/pos/PosLayout';
import PosDashboard from '@/pages/pos/PosDashboard';
import PosSales from '@/pages/pos/PosSales';
import PosProducts from '@/pages/pos/PosProducts';
import PosTransactions from '@/pages/pos/PosTransactions';
import PosReceipts from '@/pages/pos/PosReceipts';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  // Process referral code when app loads
  useEffect(() => {
    processReferralCode();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <Router>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/referral" element={<Referral />} />
              <Route path="/how-to-buy" element={<HowToBuy />} />
              
              {/* Category routes */}
              <Route path="/kategori/makanan-ringan" element={<CategoryPage category="Makanan Ringan" />} />
              <Route path="/kategori/bumbu-dapur" element={<CategoryPage category="Bumbu Dapur" />} />
              <Route path="/kategori/makanan-siap-saji" element={<CategoryPage category="Makanan Siap Saji" />} />
              <Route path="/kategori/sayur-bahan-segar" element={<CategoryPage category="Sayur & Bahan Segar" />} />
              
              {/* Admin routes */}
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/enhanced" element={<EnhancedAdminDashboard />} />
              <Route path="/admin/sales-report" element={<SalesRevenueReport />} />
              <Route path="/admin/products" element={<ProductsList />} />
              <Route path="/admin/add-product" element={<AddProduct />} />
              <Route path="/admin/edit-product/:id" element={<EditProduct />} />
              <Route path="/admin/products/edit/:id" element={<EditProduct />} />
              <Route path="/admin/orders-history" element={<OrdersHistory />} />
              <Route path="/admin/order-confirmation" element={<OrderConfirmation />} />
              <Route path="/admin/payment-verification" element={<PaymentVerification />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/logs" element={<AdminLogs />} />
              <Route path="/admin/import-export" element={<ImportExport />} />
              <Route path="/admin/recycle-bin" element={<RecycleBin />} />
              <Route path="/admin/shipping-rates" element={<ShippingRates />} />
              <Route path="/admin/affiliate" element={<AffiliateManagement />} />
              
              {/* POS routes */}
              <Route path="/pos" element={<PosLayout />}>
                <Route path="/pos/dashboard" element={<PosDashboard />} />
                <Route path="/pos/sales" element={<PosSales />} />
                <Route path="/pos/products" element={<PosProducts />} />
                <Route path="/pos/transactions" element={<PosTransactions />} />
                <Route path="/pos/receipts" element={<PosReceipts />} />
                <Route index element={<PosDashboard />} />
              </Route>
              
              {/* 404 route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
            <OfflineNotice />
            <PWAInstallPrompt />
          </Router>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
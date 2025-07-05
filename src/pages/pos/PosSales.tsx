import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Printer, CheckCircle, ScanBarcode as BarcodeScan } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/hooks/useFirebaseAuth';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useReactToPrint } from 'react-to-print';

// Types
interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  image_url?: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

interface Transaction {
  id: string;
  items: CartItem[];
  total: number;
  cashierName: string;
  timestamp: string;
  paymentMethod: string;
  customerName?: string;
}

const PosSales = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [cashAmount, setCashAmount] = useState('');
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [currentTransaction, setCurrentTransaction] = useState<Transaction | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  
  const { user } = useAuth();
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const productsRef = collection(db, 'products');
        const snapshot = await getDocs(productsRef);
        
        const productsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        
        setProducts(productsData);
        setFilteredProducts(productsData);
      } catch (error) {
        console.error('Error fetching products:', error);
        toast({
          title: 'Error',
          description: 'Gagal memuat produk',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProducts();
  }, []);
  
  // Fetch recent transactions
  useEffect(() => {
    const fetchRecentTransactions = async () => {
      try {
        const transactionsRef = collection(db, 'pos_transactions');
        const snapshot = await getDocs(transactionsRef);
        
        const transactionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Transaction[];
        
        // Sort by timestamp descending
        transactionsData.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        setRecentTransactions(transactionsData.slice(0, 5));
      } catch (error) {
        console.error('Error fetching recent transactions:', error);
      }
    };
    
    fetchRecentTransactions();
  }, []);
  
  // Filter products based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchTerm, products]);
  
  // Add product to cart
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast({
        title: 'Stok Habis',
        description: `${product.name} sedang tidak tersedia`,
        variant: 'destructive'
      });
      return;
    }
    
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      
      if (existingItem) {
        // Check if adding one more would exceed stock
        if (existingItem.quantity + 1 > product.stock) {
          toast({
            title: 'Stok Terbatas',
            description: `Hanya tersedia ${product.stock} ${product.name}`,
            variant: 'destructive'
          });
          return prevCart;
        }
        
        return prevCart.map(item => 
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      } else {
        return [...prevCart, { 
          id: product.id, 
          name: product.name, 
          price: product.price,
          quantity: 1,
          category: product.category
        }];
      }
    });
  };
  
  // Update cart item quantity
  const updateQuantity = (id: string, change: number) => {
    setCart(prevCart => {
      const updatedCart = prevCart.map(item => {
        if (item.id === id) {
          // Find the product to check stock
          const product = products.find(p => p.id === id);
          const newQuantity = item.quantity + change;
          
          // Ensure quantity doesn't go below 1 or above stock
          if (newQuantity < 1) {
            return item;
          }
          
          if (product && newQuantity > product.stock) {
            toast({
              title: 'Stok Terbatas',
              description: `Hanya tersedia ${product.stock} ${product.name}`,
              variant: 'destructive'
            });
            return item;
          }
          
          return { ...item, quantity: newQuantity };
        }
        return item;
      });
      
      return updatedCart;
    });
  };
  
  // Remove item from cart
  const removeFromCart = (id: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== id));
  };
  
  // Calculate cart total
  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  
  // Calculate change amount
  const changeAmount = Number(cashAmount) - cartTotal;
  
  // Handle checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({
        title: 'Keranjang Kosong',
        description: 'Tambahkan produk ke keranjang terlebih dahulu',
        variant: 'destructive'
      });
      return;
    }
    
    if (paymentMethod === 'Tunai' && (Number(cashAmount) < cartTotal)) {
      toast({
        title: 'Pembayaran Kurang',
        description: 'Jumlah pembayaran kurang dari total belanja',
        variant: 'destructive'
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Create transaction in Firestore
      const transactionData = {
        items: cart,
        total: cartTotal,
        cashierName: user?.displayName || user?.email?.split('@')[0] || 'Kasir',
        cashierId: user?.uid,
        timestamp: new Date().toISOString(),
        paymentMethod,
        customerName: customerName || 'Pelanggan',
        ...(paymentMethod === 'Tunai' && { 
          cashAmount: Number(cashAmount),
          changeAmount: changeAmount
        })
      };
      
      const transactionRef = await addDoc(collection(db, 'pos_transactions'), transactionData);
      
      // Update product stock
      for (const item of cart) {
        const productRef = doc(db, 'products', item.id);
        const productDoc = await getDoc(productRef);
        
        if (productDoc.exists()) {
          const currentStock = productDoc.data().stock;
          await updateDoc(productRef, {
            stock: currentStock - item.quantity,
            updated_at: new Date().toISOString()
          });
        }
      }
      
      // Set current transaction for receipt
      setCurrentTransaction({
        id: transactionRef.id,
        ...transactionData
      } as Transaction);
      
      // Show receipt
      setShowReceipt(true);
      
      // Add to recent transactions
      setRecentTransactions(prev => [{
        id: transactionRef.id,
        ...transactionData
      } as Transaction, ...prev].slice(0, 5));
      
      // Clear cart and form
      setCart([]);
      setCustomerName('');
      setCashAmount('');
      
      toast({
        title: 'Transaksi Berhasil',
        description: 'Transaksi telah berhasil disimpan',
      });
    } catch (error) {
      console.error('Error processing transaction:', error);
      toast({
        title: 'Transaksi Gagal',
        description: 'Terjadi kesalahan saat memproses transaksi',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle print receipt
  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
    documentTitle: `Receipt-${currentTransaction?.id || 'POS'}`,
    onAfterPrint: () => {
      toast({
        title: 'Struk Dicetak',
        description: 'Struk berhasil dicetak',
      });
    }
  });
  
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
        <h1 className="text-2xl font-bold text-gray-900">Penjualan</h1>
        <div className="text-sm text-gray-500">
          {format(new Date(), 'EEEE, dd MMMM yyyy HH:mm', { locale: id })}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center">
                  <Package className="w-5 h-5 mr-2" />
                  Produk
                </CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Cari produk..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-lg font-medium">Produk tidak ditemukan</p>
                  <p className="text-sm">Coba kata kunci lain atau tambahkan produk baru</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className={`bg-white border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${
                        product.stock <= 0 ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'
                      }`}
                    >
                      <div className="aspect-square bg-gray-100 rounded-md mb-2 flex items-center justify-center overflow-hidden">
                        {product.image_url ? (
                          <img 
                            src={product.image_url} 
                            alt={product.name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <h3 className="font-medium text-sm line-clamp-1">{product.name}</h3>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-primary font-bold">
                          {formatCurrency(product.price)}
                        </span>
                        <Badge variant={product.stock > 0 ? "outline" : "destructive"} className="text-xs">
                          {product.stock > 0 ? `Stok: ${product.stock}` : 'Habis'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Recent Transactions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Transaksi Terbaru
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentTransactions.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <ShoppingCart className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p>Belum ada transaksi</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Waktu</TableHead>
                        <TableHead>Pelanggan</TableHead>
                        <TableHead>Metode</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTransactions.map((transaction) => (
                        <TableRow key={transaction.id} className="cursor-pointer hover:bg-gray-50" onClick={() => {
                          setCurrentTransaction(transaction);
                          setShowReceipt(true);
                        }}>
                          <TableCell className="font-medium">
                            #{transaction.id.substring(0, 6)}
                          </TableCell>
                          <TableCell>
                            {format(new Date(transaction.timestamp), 'HH:mm', { locale: id })}
                          </TableCell>
                          <TableCell>{transaction.customerName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {transaction.paymentMethod}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(transaction.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Cart Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Keranjang
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-lg font-medium">Keranjang Kosong</p>
                  <p className="text-sm">Tambahkan produk ke keranjang</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Cart Items */}
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">{formatCurrency(item.price)} x {item.quantity}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={() => updateQuantity(item.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm">{item.quantity}</span>
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={() => updateQuantity(item.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Cart Summary */}
                  <div className="pt-4 border-t">
                    <div className="flex justify-between mb-2">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">{formatCurrency(cartTotal)}</span>
                    </div>
                    <div className="flex justify-between mb-4">
                      <span className="text-gray-600">Total</span>
                      <span className="text-lg font-bold text-primary">{formatCurrency(cartTotal)}</span>
                    </div>
                  </div>
                  
                  {/* Customer Info */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Nama Pelanggan
                      </label>
                      <Input
                        placeholder="Masukkan nama pelanggan"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">
                        Metode Pembayaran
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={paymentMethod === 'Tunai' ? 'default' : 'outline'}
                          className="justify-start"
                          onClick={() => setPaymentMethod('Tunai')}
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Tunai
                        </Button>
                        <Button
                          type="button"
                          variant={paymentMethod === 'Non-Tunai' ? 'default' : 'outline'}
                          className="justify-start"
                          onClick={() => setPaymentMethod('Non-Tunai')}
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Non-Tunai
                        </Button>
                      </div>
                    </div>
                    
                    {paymentMethod === 'Tunai' && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Jumlah Tunai
                        </label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={cashAmount}
                          onChange={(e) => setCashAmount(e.target.value)}
                        />
                        {Number(cashAmount) >= cartTotal && (
                          <div className="mt-2 p-2 bg-green-50 rounded-md text-sm">
                            <span className="font-medium">Kembalian:</span> {formatCurrency(changeAmount)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Checkout Button */}
                  <Button 
                    className="w-full"
                    disabled={isProcessing || cart.length === 0 || (paymentMethod === 'Tunai' && Number(cashAmount) < cartTotal)}
                    onClick={handleCheckout}
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Memproses...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Proses Pembayaran
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Barcode Scanner */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <BarcodeScan className="w-5 h-5 mr-2" />
                Scan Barcode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Input
                    placeholder="Scan atau masukkan kode produk"
                    className="pl-10"
                  />
                  <BarcodeScan className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                </div>
                <p className="text-xs text-gray-500 text-center">
                  Gunakan scanner barcode atau masukkan kode produk secara manual
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Receipt Modal */}
      {showReceipt && currentTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-bold">Struk Pembayaran</h3>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handlePrint}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Cetak
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowReceipt(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Receipt Content */}
            <div className="p-4">
              <div ref={receiptRef} className="bg-white p-4 font-mono text-sm">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-bold">INJAPAN POS</h2>
                  <p>Tokyo - www.injapanpos.com</p>
                  <div className="border-t border-b border-gray-300 my-2"></div>
                </div>
                
                <div className="mb-4">
                  <div className="flex justify-between">
                    <span>Tanggal</span>
                    <span>{format(new Date(currentTransaction.timestamp), 'dd/MM/yyyy', { locale: id })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu</span>
                    <span>{format(new Date(currentTransaction.timestamp), 'HH:mm:ss', { locale: id })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir</span>
                    <span>{currentTransaction.cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>No. Transaksi</span>
                    <span>#{currentTransaction.id.substring(0, 8)}</span>
                  </div>
                </div>
                
                <div className="border-t border-b border-gray-300 my-2"></div>
                
                <div className="mb-2">
                  <div className="flex justify-between font-bold">
                    <span>Item</span>
                    <div className="flex">
                      <span className="w-10 text-right">Qty</span>
                      <span className="w-20 text-right">Harga</span>
                      <span className="w-24 text-right">Subtotal</span>
                    </div>
                  </div>
                </div>
                
                {currentTransaction.items.map((item, index) => (
                  <div key={index} className="flex justify-between mb-1 text-xs">
                    <span className="truncate max-w-[150px]">{item.name}</span>
                    <div className="flex">
                      <span className="w-10 text-right">{item.quantity}</span>
                      <span className="w-20 text-right">{formatCurrency(item.price)}</span>
                      <span className="w-24 text-right">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  </div>
                ))}
                
                <div className="border-t border-gray-300 my-2"></div>
                
                <div className="mb-4">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(currentTransaction.total)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>TOTAL</span>
                    <span>{formatCurrency(currentTransaction.total)}</span>
                  </div>
                  
                  {currentTransaction.paymentMethod === 'Tunai' && (
                    <>
                      <div className="flex justify-between mt-2">
                        <span>Bayar Tunai</span>
                        <span>{formatCurrency(currentTransaction.cashAmount || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Kembalian</span>
                        <span>{formatCurrency(currentTransaction.changeAmount || 0)}</span>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="border-t border-gray-300 my-2"></div>
                
                <div className="text-center text-xs">
                  <p>Scan QR untuk struk digital</p>
                  <div className="my-2 flex justify-center">
                    {/* QR Code placeholder */}
                    <div className="w-20 h-20 border border-gray-300 flex items-center justify-center">
                      QR Code
                    </div>
                  </div>
                  <p>Catatan: Simpan struk ini sebagai bukti pembelian</p>
                  <p className="font-bold mt-2">Terima Kasih & Selamat Berbelanja!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PosSales;
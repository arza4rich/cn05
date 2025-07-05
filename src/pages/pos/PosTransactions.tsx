import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Search, 
  FileText, 
  Printer, 
  Calendar,
  Download,
  RefreshCw,
  Eye
} from 'lucide-react';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import { id } from 'date-fns/locale';
import { useReactToPrint } from 'react-to-print';
import { toast } from '@/hooks/use-toast';

// Types
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
  cashAmount?: number;
  changeAmount?: number;
}

const PosTransactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Fetch transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true);
      try {
        const transactionsRef = collection(db, 'pos_transactions');
        const q = query(transactionsRef, orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        
        const transactionsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Transaction[];
        
        setTransactions(transactionsData);
        setFilteredTransactions(transactionsData);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        toast({
          title: 'Error',
          description: 'Gagal memuat data transaksi',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTransactions();
  }, []);
  
  // Filter transactions based on search term and date filter
  useEffect(() => {
    let filtered = transactions;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(transaction => 
        transaction.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.cashierName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply date filter
    if (dateFilter !== 'all') {
      const today = new Date();
      
      if (dateFilter === 'today') {
        filtered = filtered.filter(transaction => {
          const transactionDate = parseISO(transaction.timestamp);
          return isWithinInterval(transactionDate, {
            start: startOfDay(today),
            end: endOfDay(today)
          });
        });
      } else if (dateFilter === 'yesterday') {
        const yesterday = subDays(today, 1);
        filtered = filtered.filter(transaction => {
          const transactionDate = parseISO(transaction.timestamp);
          return isWithinInterval(transactionDate, {
            start: startOfDay(yesterday),
            end: endOfDay(yesterday)
          });
        });
      } else if (dateFilter === 'week') {
        const weekAgo = subDays(today, 7);
        filtered = filtered.filter(transaction => {
          const transactionDate = parseISO(transaction.timestamp);
          return isWithinInterval(transactionDate, {
            start: startOfDay(weekAgo),
            end: endOfDay(today)
          });
        });
      } else if (dateFilter === 'month') {
        const monthAgo = subDays(today, 30);
        filtered = filtered.filter(transaction => {
          const transactionDate = parseISO(transaction.timestamp);
          return isWithinInterval(transactionDate, {
            start: startOfDay(monthAgo),
            end: endOfDay(today)
          });
        });
      }
    }
    
    setFilteredTransactions(filtered);
  }, [searchTerm, dateFilter, transactions]);
  
  // Handle print receipt
  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
    documentTitle: `Receipt-${selectedTransaction?.id || 'POS'}`,
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
  
  // View transaction details and receipt
  const viewTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowReceipt(true);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Transaksi</h1>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0">
            <CardTitle className="text-lg flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Daftar Transaksi
            </CardTitle>
            
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Cari transaksi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  variant={dateFilter === 'all' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setDateFilter('all')}
                >
                  Semua
                </Button>
                <Button 
                  variant={dateFilter === 'today' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setDateFilter('today')}
                >
                  Hari Ini
                </Button>
                <Button 
                  variant={dateFilter === 'week' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setDateFilter('week')}
                >
                  Minggu Ini
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-lg font-medium">Tidak ada transaksi</p>
              <p className="text-sm">Belum ada transaksi yang tercatat</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Transaksi</TableHead>
                    <TableHead>Tanggal & Waktu</TableHead>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Kasir</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        #{transaction.id.substring(0, 8)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(transaction.timestamp), 'dd/MM/yyyy HH:mm', { locale: id })}
                      </TableCell>
                      <TableCell>{transaction.customerName || 'Pelanggan'}</TableCell>
                      <TableCell>{transaction.cashierName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {transaction.paymentMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(transaction.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => viewTransaction(transaction)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Lihat
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Receipt Modal */}
      {showReceipt && selectedTransaction && (
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
                    <span>{format(new Date(selectedTransaction.timestamp), 'dd/MM/yyyy', { locale: id })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Waktu</span>
                    <span>{format(new Date(selectedTransaction.timestamp), 'HH:mm:ss', { locale: id })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kasir</span>
                    <span>{selectedTransaction.cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>No. Transaksi</span>
                    <span>#{selectedTransaction.id.substring(0, 8)}</span>
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
                
                {selectedTransaction.items.map((item, index) => (
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
                    <span>{formatCurrency(selectedTransaction.total)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>TOTAL</span>
                    <span>{formatCurrency(selectedTransaction.total)}</span>
                  </div>
                  
                  {selectedTransaction.paymentMethod === 'Tunai' && (
                    <>
                      <div className="flex justify-between mt-2">
                        <span>Bayar Tunai</span>
                        <span>{formatCurrency(selectedTransaction.cashAmount || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Kembalian</span>
                        <span>{formatCurrency(selectedTransaction.changeAmount || 0)}</span>
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

export default PosTransactions;
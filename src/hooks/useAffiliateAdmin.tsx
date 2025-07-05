import { useState, useEffect, createContext, useContext } from 'react';
import { useAuth } from '@/hooks/useFirebaseAuth';
import { 
  getAllAffiliates,
  getAffiliateSettings,
  updateAffiliateSettings,
  getAllPayouts,
  processPayout,
  approveCommission,
  rejectCommission
} from '@/services/affiliateService';
import { 
  AffiliateUser, 
  AffiliateSettings,
  AffiliateReferral,
  AffiliateCommission,
  AffiliatePayout
} from '@/types/affiliate';
import { collection, query, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

interface AffiliateAdminContextType {
  affiliates: AffiliateUser[];
  settings: AffiliateSettings | null;
  referrals: AffiliateReferral[];
  payouts: AffiliatePayout[];
  commissions: AffiliateCommission[];
  loading: boolean;
  error: string | null;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  availableMonths: string[];
  updateSettings: (settings: Partial<AffiliateSettings>) => Promise<void>;
  processPayout: (payoutId: string, status: 'processing' | 'completed' | 'rejected', notes?: string) => Promise<void>;
  approveCommission: (commissionId: string) => Promise<void>;
  rejectCommission: (commissionId: string, reason: string) => Promise<void>;
}

const AffiliateAdminContext = createContext<AffiliateAdminContextType | undefined>(undefined);

export const AffiliateAdminProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [affiliates, setAffiliates] = useState<AffiliateUser[]>([]);
  const [allAffiliates, setAllAffiliates] = useState<AffiliateUser[]>([]);
  const [settings, setSettings] = useState<AffiliateSettings | null>(null);
  const [referrals, setReferrals] = useState<AffiliateReferral[]>([]);
  const [allReferrals, setAllReferrals] = useState<AffiliateReferral[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [allPayouts, setAllPayouts] = useState<AffiliatePayout[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [allCommissions, setAllCommissions] = useState<AffiliateCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  
  // Get current month in YYYY-MM format
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };
  
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Get affiliate settings
        const settingsData = await getAffiliateSettings();
        setSettings(settingsData);
        
        // Get all affiliates
        const affiliatesData = await getAllAffiliates();
        setAffiliates(affiliatesData);
        
        // Get all payouts
        const payoutsData = await getAllPayouts();
        setPayouts(payoutsData);
        setAllPayouts(payoutsData);
        
        // Get all referrals
        const referralsRef = collection(db, 'affiliate_referrals');
        // Use a simple query without complex conditions to avoid index requirements
        const referralsQuery = query(referralsRef);
        const referralsSnapshot = await getDocs(referralsQuery);
        const referralsData = referralsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as AffiliateReferral));
        setReferrals(referralsData);
        setAllReferrals(referralsData);
        
        // Extract available months from all data
        const extractMonths = (items: any[], dateField: string) => {
          return items.map(item => {
            const date = new Date(item[dateField]);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          });
        };
        
        const commissionMonths = extractMonths(payoutsData, 'requestedAt');
        const payoutMonths = extractMonths(payoutsData, 'requestedAt');
        const referralMonths = extractMonths(referralsData, 'createdAt');
        
        // Combine all months, remove duplicates, and sort in descending order
        const allMonths = [...new Set([...commissionMonths, ...payoutMonths, ...referralMonths])];
        allMonths.sort((a, b) => b.localeCompare(a)); // Sort descending
        
        // Add current month if not already in the list
        const currentMonth = getCurrentMonth();
        if (!allMonths.includes(currentMonth)) {
          allMonths.unshift(currentMonth);
        }
        
        setAvailableMonths(allMonths);
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading affiliate admin data:', err);
        setError('Failed to load affiliate admin data');
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user]);

  // Filter data based on selected month
  useEffect(() => {
    if (!selectedMonth) return;
    
    const filterByMonth = (items: any[], dateField: string) => {
      return items.filter(item => {
        if (!item[dateField]) return false;
        const date = new Date(item[dateField]);
        const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return itemMonth === selectedMonth;
      });
    };
    
    // Filter affiliates by createdAt
    setAffiliates(filterByMonth(allAffiliates, 'createdAt'));
    
    // Filter commissions by createdAt
    setCommissions(filterByMonth(allCommissions, 'createdAt'));
    
    // Filter payouts by requestedAt
    setPayouts(filterByMonth(allPayouts, 'requestedAt'));
    
    // Filter referrals by createdAt
    setReferrals(filterByMonth(allReferrals, 'createdAt'));
    
  }, [selectedMonth, allAffiliates, allCommissions, allPayouts, allReferrals]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    let unsubscribeAffiliates: (() => void) | undefined;
    let unsubscribeCommissions: (() => void) | undefined;
    let unsubscribePayouts: (() => void) | undefined;
    let unsubscribeReferrals: (() => void) | undefined;

    try {
      // Subscribe to affiliates
      try {
        const affiliatesRef = collection(db, 'affiliates');
        unsubscribeAffiliates = onSnapshot(
          affiliatesRef,
          (snapshot) => {
            const affiliatesData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as AffiliateUser));
            setAllAffiliates(affiliatesData);
            
            setAffiliates(affiliatesData);
          },
          (err) => {
            console.error('Error subscribing to affiliates:', err);
            setError('Failed to subscribe to affiliates');
          }
        );
      } catch (err) {
        console.error('Error setting up affiliates subscription:', err);
      }

      // Subscribe to commissions - simple query without ordering to avoid index requirement
      try {
        const commissionsRef = collection(db, 'affiliate_commissions');
        
        unsubscribeCommissions = onSnapshot(
          commissionsRef,
          (snapshot) => {
            const commissionsData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as AffiliateCommission));
            setAllCommissions(commissionsData);
            
            // Sort in memory instead of using Firestore ordering
            commissionsData.sort((a, b) => {
              const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return bTime - aTime; // Descending order
            });
            
            setCommissions(commissionsData);
          },
          (err) => {
            console.error('Error subscribing to commissions:', err);
            setError('Failed to subscribe to commissions');
          }
        );
      } catch (err) {
        console.error('Error setting up commissions subscription:', err);
      }

      // Subscribe to payouts - simple query without ordering to avoid index requirement
      try {
        const payoutsRef = collection(db, 'affiliate_payouts');
        
        unsubscribePayouts = onSnapshot(
          payoutsRef,
          (snapshot) => {
            const payoutsData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as AffiliatePayout));
            setAllPayouts(payoutsData);
            
            // Sort in memory instead of using Firestore ordering
            payoutsData.sort((a, b) => {
              const aTime = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
              const bTime = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
              return bTime - aTime; // Descending order
            });
            
            setPayouts(payoutsData);
          },
          (err) => {
            console.error('Error subscribing to payouts:', err);
            setError('Failed to subscribe to payouts');
          }
        );
      } catch (err) {
        console.error('Error setting up payouts subscription:', err);
      }
      
      // Subscribe to referrals
      try {
        const referralsRef = collection(db, 'affiliate_referrals');
        
        // Use a simple query without complex conditions to avoid index requirements
        unsubscribeReferrals = onSnapshot(
          referralsRef,
          (snapshot) => {
            const referralsData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as AffiliateReferral));
            setAllReferrals(referralsData);
            
            // Filter by selected month
            if (selectedMonth) {
              const filtered = referralsData.filter(referral => {
                if (!referral.createdAt) return false;
                const date = new Date(referral.createdAt);
                const referralMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                return referralMonth === selectedMonth;
              });
              setReferrals(filtered);
            } else {
              setReferrals(referralsData);
            }
            
            // Update available months
            const months = referralsData.map(referral => {
              if (!referral.createdAt) return '';
              const date = new Date(referral.createdAt);
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }).filter(Boolean);
            
            const uniqueMonths = [...new Set([...months, ...availableMonths])];
            uniqueMonths.sort((a, b) => b.localeCompare(a)); // Sort descending
            
            // Add current month if not already in the list
            const currentMonth = getCurrentMonth();
            if (!uniqueMonths.includes(currentMonth)) {
              uniqueMonths.unshift(currentMonth);
            }
            
            setAvailableMonths(uniqueMonths);
          },
          (err) => {
            console.error('Error subscribing to referrals:', err);
            setError('Failed to subscribe to referrals');
          }
        );
      } catch (err) {
        console.error('Error setting up referrals subscription:', err);
      }
    } catch (err) {
      console.error('Error setting up admin subscriptions:', err);
      setError('Failed to set up real-time updates');
    }

    return () => {
      if (unsubscribeAffiliates) unsubscribeAffiliates();
      if (unsubscribeCommissions) unsubscribeCommissions();
      if (unsubscribePayouts) unsubscribePayouts(); 
      if (unsubscribeReferrals) unsubscribeReferrals(); 
    };
  }, [user]);

  // Update affiliate settings
  const updateSettingsFn = async (settingsUpdate: Partial<AffiliateSettings>) => {
    if (!user) {
      throw new Error('You must be logged in to update settings');
    }

    try {
      await updateAffiliateSettings(settingsUpdate);
      
      if (settings) {
        setSettings({
          ...settings,
          ...settingsUpdate,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Error updating affiliate settings:', err);
      throw err;
    }
  };

  // Process payout
  const processPayoutFn = async (
    payoutId: string, 
    status: 'processing' | 'completed' | 'rejected',
    notes?: string
  ) => {
    if (!user) {
      throw new Error('You must be logged in to process payouts');
    }

    try {
      await processPayout(payoutId, user.uid, status, notes);
    } catch (err) {
      console.error('Error processing payout:', err);
      throw err;
    }
  };

  // Approve commission
  const approveCommissionFn = async (commissionId: string) => {
    if (!user) {
      throw new Error('You must be logged in to approve commissions');
    }

    try {
      await approveCommission(commissionId, user.uid);
    } catch (err) {
      console.error('Error approving commission:', err);
      throw err;
    }
  };

  // Reject commission
  const rejectCommissionFn = async (commissionId: string, reason: string) => {
    if (!user) {
      throw new Error('You must be logged in to reject commissions');
    }

    try {
      await rejectCommission(commissionId, user.uid, reason);
    } catch (err) {
      console.error('Error rejecting commission:', err);
      throw err;
    }
  };

  return (
    <AffiliateAdminContext.Provider
      value={{
        affiliates,
        settings,
        referrals,
        payouts,
        commissions,
        loading,
        error,
        selectedMonth,
        setSelectedMonth,
        availableMonths,
        updateSettings: updateSettingsFn,
        processPayout: processPayoutFn,
        approveCommission: approveCommissionFn,
        rejectCommission: rejectCommissionFn
      }}
    >
      {children}
    </AffiliateAdminContext.Provider>
  );
};

export const useAffiliateAdmin = () => {
  const context = useContext(AffiliateAdminContext);
  if (context === undefined) {
    throw new Error('useAffiliateAdmin must be used within an AffiliateAdminProvider');
  }
  return context;
};

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getFirestore, doc, updateDoc, runTransaction, getDoc } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

export const useOrderOperations = () => {
  const queryClient = useQueryClient();
  const db = getFirestore(); 

  const confirmOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      try {
        // Use a transaction to ensure atomic updates
        await runTransaction(db, async (transaction) => {
          // Get the order document
          const orderRef = doc(db, 'orders', orderId);
          const orderDoc = await transaction.get(orderRef);

          console.log('Confirming order:', orderId);
          
          if (!orderDoc.exists()) {
            console.error('Order not found:', orderId);
            throw new Error('Order not found');
          }
          
          const orderData = orderDoc.data();
          
          // Check if order is already confirmed
          if (orderData.status === 'confirmed') {
            console.warn('Order already confirmed:', orderId);
            throw new Error('Order already confirmed');
          }
          
          console.log('Checking stock for items in order:', orderData.items);
          
          // Check stock for each item in the order
          for (const item of orderData.items) {
            // Skip if no product_id (backward compatibility)
            if (!item.product_id) {
              console.warn('Item has no product_id, skipping stock check:', item);
              continue;
            }
            
            const productRef = doc(db, 'products', item.product_id);
            const productDoc = await transaction.get(productRef);
            
            if (!productDoc.exists()) {
              console.error(`Product ${item.name} (${item.product_id}) not found`);
              throw new Error(`Product ${item.name} not found`);
            }
            
            const productData = productDoc.data();
            
            // Check if we need to update variant stock or main product stock
            if (item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && 
                productData.variants && productData.variants.length > 0) {
              
              // Find the matching variant
              const variantName = item.selectedVariantName || 
                                 (item.selectedVariants.variant ? item.selectedVariants.variant : null);
              
              console.log('Checking variant stock:', {
                productName: item.name,
                variantName,
                selectedVariants: item.selectedVariants
              });
              
              if (!variantName) {
                console.error(`Variant name not found for ${item.name}`);
                throw new Error(`Variant name not found for ${item.name}`);
              }
              
              const variantIndex = productData.variants.findIndex(v => v.name === variantName);
              
              if (variantIndex === -1) {
                console.error(`Variant ${variantName} not found for ${item.name}`);
                throw new Error(`Variant ${variantName} not found for ${item.name}`);
              }
              
              const variant = productData.variants[variantIndex];
              
              // Check if there's enough stock
              if (variant.stock < item.quantity) {
                console.error(`Not enough stock for ${item.name} (${variantName}). Available: ${variant.stock}, Requested: ${item.quantity}`);
                throw new Error(`Not enough stock for ${item.name} (${variantName}). Available: ${variant.stock}, Requested: ${item.quantity}`);
              }
              
              // Update variant stock
              const updatedVariants = [...productData.variants];
              updatedVariants[variantIndex] = {
                ...variant,
                stock: variant.stock - item.quantity
              }; 
              
              console.log(`Updating variant stock for ${item.name} (${variantName}): ${variant.stock} -> ${variant.stock - item.quantity}`);
              
              // Update the product with new variants array
              transaction.update(productRef, { 
                variants: updatedVariants,
                updated_at: new Date().toISOString()
              });
              
            } else {
              // Check if there's enough stock for the main product
              if (productData.stock < item.quantity) {
                console.error(`Not enough stock for ${item.name}. Available: ${productData.stock}, Requested: ${item.quantity}`);
                throw new Error(`Not enough stock for ${item.name}. Available: ${productData.stock}, Requested: ${item.quantity}`);
              }
              
              console.log(`Updating main product stock for ${item.name}: ${productData.stock} -> ${productData.stock - item.quantity}`);
              
              // Update main product stock
              transaction.update(productRef, { 
                stock: productData.stock - item.quantity,
                updated_at: new Date().toISOString()
              });
            }
          }
          
          // Update order status to confirmed
          console.log('Updating order status to confirmed:', orderId);
          transaction.update(orderRef, {
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        });
        
        return orderId;
      } catch (error) {
        console.error('Order confirmation transaction failed:', error);
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate multiple query keys to ensure data refresh
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
      
      // Force refetch immediately
      queryClient.refetchQueries({ queryKey: ['orders'] });
      queryClient.refetchQueries({ queryKey: ['pending-orders'] });
      
      toast({
        title: "Order Confirmed",
        description: "Order has been confirmed and product stock has been updated successfully.",
      });
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Failed to confirm order';
      console.error('Order confirmation failed:', errorMessage);
      toast({
        title: "Error",
        description: `Failed to confirm order: ${errorMessage}`,
        variant: "destructive",
      });
    }
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'cancelled',
        updated_at: new Date().toISOString()
      });
      return orderId;
    },
    onSuccess: () => {
      // Invalidate multiple query keys to ensure data refresh
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-orders'] });
      
      // Force refetch immediately
      queryClient.refetchQueries({ queryKey: ['orders'] });
      queryClient.refetchQueries({ queryKey: ['pending-orders'] });
      
      toast({
        title: "Order Cancelled",
        description: "Order has been cancelled successfully.",
      });
    },
    onError: (error) => {
      console.error('Order cancellation failed:', error);
      toast({
        title: "Error",
        description: "Failed to cancel order. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Ensure confirmOrder returns a Promise
  const confirmOrder = (orderId: string) => {
    return confirmOrderMutation.mutateAsync(orderId);
  };
  
  // Ensure cancelOrder returns a Promise
  const cancelOrder = (orderId: string) => {
    return cancelOrderMutation.mutateAsync(orderId);
  };

  return {
    confirmOrder,
    cancelOrder,
    isLoading: confirmOrderMutation.isPending || cancelOrderMutation.isPending
  };
};

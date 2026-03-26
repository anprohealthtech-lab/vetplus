import { useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { whatsappUserSync } from '../utils/whatsappUserSync';

/**
 * Hook to automatically sync users to WhatsApp backend when they are created or updated
 */
export const useWhatsAppAutoSync = () => {
  useEffect(() => {
    // Subscribe to user table changes
    const userSubscription = supabase
      .channel('whatsapp_user_sync')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'users'
        },
        async (payload) => {
          console.log('New user created, triggering WhatsApp sync:', payload.new);
          
          try {
            // Check if auto-sync is enabled for this user
            if (payload.new.whatsapp_auto_sync !== false) {
              await whatsappUserSync.handleNewUserCreated(payload.new as any);
            }
          } catch (error) {
            console.error('Failed to auto-sync new user to WhatsApp:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users'
        },
        async (payload) => {
          // Only sync if specific fields changed and auto-sync is enabled
          const oldUser = payload.old;
          const newUser = payload.new;
          
          const relevantFieldsChanged = (
            oldUser.name !== newUser.name ||
            oldUser.email !== newUser.email ||
            oldUser.role !== newUser.role ||
            oldUser.lab_id !== newUser.lab_id ||
            oldUser.status !== newUser.status
          );

          if (relevantFieldsChanged && newUser.whatsapp_auto_sync !== false) {
            console.log('User updated, triggering WhatsApp sync:', newUser);
            
            try {
              const result = await whatsappUserSync.syncUserToWhatsApp(newUser.id);
              if (result.success) {
                console.log('User auto-sync completed:', result);
              } else {
                console.warn('User auto-sync failed:', result.message);
              }
            } catch (error) {
              console.error('Failed to auto-sync updated user to WhatsApp:', error);
            }
          }
        }
      )
      .subscribe();

    // Subscribe to lab table changes (affects user sync data)
    const labSubscription = supabase
      .channel('whatsapp_lab_sync')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'labs'
        },
        async (payload) => {
          console.log('Lab updated, may need to re-sync users:', payload.new);
          
          // If lab details changed, mark all users in this lab as needing re-sync
          const oldLab = payload.old;
          const newLab = payload.new;
          
          const relevantFieldsChanged = (
            oldLab.name !== newLab.name ||
            oldLab.address !== newLab.address ||
            oldLab.phone !== newLab.phone ||
            oldLab.email !== newLab.email
          );

          if (relevantFieldsChanged) {
            try {
              // Mark users in this lab as pending sync
              await supabase
                .from('users')
                .update({ 
                  whatsapp_sync_status: 'pending',
                  updated_at: new Date().toISOString()
                })
                .eq('lab_id', newLab.id)
                .eq('whatsapp_auto_sync', true);

              console.log(`Marked users in lab ${newLab.id} for re-sync due to lab changes`);
            } catch (error) {
              console.error('Failed to mark users for re-sync:', error);
            }
          }
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      userSubscription.unsubscribe();
      labSubscription.unsubscribe();
    };
  }, []);

  return {
    // Expose manual sync functions
    syncUser: whatsappUserSync.syncUserToWhatsApp,
    syncAllUsers: whatsappUserSync.syncAllUsersInLab,
    getSyncStatus: whatsappUserSync.getSyncStatus,
    retryFailedSyncs: whatsappUserSync.retryFailedSyncs
  };
};

/**
 * Utility functions for manual sync operations
 */
export const whatsappSyncUtils = {
  /**
   * Manually trigger sync for a specific user
   */
  syncUser: async (userId: string) => {
    try {
      const result = await whatsappUserSync.syncUserToWhatsApp(userId);
      return result;
    } catch (error) {
      console.error('Manual sync failed:', error);
      return { success: false, message: (error as Error).message };
    }
  },

  /**
   * Check if a user needs to be synced
   */
  checkSyncStatus: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('whatsapp_sync_status, whatsapp_last_sync, whatsapp_sync_error')
        .eq('id', userId)
        .single();

      if (error) throw error;

      return {
        status: data.whatsapp_sync_status || 'pending',
        lastSync: data.whatsapp_last_sync,
        error: data.whatsapp_sync_error
      };
    } catch (error) {
      console.error('Failed to check sync status:', error);
      return null;
    }
  },

  /**
   * Enable/disable auto-sync for a user
   */
  toggleAutoSync: async (userId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          whatsapp_auto_sync: enabled,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Failed to toggle auto-sync:', error);
      return { success: false, message: (error as Error).message };
    }
  },

  /**
   * Get sync statistics for a lab
   */
  getSyncStats: async (labId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('whatsapp_sync_status')
        .eq('lab_id', labId);

      if (error) throw error;

      const stats = (data || []).reduce((acc, user) => {
        const status = user.whatsapp_sync_status || 'pending';
        if (status === 'pending') acc.pending++;
        else if (status === 'synced') acc.synced++;
        else if (status === 'failed') acc.failed++;
        else if (status === 'disabled') acc.disabled++;
        acc.total++;
        return acc;
      }, { total: 0, pending: 0, synced: 0, failed: 0, disabled: 0 });

      return stats;
    } catch (error) {
      console.error('Failed to get sync stats:', error);
      return { total: 0, pending: 0, synced: 0, failed: 0, disabled: 0 };
    }
  }
};
import React, { useState } from 'react';
import { database } from '../utils/supabase';

interface PhlebotomistCheckboxProps {
  userId: string;
  initialValue: boolean;
  userName: string;
  onStatusChange?: (userId: string, isPhlebotomist: boolean) => void;
  disabled?: boolean;
}

const PhlebotomistCheckbox: React.FC<PhlebotomistCheckboxProps> = ({
  userId,
  initialValue,
  userName,
  onStatusChange,
  disabled = false
}) => {
  const [isPhlebotomist, setIsPhlebotomist] = useState(initialValue);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    
    try {
      setUpdating(true);
      setError(null);
      
      const { data, error: updateError } = await database.users.updatePhlebotomistStatus(
        userId,
        newValue
      );
      
      if (updateError) {
        throw updateError;
      }
      
      setIsPhlebotomist(newValue);
      
      if (onStatusChange) {
        onStatusChange(userId, newValue);
      }
      
      // Show success message briefly
      const message = newValue 
        ? `${userName} is now marked as a phlebotomist`
        : `${userName} is no longer marked as a phlebotomist`;
      
      console.log(message);
      
    } catch (err) {
      console.error('Error updating phlebotomist status:', err);
      setError('Failed to update');
      // Revert checkbox on error
      setIsPhlebotomist(!newValue);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={isPhlebotomist}
        onChange={handleChange}
        disabled={disabled || updating}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        title={isPhlebotomist ? "Can collect samples" : "Cannot collect samples"}
      />
      {updating && (
        <span className="text-xs text-gray-500">Updating...</span>
      )}
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  );
};

export default PhlebotomistCheckbox;

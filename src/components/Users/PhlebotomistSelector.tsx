import React, { useEffect, useState } from 'react';
import { database } from '../../utils/supabase';

interface PhlebotomistUser {
  id: string;
  name: string;
  email: string;
  is_phlebotomist: boolean;
}

interface PhlebotomistSelectorProps {
  labId: string;
  value?: string; // Selected phlebotomist ID
  onChange: (userId: string | null, userName: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const PhlebotomistSelector: React.FC<PhlebotomistSelectorProps> = ({
  labId,
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder = 'Select phlebotomist...',
}) => {
  const [phlebotomists, setPhlebotomists] = useState<PhlebotomistUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPhlebotomists();
  }, [labId]);

  const loadPhlebotomists = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await database.users.listPhlebotomists(labId);

      if (fetchError) {
        throw fetchError;
      }

      setPhlebotomists((data as PhlebotomistUser[]) || []);
    } catch (err) {
      console.error('Failed to load phlebotomists:', err);
      setError('Failed to load phlebotomist list');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = e.target.value;
    const selectedUser = phlebotomists.find((p) => p.id === userId);
    onChange(userId || null, selectedUser?.name || '');
  };

  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={handleChange}
        disabled={disabled || loading}
        className={`
          w-full px-3 py-2 border border-gray-300 rounded-md 
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${error ? 'border-red-500' : ''}
          ${className}
        `}
      >
        <option value="">{loading ? 'Loading...' : placeholder}</option>
        {phlebotomists.map((phlebo) => (
          <option key={phlebo.id} value={phlebo.id}>
            {phlebo.name} {phlebo.email ? `(${phlebo.email})` : ''}
          </option>
        ))}
      </select>

      {error && (
        <p className="mt-1 text-sm text-red-600">
          {error}
          <button
            type="button"
            onClick={loadPhlebotomists}
            className="ml-2 text-blue-600 hover:underline"
          >
            Retry
          </button>
        </p>
      )}

      {!loading && phlebotomists.length === 0 && !error && (
        <p className="mt-1 text-sm text-gray-500">
          No phlebotomists found. Mark users as phlebotomists in User Management.
        </p>
      )}
    </div>
  );
};

export default PhlebotomistSelector;

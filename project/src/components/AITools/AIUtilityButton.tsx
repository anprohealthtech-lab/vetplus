import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import AIUtilityModal from './AIUtilityModal';

interface AIUtilityButtonProps {
  context?: {
    orderId?: string;
    patientId?: string;
    testId?: string;
    placement: string;
  };
  variant?: 'primary' | 'secondary' | 'icon-only';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

const AIUtilityButton: React.FC<AIUtilityButtonProps> = ({
  context,
  variant = 'primary',
  size = 'md',
  className = '',
  children
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getButtonClasses = () => {
    const baseClasses = 'inline-flex items-center gap-2 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    const variantClasses = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500',
      secondary: 'bg-white text-indigo-600 border border-indigo-600 hover:bg-indigo-50 focus:ring-indigo-500',
      'icon-only': 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200 focus:ring-indigo-500 p-2'
    };

    const sizeClasses = {
      sm: variant === 'icon-only' ? 'p-1.5' : 'px-3 py-1.5 text-sm',
      md: variant === 'icon-only' ? 'p-2' : 'px-4 py-2 text-sm',
      lg: variant === 'icon-only' ? 'p-3' : 'px-6 py-3 text-base'
    };

    return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;
  };

  const getIconSize = () => {
    switch (size) {
      case 'sm': return 'h-4 w-4';
      case 'md': return 'h-5 w-5';
      case 'lg': return 'h-6 w-6';
      default: return 'h-5 w-5';
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={getButtonClasses()}
        title="AI Utilities"
      >
        <Sparkles className={getIconSize()} />
        {variant !== 'icon-only' && (
          <span>{children || 'AI Tools'}</span>
        )}
      </button>

      <AIUtilityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        context={context}
      />
    </>
  );
};

export default AIUtilityButton;

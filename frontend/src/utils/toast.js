// Toast notification utilities
import toast from 'react-hot-toast';

export const showToast = {
  success: (message) => {
    toast.success(message, {
      duration: 3000,
      icon: '✅',
    });
  },
  
  error: (message, error) => {
    const errorMessage = error?.message || message || 'An error occurred';
    toast.error(errorMessage, {
      duration: 5000,
      icon: '❌',
    });
  },
  
  loading: (message) => {
    return toast.loading(message || 'Processing...');
  },
  
  promise: (promise, messages) => {
    return toast.promise(promise, {
      loading: messages.loading || 'Processing...',
      success: messages.success || 'Success!',
      error: messages.error || 'An error occurred',
    });
  },
  
  custom: (message, type = 'default') => {
    toast(message, {
      icon: type === 'info' ? 'ℹ️' : type === 'warning' ? '⚠️' : undefined,
    });
  },
};

export default showToast;


// src/utils/formatters.ts
export const formatCurrency = (amount: number): string => {
    // Gunakan opsi minimumFractionDigits: 0 untuk hilangkan desimal
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  export const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
  
    if (date >= today) {
      return 'Hari ini';
    } else if (date >= yesterday) {
      return 'Kemarin';
    } else {
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
  };
  
  export const formatDateTime = (dateString: string): { date: string; time: string } => {
    const date = new Date(dateString);
    
    const formattedDate = date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    
    const formattedTime = date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    
    return { date: formattedDate, time: formattedTime };
  };
  
  export const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };
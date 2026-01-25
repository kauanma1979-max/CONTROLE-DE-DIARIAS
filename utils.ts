
export function parseDate(dateStr: any): Date | null {
  if (!dateStr) return null;
  
  const dateStrS = dateStr.toString();
  const dateFormats = [
    /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/, // dd/mm/yyyy hh:mm
    /(\d{2})\/(\d{2})\/(\d{4})/, // dd/mm/yyyy
    /(\d{4})-(\d{2})-(\d{2})/, // yyyy-mm-dd
    /(\d{2})-(\d{2})-(\d{4})/, // dd-mm-yyyy
  ];
  
  for (let i = 0; i < dateFormats.length; i++) {
    const format = dateFormats[i];
    const match = dateStrS.match(format);
    if (match) {
      if (i === 0) {
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]), 
                        parseInt(match[4]), parseInt(match[5]));
      } else if (i === 1) {
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      } else if (i === 2) {
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else if (i === 3) {
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      }
    }
  }
  
  const date = new Date(dateStrS);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  return null;
}

export function formatDate(date: Date | null): string {
  if (!date) return "N/A";
  return date.toLocaleDateString('pt-BR');
}

export function formatDateComplete(date: Date | null): string {
  if (!date) return "N/A";
  return date.toLocaleDateString('pt-BR', { 
    weekday: 'long',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

export function calculateDaysBetween(date1: Date | null, date2: Date | null): number | null {
  if (!date1 || !date2) return null;
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

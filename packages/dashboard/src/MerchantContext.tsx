import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface Merchant {
  id: string;
  display_name: string;
}

interface MerchantContextValue {
  merchantId: string;
  setMerchantId: (id: string) => void;
  merchants: Merchant[];
  merchantName: string;
  apiUrl: (path: string) => string;
}

const MerchantContext = createContext<MerchantContextValue>(null!);

export function useMerchant() {
  return useContext(MerchantContext);
}

export function MerchantProvider({ children }: { children: ReactNode }) {
  const [merchantId, setMerchantId] = useState('default');
  const [merchants, setMerchants] = useState<Merchant[]>([]);

  useEffect(() => {
    fetch('/api/merchants')
      .then(r => r.json())
      .then(d => setMerchants(d.merchants || []))
      .catch(() => {});
  }, []);

  const merchantName = merchants.find(m => m.id === merchantId)?.display_name || merchantId;

  function apiUrl(path: string): string {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}merchant_id=${encodeURIComponent(merchantId)}`;
  }

  return (
    <MerchantContext.Provider value={{ merchantId, setMerchantId, merchants, merchantName, apiUrl }}>
      {children}
    </MerchantContext.Provider>
  );
}

import { useEffect, useState } from 'react';
import api from './api';

export const DEFAULT_COMPANY_CURRENCY = {
  code: 'ZAR',
  symbol: 'R',
  name: 'South African Rand',
};

export function formatMoney(value, currency = DEFAULT_COMPANY_CURRENCY) {
  const symbol = currency?.symbol || DEFAULT_COMPANY_CURRENCY.symbol;
  return `${symbol} ${(Number(value) || 0).toFixed(2)}`;
}

export function useCompanyCurrency() {
  const [currency, setCurrency] = useState(DEFAULT_COMPANY_CURRENCY);

  useEffect(() => {
    let active = true;

    api.get('/company-details')
      .then((res) => {
        if (!active) return;

        const data = res.data || {};

        setCurrency({
          code: data.currency_code || DEFAULT_COMPANY_CURRENCY.code,
          symbol: data.currency_symbol || DEFAULT_COMPANY_CURRENCY.symbol,
          name: data.currency_name || DEFAULT_COMPANY_CURRENCY.name,
        });
      })
      .catch(() => {
        if (!active) return;
        setCurrency(DEFAULT_COMPANY_CURRENCY);
      });

    return () => {
      active = false;
    };
  }, []);

  return currency;
}

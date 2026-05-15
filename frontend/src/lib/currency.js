import { useEffect, useState } from 'react';
import api from './api';

export const DEFAULT_COMPANY_CURRENCY = {
  code: 'ZAR',
  symbol: 'R',
  name: 'South African Rand',
};

const STORAGE_KEY = 'signomics-company-currency';

export function normalizeCurrency(data = {}) {
  return {
    code: data.currency_code || data.code || DEFAULT_COMPANY_CURRENCY.code,
    symbol: data.currency_symbol || data.symbol || DEFAULT_COMPANY_CURRENCY.symbol,
    name: data.currency_name || data.name || DEFAULT_COMPANY_CURRENCY.name,
  };
}

export function saveCompanyCurrency(currency) {
  const normalized = normalizeCurrency(currency);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(
      new CustomEvent('signomics-company-currency-changed', { detail: normalized })
    );
  } catch {
    // Ignore safely if browser storage is unavailable.
  }

  return normalized;
}

export function getStoredCompanyCurrency() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COMPANY_CURRENCY;
    return normalizeCurrency(JSON.parse(raw));
  } catch {
    return DEFAULT_COMPANY_CURRENCY;
  }
}

export function formatMoney(value, currency = DEFAULT_COMPANY_CURRENCY) {
  const symbol = currency?.symbol || DEFAULT_COMPANY_CURRENCY.symbol;
  return `${symbol} ${(Number(value) || 0).toFixed(2)}`;
}

export function useCompanyCurrency() {
  const [currency, setCurrency] = useState(() => getStoredCompanyCurrency());

  useEffect(() => {
    let active = true;

    const applyCurrency = (nextCurrency) => {
      if (!active) return;
      setCurrency(normalizeCurrency(nextCurrency));
    };

    const onCurrencyChanged = (event) => {
      applyCurrency(event.detail || getStoredCompanyCurrency());
    };

    window.addEventListener('signomics-company-currency-changed', onCurrencyChanged);
    window.addEventListener('storage', onCurrencyChanged);

    api.get('/company-details')
      .then((res) => {
        if (!active) return;
        const normalized = saveCompanyCurrency(normalizeCurrency(res.data || {}));
        setCurrency(normalized);
      })
      .catch(() => {
        if (!active) return;
        setCurrency(getStoredCompanyCurrency());
      });

    return () => {
      active = false;
      window.removeEventListener('signomics-company-currency-changed', onCurrencyChanged);
      window.removeEventListener('storage', onCurrencyChanged);
    };
  }, []);

  return currency;
}

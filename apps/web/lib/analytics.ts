/**
 * Google Analytics 4 (GA4) — gtag.js helpers
 *
 * Provides:
 * - Platform-level tracking (Rukny's own GA)
 * - Per-store tracking (each store owner can add their own GA4 Measurement ID)
 * - Custom e-commerce events aligned with GA4 recommended events
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type GtagEvent =
  // E-commerce
  | 'view_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'view_item_list'
  // Store
  | 'view_store'
  | 'create_store'
  // User
  | 'sign_up'
  | 'login'
  // Forms & Events
  | 'submit_form'
  | 'register_event'
  | 'view_event'
  // Generic
  | 'page_view'
  | 'search'
  | (string & {}); // allow custom strings

export interface GtagEventParams {
  // E-commerce (GA4 recommended)
  currency?: string;
  value?: number;
  items?: Array<{
    item_id?: string;
    item_name?: string;
    item_category?: string;
    price?: number;
    quantity?: number;
    item_brand?: string;
  }>;
  transaction_id?: string;
  shipping?: number;
  tax?: number;
  coupon?: string;

  // Store
  store_id?: string;
  store_name?: string;

  // Form / Event
  form_id?: string;
  form_name?: string;
  event_id?: string;
  event_name?: string;

  // Search
  search_term?: string;

  // Page view
  page_title?: string;
  page_location?: string;
  page_path?: string;

  // Catch-all
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Globals                                                           */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

/** Platform Measurement ID */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

/* ------------------------------------------------------------------ */
/*  Core helpers                                                      */
/* ------------------------------------------------------------------ */

/** Check if gtag is loaded */
function isGtagReady(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

/** Send a page_view to all configured GA streams */
export function pageView(url: string, storeGaId?: string) {
  if (!isGtagReady()) return;

  const params = { page_path: url };

  // Platform GA
  if (GA_MEASUREMENT_ID) {
    window.gtag('config', GA_MEASUREMENT_ID, params);
  }

  // Store-specific GA
  if (storeGaId) {
    window.gtag('config', storeGaId, params);
  }
}

/** Send a custom event */
export function trackEvent(
  event: GtagEvent,
  params?: GtagEventParams,
  storeGaId?: string,
) {
  if (!isGtagReady()) return;

  // Send to platform GA
  if (GA_MEASUREMENT_ID) {
    window.gtag('event', event, {
      ...params,
      send_to: GA_MEASUREMENT_ID,
    });
  }

  // Send to store GA
  if (storeGaId) {
    window.gtag('event', event, {
      ...params,
      send_to: storeGaId,
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Initialize a new GA stream (for store-specific tracking)          */
/* ------------------------------------------------------------------ */

const initializedStreams = new Set<string>();

/** Dynamically add a store's GA4 Measurement ID */
export function initStoreAnalytics(measurementId: string) {
  if (!measurementId || initializedStreams.has(measurementId)) return;
  if (typeof window === 'undefined') return;

  // Add gtag config for this measurement ID
  window.gtag('config', measurementId, {
    send_page_view: false, // we handle page views manually
  });

  initializedStreams.add(measurementId);
}

/* ------------------------------------------------------------------ */
/*  Pre-built e-commerce event helpers                                */
/* ------------------------------------------------------------------ */

export function trackViewStore(storeId: string, storeName: string, storeGaId?: string) {
  trackEvent('view_store', { store_id: storeId, store_name: storeName }, storeGaId);
}

export function trackViewProduct(
  product: { id: string; name: string; price?: number; category?: string },
  store?: { id: string; name: string; gaId?: string },
) {
  trackEvent(
    'view_item',
    {
      currency: 'IQD',
      value: product.price,
      store_id: store?.id,
      store_name: store?.name,
      items: [
        {
          item_id: product.id,
          item_name: product.name,
          item_category: product.category,
          price: product.price,
          quantity: 1,
        },
      ],
    },
    store?.gaId,
  );
}

export function trackAddToCart(
  product: { id: string; name: string; price?: number; quantity?: number },
  store?: { id: string; name: string; gaId?: string },
) {
  trackEvent(
    'add_to_cart',
    {
      currency: 'IQD',
      value: (product.price || 0) * (product.quantity || 1),
      store_id: store?.id,
      store_name: store?.name,
      items: [
        {
          item_id: product.id,
          item_name: product.name,
          price: product.price,
          quantity: product.quantity || 1,
        },
      ],
    },
    store?.gaId,
  );
}

export function trackBeginCheckout(
  value: number,
  items: Array<{ id: string; name: string; price?: number; quantity?: number }>,
  store?: { id: string; name: string; gaId?: string },
) {
  trackEvent(
    'begin_checkout',
    {
      currency: 'IQD',
      value,
      store_id: store?.id,
      store_name: store?.name,
      items: items.map((i) => ({
        item_id: i.id,
        item_name: i.name,
        price: i.price,
        quantity: i.quantity || 1,
      })),
    },
    store?.gaId,
  );
}

export function trackPurchase(
  order: {
    id: string;
    value: number;
    shipping?: number;
    tax?: number;
    coupon?: string;
    items: Array<{ id: string; name: string; price?: number; quantity?: number }>;
  },
  store?: { id: string; name: string; gaId?: string },
) {
  trackEvent(
    'purchase',
    {
      transaction_id: order.id,
      currency: 'IQD',
      value: order.value,
      shipping: order.shipping,
      tax: order.tax,
      coupon: order.coupon,
      store_id: store?.id,
      store_name: store?.name,
      items: order.items.map((i) => ({
        item_id: i.id,
        item_name: i.name,
        price: i.price,
        quantity: i.quantity || 1,
      })),
    },
    store?.gaId,
  );
}

export function trackSignUp(method?: string) {
  trackEvent('sign_up', { method: method || 'quick_sign' });
}

export function trackCreateStore(storeId: string, storeName: string) {
  trackEvent('create_store', { store_id: storeId, store_name: storeName });
}

export function trackSubmitForm(formId: string, formName: string) {
  trackEvent('submit_form', { form_id: formId, form_name: formName });
}

export function trackRegisterEvent(eventId: string, eventName: string) {
  trackEvent('register_event', { event_id: eventId, event_name: eventName });
}

export function trackSearch(searchTerm: string) {
  trackEvent('search', { search_term: searchTerm });
}

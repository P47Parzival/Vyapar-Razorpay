import { useState, useEffect } from 'react';
import { useMerchant } from '../MerchantContext';

interface Order {
  id: string;
  customer_id: string;
  ledger_id: string;
  item_ids: string[];
  amount_paise: number;
  category: string | null;
  source: string;
  related_order_id: string | null;
  created_at: string;
}

interface Customer {
  id: string;
  identifier: string;
  first_seen_at: string;
  last_purchase_at: string;
  total_spent_paise: number;
  order_count: number;
}

const SOURCE_LABELS: Record<string, string> = {
  internal_growth_agent: 'Growth Agent',
  internal_buyer_agent: 'Buyer Agent',
  external_mcp_client: 'MCP External',
  webhook: 'Webhook',
};

interface OrderGroup {
  base: Order;
  addon: Order | null;
}

function buildOrderGroups(orders: Order[]): OrderGroup[] {
  const addonMap = new Map<string, Order>();
  for (const order of orders) {
    if (order.related_order_id) {
      addonMap.set(order.related_order_id, order);
    }
  }

  const groups: OrderGroup[] = [];

  for (const order of orders) {
    if (order.related_order_id) continue;
    groups.push({
      base: order,
      addon: addonMap.get(order.id) || null,
    });
  }

  return groups;
}

export default function OrdersAndCustomers() {
  const { apiUrl, merchantId } = useMerchant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tab, setTab] = useState<'orders' | 'customers'>('orders');

  const fetchData = async () => {
    const [ordersRes, customersRes] = await Promise.all([
      fetch(apiUrl('/api/orders?limit=20')),
      fetch(apiUrl('/api/customers?limit=20')),
    ]);
    const ordersData = await ordersRes.json();
    const customersData = await customersRes.json();
    setOrders(ordersData.orders || []);
    setCustomers(customersData.customers || []);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [merchantId]);

  return (
    <div className="register flex flex-col h-full">
      <div className="register-header flex items-center justify-between">
        <div>
          <h2>Orders & Customers</h2>
          <p className="font-body text-xs text-ink-muted mt-0.5">Merchant-owned data, regardless of source</p>
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
          <button
            onClick={() => setTab('orders')}
            className={`font-body px-2.5 py-1 text-xs rounded transition-colors ${
              tab === 'orders'
                ? 'bg-white font-medium text-ink'
                : 'text-ink-muted'
            }`}
            style={tab === 'orders' ? { boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : {}}
          >
            Orders ({orders.length})
          </button>
          <button
            onClick={() => setTab('customers')}
            className={`font-body px-2.5 py-1 text-xs rounded transition-colors ${
              tab === 'customers'
                ? 'bg-white font-medium text-ink'
                : 'text-ink-muted'
            }`}
            style={tab === 'customers' ? { boxShadow: '0 1px 2px rgba(0,0,0,0.06)' } : {}}
          >
            Customers ({customers.length})
          </button>
        </div>
      </div>

      <div className="register-body flex-1 overflow-y-auto min-h-0">
        {tab === 'orders' && (
          orders.length === 0 ? (
            <p className="font-body text-sm text-ink-muted text-center py-8">No orders yet — run a purchase through any entry point</p>
          ) : (
            <div className="space-y-2">
              {buildOrderGroups(orders).map(group => (
                <div key={group.base.id} className="rounded border" style={{ borderColor: group.addon ? 'var(--seal-green)' : 'var(--ledger-line)' }}>
                  {/* Base order */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-body text-xs text-ink-muted">
                        {SOURCE_LABELS[group.base.source] || group.base.source}
                        {group.addon && <span className="text-seal-green font-medium ml-2">upsell pair</span>}
                      </span>
                      <span className="font-data text-[10px] text-ink-muted">
                        {new Date(group.base.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-data text-sm font-medium text-ink">
                          ₹{(group.base.amount_paise / 100).toLocaleString('en-IN')}
                        </span>
                        {group.base.category && (
                          <span className="font-body text-[10px] text-ink-muted">{group.base.category}</span>
                        )}
                      </div>
                      <span className="font-data text-[10px] text-ink-muted">{group.base.id}</span>
                    </div>
                  </div>

                  {/* Addon order — linked pair */}
                  {group.addon && (
                    <div className="px-3 pb-3">
                      <div className="ml-3 pl-3 border-l-2" style={{ borderColor: 'var(--seal-green)' }}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-body text-[10px] text-ink-muted">addon</span>
                          <span className="font-data text-[10px] text-ink-muted">{group.addon.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-data text-sm font-medium text-ink">
                            + ₹{(group.addon.amount_paise / 100).toLocaleString('en-IN')}
                          </span>
                          {group.addon.category && (
                            <span className="font-body text-[10px] text-ink-muted">{group.addon.category}</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--ledger-line)' }}>
                        <p className="font-body text-xs text-ink">
                          <span className="font-data">₹{(group.base.amount_paise / 100).toFixed(0)}</span> base + <span className="font-data">₹{(group.addon.amount_paise / 100).toFixed(0)}</span> addon = <span className="font-data">₹{((group.base.amount_paise + group.addon.amount_paise) / 100).toFixed(0)}</span> — <span className="font-semibold text-seal-green">{Math.round((group.addon.amount_paise / group.base.amount_paise) * 100)}% uplift</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'customers' && (
          customers.length === 0 ? (
            <p className="font-body text-sm text-ink-muted text-center py-8">No customers yet</p>
          ) : (
            <div className="space-y-2">
              {customers.map(customer => (
                <div key={customer.id} className="p-3 rounded border" style={{ borderColor: 'var(--ledger-line)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-body text-xs font-medium text-ink">{customer.identifier}</span>
                    <span className="font-data text-[10px] text-ink-muted">
                      {customer.order_count} order{customer.order_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-data text-sm font-medium text-ink">
                      ₹{(customer.total_spent_paise / 100).toLocaleString('en-IN')} total
                    </span>
                    <span className="font-data text-[10px] text-ink-muted">
                      Last: {new Date(customer.last_purchase_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

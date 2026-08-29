import { useState, useEffect } from 'react';

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

const SOURCE_BADGES: Record<string, { label: string; classes: string }> = {
  internal_growth_agent: { label: 'GROWTH', classes: 'bg-orange-50 text-orange-700 border-orange-200' },
  internal_buyer_agent: { label: 'BUYER', classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  external_mcp_client: { label: 'MCP EXTERNAL', classes: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  webhook: { label: 'WEBHOOK', classes: 'bg-purple-50 text-purple-700 border-purple-200' },
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tab, setTab] = useState<'orders' | 'customers'>('orders');

  const fetchData = async () => {
    const [ordersRes, customersRes] = await Promise.all([
      fetch('/api/orders?limit=20'),
      fetch('/api/customers?limit=20'),
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
  }, []);

  const getSourceBadge = (source: string) => {
    const badge = SOURCE_BADGES[source] || { label: source, classes: 'bg-gray-50 text-gray-700 border-gray-200' };
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${badge.classes}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Merchant Data</h2>
            <p className="text-xs text-gray-500 mt-0.5">Orders & customers — owned entirely by the merchant, regardless of source</p>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setTab('orders')}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${tab === 'orders' ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500'}`}
            >
              Orders ({orders.length})
            </button>
            <button
              onClick={() => setTab('customers')}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${tab === 'customers' ? 'bg-white shadow text-gray-900 font-medium' : 'text-gray-500'}`}
            >
              Customers ({customers.length})
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 flex-1 overflow-y-auto min-h-0">
        {tab === 'orders' && (
          orders.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No orders yet — run a purchase through any entry point</p>
          ) : (
            <div className="space-y-2">
              {buildOrderGroups(orders).map(group => (
                <div key={group.base.id} className={`rounded-lg ${group.addon ? 'border-2 border-orange-200 bg-orange-50/30' : 'border border-gray-200 bg-gray-50'}`}>
                  <div className="p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-gray-500">{group.base.id}</span>
                      <div className="flex items-center gap-1">
                        {group.addon && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-300 font-semibold">
                            UPSELL
                          </span>
                        )}
                        {getSourceBadge(group.base.source)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          ₹{(group.base.amount_paise / 100).toFixed(0)}
                        </span>
                        {group.base.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                            {group.base.category}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {new Date(group.base.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  {group.addon && (
                    <div className="px-2.5 pb-2.5">
                      <div className="pl-3 border-l-2 border-orange-300">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-mono text-gray-400">{group.addon.id}</span>
                          <span className="text-[10px] text-orange-600 font-medium">addon</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">
                            + ₹{(group.addon.amount_paise / 100).toFixed(0)}
                          </span>
                          {group.addon.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                              {group.addon.category}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 px-2 py-1.5 bg-orange-100/60 rounded text-xs text-orange-800 font-medium">
                        ₹{(group.base.amount_paise / 100).toFixed(0)} base + ₹{(group.addon.amount_paise / 100).toFixed(0)} addon = ₹{((group.base.amount_paise + group.addon.amount_paise) / 100).toFixed(0)} — <span className="font-bold">{Math.round((group.addon.amount_paise / group.base.amount_paise) * 100)}% uplift</span>
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
            <p className="text-sm text-gray-400 text-center py-6">No customers yet</p>
          ) : (
            <div className="space-y-2">
              {customers.map(customer => (
                <div key={customer.id} className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-900">{customer.identifier}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                      {customer.order_count} order{customer.order_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">
                      ₹{(customer.total_spent_paise / 100).toFixed(0)} total
                    </span>
                    <span className="text-[10px] text-gray-400">
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

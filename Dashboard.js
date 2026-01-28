/*Dashboard.js */
import React, { useEffect, useState } from 'react';

function Dashboard() {
  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('http://localhost:5000/orders');
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  };

  const fulfillOrder = async (paymentId) => {
    try {
      await fetch('http://localhost:5000/fulfill-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId })
      });
      setOrders(prev => prev.filter(order => order.paymentId !== paymentId));
    } catch (err) {
      console.error('Error fulfilling order:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard">
      <h2>Live Orders</h2>
      {orders.length === 0 ? (
        <p>No current orders</p>
      ) : (
        <table className="order-table">
          <thead>
            <tr>
              <th>Table No</th>
              <th>Items</th>
              <th>Dine-in ₹</th>
              <th>Takeaway ₹</th>
              <th>Subtotal</th>
              <th>GST</th>
              <th>Total</th>
              <th>Time</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => {
              let dineInTotal = 0;
              let takeAwayTotal = 0;

              order.cart.forEach(item => {
                const dine = item.dineInQuantity || 0;
                const pack = item.takeAwayQuantity || 0;
                dineInTotal += dine * item.price;
                takeAwayTotal += pack * item.price;
              });

              return (
                <tr key={order.paymentId}>
                  <td>{order.tableNumber}</td>
                  <td>
                    <ul>
                      {order.cart.map(item => (
                        <li key={item.id}>
                          {item.name} — 
                          Dine-in: {item.dineInQuantity || 0}, 
                          Pack: {item.takeAwayQuantity || 0}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>₹{dineInTotal.toFixed(2)}</td>
                  <td>₹{takeAwayTotal.toFixed(2)}</td>
                  <td>₹{order.subtotal.toFixed(2)}</td>
                  <td>₹{order.gst.toFixed(2)}</td>
                  <td>₹{order.total.toFixed(2)}</td>
                  <td>{order.timestamp}</td>
                  <td>
                    <button onClick={() => fulfillOrder(order.paymentId)}>Fulfill</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Dashboard;

// App.js
import React, { useState, useEffect } from 'react'; 
import './App.css';
import Dashboard from './Dashboard';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShoppingCart, faTrash, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import menuData from './menuData';
import jsPDF from 'jspdf';

function App() {
  const [isOwner, setIsOwner] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('pizza');
  const [quantities, setQuantities] = useState({});
  const [tableNumber, setTableNumber] = useState('');
  const [orderSummary, setOrderSummary] = useState(null);

  useEffect(() => {
    const q = {};
    Object.values(menuData).flat().forEach(item => q[item.id] = 0);
    setQuantities(q);
    const scr = document.createElement('script');
    scr.src = 'https://checkout.razorpay.com/v1/checkout.js';
    scr.async = true;
    document.body.appendChild(scr);
  }, []);

  const showToast = (msg, isError = false) => {
    const t = document.createElement('div');
    t.className = `toast${isError ? ' error' : ''}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 3000);
  };

  const inc = id => {
    setQuantities(prev => {
      const newQty = prev[id] + 1;
      const updated = { ...prev, [id]: newQty };

      setCart(prevCart => {
        const exists = prevCart.find(i => i.id === id);
        if (!exists) {
          const item = Object.values(menuData).flat().find(i => i.id === id);
          showToast(`${item.name} added`);
          return [...prevCart, { ...item, quantity: 1, dineInQuantity: 1, takeAwayQuantity: 0 }];
        }
        return prevCart.map(i =>
          i.id === id
            ? {
                ...i,
                quantity: newQty,
                dineInQuantity: (i.dineInQuantity || 0) + 1,
                takeAwayQuantity: i.takeAwayQuantity || 0
              }
            : i
        );
      });

      return updated;
    });
  };

  const dec = id => {
    setQuantities(prev => {
      const newQty = Math.max(prev[id] - 1, 0);
      const updated = { ...prev, [id]: newQty };
      setCart(prevCart => {
        return prevCart
          .map(i => {
            if (i.id !== id) return i;
            const dine = Math.max((i.dineInQuantity || 0) - 1, 0);
            const pack = Math.max(i.quantity - 1 - dine, 0);
            return {
              ...i,
              quantity: newQty,
              dineInQuantity: dine,
              takeAwayQuantity: pack
            };
          })
          .filter(i => i.quantity > 0);
      });
      return updated;
    });
  };

  const addToCart = id => {
    if (!tableNumber) {
      showToast('Please enter table number before ordering', true);
      return;
    }

    let qty = quantities[id] || 0;
    if (!qty) {
      qty = 1;
      setQuantities(q => ({ ...q, [id]: 1 }));
    }

    const item = Object.values(menuData).flat().find(i => i.id === id);

    setCart(prev => {
      const e = prev.find(i => i.id === id);
      if (e) {
        return prev.map(i =>
          i.id === id
            ? {
                ...i,
                quantity: i.quantity + qty,
                dineInQuantity: (i.dineInQuantity || 0) + qty,
                takeAwayQuantity: i.takeAwayQuantity || 0
              }
            : i
        );
      }
      return [
        ...prev,
        {
          ...item,
          quantity: qty,
          dineInQuantity: qty,
          takeAwayQuantity: 0
        }
      ];
    });

    showToast(`${item.name} (${qty}) added`);
  };

  const removeFromCart = id => {
    setCart(prev => prev.filter(item => item.id !== id));
    setQuantities(prev => ({ ...prev, [id]: 0 }));
    showToast('Item removed');
  };

  const clearCart = () => {
    setCart([]);
    const resetQuantities = {};
    Object.values(menuData).flat().forEach(item => {
      resetQuantities[item.id] = 0;
    });
    setQuantities(resetQuantities);
    showToast('Cart cleared');
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const gst = subtotal * 0.05;
  const total = subtotal + gst;

  const ownerLogin = () => {
    const pwd = prompt('Enter admin password:');
    if (pwd === 'admin123') {
      setIsOwner(true);
      showToast('Owner access granted');
      setCurrentPage('dashboard');
    } else {
      showToast('Incorrect password', true);
    }
  };

  const handlePayment = async () => {
    if (!tableNumber) {
      showToast('Set table first', true);
      return;
    }
    if (!cart.length) {
      showToast('Cart empty', true);
      return;
    }

    try {
      const res = await fetch('http://localhost:5000/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total * 100 })
      });
      const data = await res.json();
      if (!res.ok || !data.id) throw new Error(data.error || 'Order failed');

      new window.Razorpay({
        key: 'rzp_test_ZKg9gXrmlsegAn',
        amount: data.amount,
        currency: data.currency,
        order_id: data.id,
        name: 'The Taste Yard',
        description: `Table ${tableNumber}`,
        handler: async resp => {
          showToast('Payment Successful!');
          const finalCart = cart.map(item => ({
            ...item,
            dineInQuantity: item.dineInQuantity || 0,
            takeAwayQuantity: item.takeAwayQuantity || 0,
            quantity: (item.dineInQuantity || 0) + (item.takeAwayQuantity || 0)
          }));
          const summary = {
            cart: finalCart,
            subtotal,
            gst,
            total,
            tableNumber,
            paymentId: resp.razorpay_payment_id,
            timestamp: new Date().toLocaleString()
          };
          await fetch('http://localhost:5000/submit-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(summary)
          });
          setOrderSummary(summary);
          setCurrentPage('payment');
          clearCart();
        },
        theme: { color: '#F37254' },
        modal: { ondismiss: () => showToast('Payment cancelled', true) }
      }).open();
    } catch (e) {
      console.error(e);
      showToast(e.message || 'Payment failed', true);
    }
  };

  const generateInvoice = () => {
  if (!orderSummary) {
    showToast("Invoice data is missing", true);
    return;
  }

  const {
    cart = [],
    subtotal = 0,
    gst = 0,
    total = 0,
    tableNumber = '1',
    paymentId = 'N/A',
    timestamp = new Date().toLocaleString()
  } = orderSummary;

  let dineInSubtotal = 0;
  let takeAwaySubtotal = 0;

  cart.forEach(item => {
    const dine = item.dineInQuantity || 0;
    const pack = item.takeAwayQuantity || 0;
    dineInSubtotal += dine * item.price;
    takeAwaySubtotal += pack * item.price;
  });

  const doc = new jsPDF();
  let y = 20;

  // Header Banner
  doc.setFillColor("#C0392B");
  doc.rect(0, 0, 210, 25, 'F');

  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.text("THE TASTE YARD", 105, 15, null, null, 'center');

  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text("Savor every bite at The Taste Yard", 105, 21, null, null, 'center');

  // Invoice Title
  y = 35;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text("TAX INVOICE", 105, y, null, null, 'center');

  // Invoice Info
  y += 10;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Order ID: ${paymentId}`, 20, y);
  doc.text(`Invoice Date: ${timestamp}`, 140, y);
  y += 6;
  doc.text(`Table No: ${tableNumber}`, 20, y);
  doc.text(`Invoice Mode: Dine-in / Takeaway`, 140, y);

  // Section Separator
  y += 6;
  doc.setLineWidth(0.5);
  doc.line(10, y, 200, y);
  y += 5;

  // Table Headings
  doc.setFont(undefined, 'bold');
  doc.setFillColor("#C0392B");
  doc.setTextColor(255, 255, 255);
  doc.rect(10, y - 4, 190, 8, 'F');
  doc.text("Sr", 12, y);
  doc.text("Item", 20, y);
  doc.text("HSN", 70, y);
  doc.text("Dine / Pack", 95, y);
  doc.text("Unit ₹", 130, y);
  doc.text("Amount ₹", 165, y);

  // Table Rows
  y += 6;
  doc.setFont(undefined, 'normal');
  doc.setTextColor(0, 0, 0);
  cart.forEach((item, index) => {
    const dineIn = item.dineInQuantity || 0;
    const pack = item.takeAwayQuantity || 0;
    const totalQty = dineIn + pack;
    const net = (item.price * totalQty).toFixed(2);
    doc.text(`${index + 1}`, 12, y);
    doc.text(`${item.name}`, 20, y);
    doc.text(`999799`, 70, y);
    doc.text(`${dineIn} / ${pack}`, 95, y);
    doc.text(`₹${item.price.toFixed(2)}`, 130, y);
    doc.text(`₹${net}`, 165, y);
    y += 7;
  });

  // Totals Summary
  y += 4;
  doc.line(10, y, 200, y);
  y += 8;

  doc.setFont(undefined, 'bold');
  doc.text("Billing Summary", 20, y);
  y += 6;

  doc.setFont(undefined, 'normal');
  doc.text("Dine-in Subtotal", 140, y);
  doc.text(`₹${dineInSubtotal.toFixed(2)}`, 180, y);
  y += 6;
  doc.text("Takeaway Subtotal", 140, y);
  doc.text(`₹${takeAwaySubtotal.toFixed(2)}`, 180, y);
  y += 6;
  doc.text("Combined Subtotal", 140, y);
  doc.text(`₹${subtotal.toFixed(2)}`, 180, y);
  y += 6;
  doc.text("CGST (2.5%)", 140, y);
  doc.text(`₹${(gst / 2).toFixed(2)}`, 180, y);
  y += 6;
  doc.text("SGST (2.5%)", 140, y);
  doc.text(`₹${(gst / 2).toFixed(2)}`, 180, y);
  y += 6;
  doc.setFont(undefined, 'bold');
  doc.text("Total Amount", 140, y);
  doc.text(`₹${total.toFixed(2)}`, 180, y);

  // Amount in Words
  y += 10;
  doc.setFontSize(10);
  doc.setFont(undefined, 'italic');
  const words = convertNumberToWords(total);
  doc.text(`Amount in words: ${words}`, 20, y);

  // Footer
  y += 20;
  doc.setFont(undefined, 'bold');
  doc.setTextColor("#C0392B");
  doc.text("Digitally Signed by The Taste Yard", 20, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  doc.text(timestamp.split(',')[0], 150, y);

  y += 12;
  doc.setFont(undefined, 'bold');
  doc.setFontSize(11);
  doc.setTextColor("#C0392B");
  doc.text("Thank you for visiting The Taste Yard!", 105, y, null, null, 'center');

  // Save
  const filename = `invoice-${paymentId?.slice(0, 8) || 'no-id'}.pdf`;
  doc.save(filename);
};

  const convertNumberToWords = (amount) => {
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    });
    const words = formatter.format(amount).replace('₹', '').trim();
    return `${words} Rupees Only`;
  };

  const renderMenu = () => {
    return (
      <div className="menu-grid">
        {menuData[activeCategory]?.map(item => (
          <div key={item.id} className="menu-item">
            <img src={item.image} alt={item.name} className="item-image" />
            <div className="item-details">
              <h3 className="item-name">{item.name}</h3>
              <p className="item-desc">{item.desc}</p>
              <p className="item-price">₹{item.price}</p>
              <div className="item-actions">
                {quantities[item.id] > 0 ? (
                  <div className="quantity-control">
                    <button className="quantity-btn" onClick={() => dec(item.id)}>-</button>
                    <span className="quantity">{quantities[item.id]}</span>
                    <button className="quantity-btn" onClick={() => inc(item.id)}>+</button>
                  </div>
                ) : (
                  <button className="add-to-cart" onClick={() => addToCart(item.id)}>Add</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return  ( 
     <div className="App">
      <nav className="main-nav">
        <div className="nav-brand" onClick={() => setCurrentPage('home')}>The Taste Yard</div>
        <div className="nav-links">
          <button onClick={() => setCurrentPage('home')}>Home</button>
          <button onClick={() => setCurrentPage('order')}>Menu</button>
          <button onClick={() => setCurrentPage('cart')}>
            <FontAwesomeIcon icon={faShoppingCart} /> {cart.reduce((s, i) => s + i.quantity, 0)}
          </button>
          {isOwner
            ? <button onClick={() => setCurrentPage('dashboard')}>Dashboard</button>
            : <button onClick={ownerLogin}>Owner Login</button>
          }
        </div>
      </nav>

      <div className="table-info">Table: {tableNumber ||
        <button className="table-btn" onClick={() => {
          const t = prompt('Enter table number:');
          if (t) setTableNumber(t);
        }}>Set Table</button>}
      </div>
      {currentPage === 'home' && (
        <section className="page active">
          <div className="hero">
            <h1>The Taste Yard</h1>
            <p className="tagline">Savor every bite at The Taste Yard</p>
            <button className="cta-button" onClick={() => setCurrentPage('order')}>Order Now</button>
          </div>
        </section>
      )}

      {currentPage === 'order' && (
  <>
    <div className="category-tabs">
      {Object.keys(menuData).map(cat => (
        <button
          key={cat}
          className={activeCategory === cat ? 'active' : ''}
          onClick={() => setActiveCategory(cat)}
        >
          {cat.toUpperCase()}
        </button>
      ))}
    </div>
    {renderMenu()}
  </>
)}

{currentPage === 'cart' && (
  <div className="cart-view">
    <h2>Your Cart</h2>
    {cart.length ? (
      <>
        {cart.map(it => (
          <div className="cart-item" key={it.id}>
            <div className="cart-item-info">
              <div className="cart-item-name">{it.name}</div>
              <div className="cart-item-price">₹{it.price} each</div>
            </div>

            <div className="cart-item-quantity">
              <button className="quantity-btn" onClick={() => dec(it.id)}>-</button>
              <span>{it.quantity}</span>
              <button className="quantity-btn" onClick={() => inc(it.id)}>+</button>
            </div>

            <div className="cart-item-split">
<label>
  Dine-in:
  <input
    type="number"
    min="0"
    value={it.dineInQuantity || 0}
    onChange={e => {
      const dineIn = parseInt(e.target.value || 0);
      const totalQty = it.quantity;
      const validDineIn = Math.min(dineIn, totalQty);
      const newPack = Math.max(totalQty - validDineIn, 0);

      setCart(prevCart =>
        prevCart.map(ci =>
          ci.id === it.id
            ? {
                ...ci,
                dineInQuantity: validDineIn,
                takeAwayQuantity: newPack
              }
            : ci
        )
      );
    }}
  />
</label>

<label>
  Pack:
  <input
    type="number"
    min="0"
    value={it.takeAwayQuantity || 0}
    onChange={e => {
      const pack = parseInt(e.target.value || 0);
      const totalQty = it.quantity;
      const validPack = Math.min(pack, totalQty);
      const newDineIn = Math.max(totalQty - validPack, 0);

      setCart(prevCart =>
        prevCart.map(ci =>
          ci.id === it.id
            ? {
                ...ci,
                takeAwayQuantity: validPack,
                dineInQuantity: newDineIn
              }
            : ci
        )
      );
    }}
  />
</label>

            </div>

            <FontAwesomeIcon icon={faTrash} className="remove-item" onClick={() => removeFromCart(it.id)} />
          </div>
        ))}

        <div className="cart-summary">
          <div className="summary-row">
            <span>Subtotal:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>GST:</span>
            <span>₹{gst.toFixed(2)}</span>
          </div>
          <div className="summary-row total">
            <span>Total:</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
          <div className="cart-actions">
            <button className="btn-primary" onClick={handlePayment} disabled={!tableNumber}>Checkout</button>
            <button className="btn-secondary" onClick={clearCart}>Clear Cart</button>
          </div>
        </div>
      </>
    ) : (
      <p>Cart is empty</p>
    )}
  </div>
)}


      {currentPage === 'payment' && orderSummary && (
        <div className="receipt">
          <h2>Order Confirmed!</h2>
          <p>Table: {orderSummary.tableNumber}</p>
          <FontAwesomeIcon icon={faCheckCircle} color="green" />
          <button className="r-btn" onClick={generateInvoice}>Download Invoice</button>
          <button className="r-btn" onClick={() => { setOrderSummary(null); setCurrentPage('order'); }}>New Order</button>
        </div>
      )}
      

      {currentPage === 'dashboard' && isOwner && (
        <Dashboard />
      )}
    </div>
    
  );
}

export default App;


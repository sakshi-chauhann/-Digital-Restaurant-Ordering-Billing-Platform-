/*packingOption.js */
import React from 'react';

function PackingOption({ cart, packedQuantities, setPackedQuantities }) {
  const handleChange = (id, value) => {
    const val = Math.max(0, Math.min(value, getItemQty(id)));
    setPackedQuantities(prev => ({ ...prev, [id]: val }));
  };

  const getItemQty = id => {
    const item = cart.find(i => i.id === id);
    return item ? item.quantity : 0;
  };

  return (
    <div className="packing-section">
      <h3>Pack for Home</h3>
      {cart.map(item => (
        <div key={item.id} className="packing-item">
          <span>{item.name} (Ordered: {item.quantity})</span>
          <input
            type="number"
            min="0"
            max={item.quantity}
            value={packedQuantities[item.id] || 0}
            onChange={e => handleChange(item.id, parseInt(e.target.value) || 0)}
          />
          <span>to be packed</span>
        </div>
      ))}
    </div>
  );
}

export default PackingOption;
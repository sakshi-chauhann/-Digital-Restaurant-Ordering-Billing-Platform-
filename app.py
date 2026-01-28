from flask import Flask, request, jsonify
from flask_cors import CORS
import razorpay
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

app = Flask(__name__)
CORS(app)

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# In-memory order store
orders = []

@app.route('/create-order', methods=['POST'])
def create_order():
    try:
        data = request.get_json()
        amount = int(data.get('amount', 0))  # amount in paise

        payment = client.order.create({
            "amount": amount,
            "currency": "INR",
            "payment_capture": 1
        })
        return jsonify(payment)
    except Exception as e:
        print("Error in create_order:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/submit-order', methods=['POST'])
def submit_order():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No order data provided"}), 400

        data['timestamp'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        orders.append(data)
        print(f"New order submitted: {data['paymentId']}")
        return jsonify({"message": "Order received"}), 200
    except Exception as e:
        print("Error in submit_order:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/orders', methods=['GET'])
def get_orders():
    try:
        return jsonify(orders)
    except Exception as e:
        print("Error in get_orders:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/fulfill-order', methods=['POST'])
def fulfill_order():
    try:
        order_id = request.json.get('paymentId')
        if not order_id:
            return jsonify({"error": "No paymentId provided"}), 400

        global orders
        orders = [o for o in orders if o.get('paymentId') != order_id]
        print(f"Order fulfilled and removed: {order_id}")
        return jsonify({"message": "Order fulfilled"}), 200
    except Exception as e:
        print("Error in fulfill_order:", str(e))
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

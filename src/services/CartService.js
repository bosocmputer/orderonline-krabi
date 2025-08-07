import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_APP_API,
    headers: {
        'Content-Type': 'application/json'
    },
    // Add timeout and retry configuration
    timeout: 300000 // 30 seconds timeout
});

class CartService {
    // เพิ่มสินค้าลงตะกร้า
    async addItemToCart(cartItems) {
        return apiClient.post('service/wawashopservice/additemtocart', cartItems);
    }

    // ดึงรายการสินค้าในตะกร้า
    async getCartItems(custCode) {
        return apiClient.get('service/wawashopservice/getcartitemlist', {
            params: {
                cust_code: custCode
            }
        });
    }

    // ลบสินค้าออกจากตะกร้า
    async removeItemFromCart(custCode, itemCode, unitCode) {
        return apiClient.post('service/wawashopservice/removeitemfromcart', {
            cust_code: custCode,
            item_code: itemCode,
            unit_code: unitCode
        });
    }

    // ลบสินค้าออกจากตะกร้า (ใหม่)
    async deleteItem(guidCode, custCode) {
        return apiClient.get('service/wawashopservice/deleteItem', {
            params: {
                guid_code: guidCode,
                cust_code: custCode
            }
        });
    }

    // ล้างตะกร้าทั้งหมด
    async deleteAllItems(custCode) {
        return apiClient.get('service/wawashopservice/deleteAllItems', {
            params: {
                cust_code: custCode
            }
        });
    }

    // อัปเดตจำนวนสินค้าในตะกร้า (ใช้ endpoint เดียวกับ addItemToCart)
    async updateCartItemQuantity(cartItems) {
        // ใช้ endpoint เดียวกับการเพิ่มสินค้า
        return apiClient.post('service/wawashopservice/additemtocart', cartItems);
    }

    // ดึงข้อมูลสินค้าในตะกร้าพร้อมราคายืนยัน
    async getCartOrder(custCode) {
        return apiClient.get('service/wawashopservice/getcartorder', {
            params: {
                cust_code: custCode
            }
        });
    }

    // สั่งซื้อสินค้า
    async sendOrder(orderData) {
        console.log('CartService sending order data:', JSON.stringify(orderData, null, 2));

        try {
            // Add some basic error handling and retries
            let retries = 2;
            let lastError = null;

            while (retries >= 0) {
                try {
                    const response = await apiClient.post('service/wawashopservice/sendorder', orderData);
                    console.log('API Response:', response);
                    return response;
                } catch (error) {
                    console.error(`API call failed (retry ${2 - retries}/2):`, error);
                    lastError = error;
                    retries--;

                    // Wait before retry (increasing backoff)
                    if (retries >= 0) {
                        await new Promise((resolve) => setTimeout(resolve, 1000 * (2 - retries)));
                    }
                }
            }

            // All retries failed
            throw lastError;
        } catch (error) {
            console.error('Final sendOrder error:', error);
            throw error;
        }
    }

    async cancelOrder(orderData) {
        return apiClient.post('service/wawashopservice/cancelOrder', orderData);
    }
}

export default new CartService();

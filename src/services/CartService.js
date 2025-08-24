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
        return apiClient.post('/additemtocart', cartItems);
    }

    // ดึงรายการสินค้าในตะกร้า
    async getCartItems(custCode, whCode = null) {
        const shelfCode = localStorage.getItem('_shelf_code');
        const params = {
            cust_code: custCode,
            wh_code: whCode,
            shelf_code: shelfCode
        };

        // เพิ่ม wh_code ถ้ามีการส่งมาและไม่เป็น null หรือ "null"
        if (whCode && whCode !== 'null' && whCode.trim() !== '') {
            params.wh_code = whCode;
        }

        console.log('CartService.getCartItems params:', params);

        return apiClient.get('/getcartitemlist', {
            params: params
        });
    }

    // ลบสินค้าออกจากตะกร้า
    async removeItemFromCart(custCode, itemCode, unitCode) {
        return apiClient.post('/removeitemfromcart', {
            cust_code: custCode,
            item_code: itemCode,
            unit_code: unitCode
        });
    }

    // ลบสินค้าออกจากตะกร้า (ใหม่)
    async deleteItem(guidCode, custCode) {
        return apiClient.get('/deleteItem', {
            params: {
                guid_code: guidCode,
                cust_code: custCode
            }
        });
    }

    // ล้างตะกร้าทั้งหมด
    async deleteAllItems(custCode) {
        return apiClient.get('/deleteAllItems', {
            params: {
                cust_code: custCode
            }
        });
    }

    // อัปเดตจำนวนสินค้าในตะกร้า (ใช้ endpoint เดียวกับ addItemToCart)
    async updateCartItemQuantity(cartItems) {
        // ใช้ endpoint เดียวกับการเพิ่มสินค้า
        return apiClient.post('/additemtocart', cartItems);
    }

    // ดึงข้อมูลสินค้าในตะกร้าพร้อมราคายืนยัน
    async getCartOrder(custCode) {
        const saleType = localStorage.getItem('_saleType');
        return apiClient.get('/getcartorder', {
            params: {
                cust_code: custCode,
                sale_type: saleType
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
                    const response = await apiClient.post('/sendorder', orderData);
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
        return apiClient.post('/cancelOrder', orderData);
    }
}

export default new CartService();

import axios from 'axios';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_APP_API,
    headers: {
        'Content-Type': 'application/json'
    }
});

class OrderHistoryService {
    // ดึงประวัติการสั่งซื้อตาม customer code
    async getOrderHistory(custCode, status = '') {
        return apiClient.get('/getOrderHistory', {
            params: {
                cust_code: custCode,
                status: status
            }
        });
    }

    // ดึงรายละเอียดคำสั่งซื้อแต่ละรายการ
    async getOrderDetail(custCode, docNo) {
        return apiClient.get('/getOrderDetail', {
            params: {
                cust_code: custCode,
                doc_no: docNo
            }
        });
    }

    // ชำระเงินผ่าน QR Promptpay
    async payOrder(paymentData) {
        return apiClient.post('/pay', paymentData);
    }
}

export default new OrderHistoryService();
